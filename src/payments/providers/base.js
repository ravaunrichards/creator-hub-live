'use strict';
/**
 * Payment provider adapter contract.
 *
 * CRITICAL HONESTY RULE: a provider that is not configured with real
 * credentials MUST throw NotConfiguredError from createIntent/capture. It must
 * NEVER return a fake "succeeded" result. Sandbox success is also explicitly
 * flagged (environment:'sandbox') so it is never mistaken for a production
 * capture.
 */

class NotConfiguredError extends Error {
  constructor(provider, missing) {
    super(`Payment provider '${provider}' is not configured (missing: ${missing.join(', ')})`);
    this.name = 'NotConfiguredError';
    this.code = 'PROVIDER_NOT_CONFIGURED';
    this.provider = provider;
    this.missing = missing;
  }
}

class PaymentError extends Error {
  constructor(code, message) { super(message); this.name = 'PaymentError'; this.code = code; }
}

/**
 * Abstract base. Subclasses implement the protected _ methods.
 * Statuses used across the system:
 *   requires_action | pending | authorized | captured | failed | cancelled | refunded
 */
class PaymentProvider {
  constructor(id, { env = 'sandbox' } = {}) {
    this.id = id;
    this.env = env; // 'sandbox' | 'production'
  }
  get methods() { return []; }            // e.g. ['card_visa','card_mastercard']
  get currencies() { return []; }          // supported settlement currencies
  get countries() { return []; }           // ISO-3166 alpha-2, or ['*']
  isConfigured() { return false; }
  assertConfigured() { throw new NotConfiguredError(this.id, ['override']); }
  // eslint-disable-next-line no-unused-vars
  async createIntent(intent) { this.assertConfigured(); }
  // eslint-disable-next-line no-unused-vars
  async capture(providerRef) { this.assertConfigured(); }
  // eslint-disable-next-line no-unused-vars
  async refund(providerRef, amountMinor) { this.assertConfigured(); }
  // eslint-disable-next-line no-unused-vars
  verifyWebhook(headers, rawBody) { this.assertConfigured(); }
}

module.exports = { PaymentProvider, NotConfiguredError, PaymentError };
