'use strict';
const { PaymentProvider, NotConfiguredError, PaymentError } = require('./base');

/**
 * Generic Visa / Mastercard acquiring adapter.
 *
 * PCI rule enforced structurally: this adapter NEVER accepts a raw PAN / CVV.
 * It only accepts a `paymentToken` produced by the provider's hosted fields /
 * hosted checkout on the client. Raw card data must never reach CHL servers.
 *
 * This is a provider-agnostic shape intended to be backed by a Jamaica-eligible
 * acquirer (e.g. a processor that can settle to a JM business account and
 * accepts Visa/Mastercard debit+credit, JMD + international cards). The concrete
 * processor is pluggable via `httpClient` + endpoint config. Until a real
 * merchant account + API keys are supplied it is NOT configured and will not
 * fake an approval.
 */
class CardGatewayProvider extends PaymentProvider {
  constructor({ apiKey, merchantId, endpoint, env = 'sandbox', httpClient,
    methods = ['card_visa_debit', 'card_visa_credit', 'card_mastercard_debit', 'card_mastercard_credit'],
    currencies = ['JMD', 'USD'], countries = ['JM', '*'] } = {}) {
    super('card_gateway', { env });
    this.apiKey = apiKey;
    this.merchantId = merchantId;
    this.endpoint = endpoint;
    this.http = httpClient;
    this._methods = methods;
    this._currencies = currencies;
    this._countries = countries;
  }
  get methods() { return this._methods; }
  get currencies() { return this._currencies; }
  get countries() { return this._countries; }

  isConfigured() { return Boolean(this.apiKey && this.merchantId && this.endpoint && this.http); }
  assertConfigured() {
    const missing = [];
    if (!this.apiKey) missing.push('CARD_GATEWAY_API_KEY');
    if (!this.merchantId) missing.push('CARD_GATEWAY_MERCHANT_ID');
    if (!this.endpoint) missing.push('CARD_GATEWAY_ENDPOINT');
    if (!this.http) missing.push('httpClient');
    if (missing.length) throw new NotConfiguredError('card_gateway', missing);
  }

  async createIntent(intent) {
    this.assertConfigured();
    // Returns a client secret / hosted-checkout session; 3-D Secure handled by provider.
    const res = await this.http('POST', `${this.endpoint}/sessions`, {
      headers: { Authorization: `Bearer ${this.apiKey}`, 'Content-Type': 'application/json',
        'Idempotency-Key': intent.idempotencyKey },
      body: JSON.stringify({ merchantId: this.merchantId, amount: intent.amountMinor,
        currency: intent.currency, require3ds: true, reference: intent.idempotencyKey }),
    });
    if (res.status !== 200 && res.status !== 201) {
      throw new PaymentError('CARD_SESSION_FAILED', `status ${res.status}`);
    }
    return { providerRef: res.json.sessionId, clientSecret: res.json.clientSecret,
      status: 'requires_action', environment: this.env, raw: res.json };
  }

  async capture(providerRef) {
    this.assertConfigured();
    const res = await this.http('POST', `${this.endpoint}/sessions/${providerRef}/capture`, {
      headers: { Authorization: `Bearer ${this.apiKey}`, 'Content-Type': 'application/json' },
    });
    const s = res.json && res.json.status;
    const map = { approved: 'captured', declined: 'failed', insufficient_funds: 'failed',
      cancelled: 'cancelled', pending: 'pending', requires_authentication: 'requires_action' };
    return { providerRef, status: map[s] || 'failed', declineReason: res.json?.reason || null,
      environment: this.env, raw: res.json };
  }

  async refund(providerRef, amountMinor) {
    this.assertConfigured();
    const res = await this.http('POST', `${this.endpoint}/sessions/${providerRef}/refund`, {
      headers: { Authorization: `Bearer ${this.apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ amount: amountMinor }),
    });
    return { providerRef, status: res.json?.status === 'refunded' ? 'refunded' : 'failed',
      environment: this.env, raw: res.json };
  }
}

module.exports = { CardGatewayProvider };
