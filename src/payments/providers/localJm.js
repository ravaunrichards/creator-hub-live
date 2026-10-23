'use strict';
const { PaymentProvider, NotConfiguredError } = require('./base');

/**
 * Jamaican local payment adapter (Lynk / MyCash / local bank transfer).
 *
 * HONEST MODEL: a consumer wallet is NOT the same as a merchant API. Unless a
 * real merchant integration (API key + confirmation webhook) is supplied, these
 * methods operate in MANUAL-VERIFICATION mode:
 *   - createIntent issues a payment instruction + unique reference and returns
 *     status 'pending'. It NEVER returns 'captured'.
 *   - Coins are credited ONLY after an authorized reviewer confirms receipt
 *     (confirmManual) OR a verified provider webhook arrives. A receipt,
 *     screenshot, or customer claim alone is never sufficient.
 */
class LocalJmProvider extends PaymentProvider {
  constructor({ method = 'lynk', merchantHandle, apiKey, httpClient, env = 'sandbox' } = {}) {
    super(`jm_${method}`, { env });
    this.method = method; // 'lynk' | 'mycash' | 'bank_transfer'
    this.merchantHandle = merchantHandle;
    this.apiKey = apiKey;        // present only if a real merchant API exists
    this.http = httpClient;
  }
  get methods() { return [`jm_${this.method}`]; }
  get currencies() { return ['JMD']; }
  get countries() { return ['JM']; }

  // A merchant handle is enough to issue manual-pay instructions.
  isConfigured() { return Boolean(this.merchantHandle); }
  assertConfigured() {
    if (!this.merchantHandle) throw new NotConfiguredError(this.id, ['LOCAL_MERCHANT_HANDLE']);
  }
  hasAutomatedConfirmation() { return Boolean(this.apiKey && this.http); }

  async createIntent(intent) {
    this.assertConfigured();
    const reference = `CHL-${this.method.toUpperCase()}-${intent.idempotencyKey.slice(0, 12)}`;
    return {
      providerRef: reference,
      status: 'pending',
      requiresManualVerification: !this.hasAutomatedConfirmation(),
      instructions: {
        method: this.method,
        payTo: this.merchantHandle,
        amountMinor: intent.amountMinor,
        currency: 'JMD',
        reference,
        note: 'Send the exact amount and include the reference. Coins are credited only after confirmation.',
      },
      environment: this.env,
    };
  }

  // Authorized-reviewer confirmation (admin). The authorization check lives in
  // the admin route; this only records the decision. Returns a settled result
  // the wallet service can act on.
  confirmManual(providerRef, { reviewerId, verified }) {
    if (!reviewerId) throw new Error('reviewerId required for manual confirmation');
    return { providerRef, status: verified ? 'captured' : 'failed',
      verifiedBy: reviewerId, manual: true, environment: this.env };
  }
}

module.exports = { LocalJmProvider };
