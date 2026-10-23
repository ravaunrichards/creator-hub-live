'use strict';
const { NotConfiguredError } = require('./providers/base');

/**
 * Payment orchestrator + eligibility engine.
 *
 * Responsibilities:
 *  - Keep a registry of provider adapters.
 *  - Compute the ELIGIBLE method list for a given context (country, currency,
 *    transaction type) — and only include providers that are actually
 *    configured. A provider logo is never shown as "available" unless its
 *    adapter reports isConfigured().
 *  - Route createIntent/capture to the correct provider.
 */
class PaymentGateway {
  constructor() { this.providers = new Map(); }

  register(provider) { this.providers.set(provider.id, provider); return this; }
  get(id) { return this.providers.get(id) || null; }

  /**
   * @param {object} ctx { country, currency, txType }
   * @returns array of { method, providerId, environment, configured:true }
   * Only configured + eligible methods are returned.
   */
  eligibleMethods(ctx = {}) {
    const out = [];
    for (const provider of this.providers.values()) {
      if (!provider.isConfigured()) continue;
      const countryOk = provider.countries.includes('*') ||
        (ctx.country && provider.countries.includes(ctx.country));
      const currencyOk = !ctx.currency || provider.currencies.includes(ctx.currency);
      if (!countryOk || !currencyOk) continue;
      for (const method of provider.methods) {
        out.push({ method, providerId: provider.id, environment: provider.env, configured: true });
      }
    }
    return out;
  }

  async createIntent(providerId, intent) {
    const provider = this.get(providerId);
    if (!provider) throw new NotConfiguredError(providerId, ['provider not registered']);
    return provider.createIntent(intent);
  }

  async capture(providerId, providerRef) {
    const provider = this.get(providerId);
    if (!provider) throw new NotConfiguredError(providerId, ['provider not registered']);
    return provider.capture(providerRef);
  }
}

module.exports = { PaymentGateway };
