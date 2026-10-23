'use strict';
const crypto = require('crypto');
const { PaymentProvider, NotConfiguredError, PaymentError } = require('./base');

/**
 * PayPal adapter.
 *
 * Real server-side Orders v2 flow (create order -> client approves -> capture).
 * Network calls are performed through an injectable `httpClient` so the logic
 * is unit-testable offline AND wired to real PayPal in production. Without
 * clientId/secret this adapter is NOT configured and refuses to pretend.
 *
 * Note learned from the reference project: sandbox OAuth succeeding is NOT
 * proof production works — env is tracked explicitly and surfaced everywhere.
 */
class PayPalProvider extends PaymentProvider {
  constructor({ clientId, clientSecret, env = 'sandbox', httpClient } = {}) {
    super('paypal', { env });
    this.clientId = clientId;
    this.clientSecret = clientSecret;
    this.webhookId = process.env.PAYPAL_WEBHOOK_ID;
    this.http = httpClient; // async (method,url,{headers,body}) -> {status,json}
    this.base = env === 'production'
      ? 'https://api-m.paypal.com'
      : 'https://api-m.sandbox.paypal.com';
  }
  get methods() { return ['paypal']; }
  get currencies() { return ['USD', 'EUR', 'GBP', 'CAD', 'JMD']; }
  get countries() { return ['*']; }

  isConfigured() { return Boolean(this.clientId && this.clientSecret && this.http); }
  assertConfigured() {
    const missing = [];
    if (!this.clientId) missing.push('PAYPAL_CLIENT_ID');
    if (!this.clientSecret) missing.push('PAYPAL_CLIENT_SECRET');
    if (!this.http) missing.push('httpClient');
    if (missing.length) throw new NotConfiguredError('paypal', missing);
  }

  async _token() {
    const auth = Buffer.from(`${this.clientId}:${this.clientSecret}`).toString('base64');
    const res = await this.http('POST', `${this.base}/v1/oauth2/token`, {
      headers: { Authorization: `Basic ${auth}`, 'Content-Type': 'application/x-www-form-urlencoded' },
      body: 'grant_type=client_credentials',
    });
    if (res.status !== 200 || !res.json || !res.json.access_token) {
      throw new PaymentError('PAYPAL_AUTH_FAILED', `OAuth failed (status ${res.status})`);
    }
    return res.json.access_token;
  }

  async createIntent(intent) {
    this.assertConfigured();
    const token = await this._token();
    const res = await this.http('POST', `${this.base}/v2/checkout/orders`, {
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json',
        'PayPal-Request-Id': intent.idempotencyKey },
      body: JSON.stringify({
        intent: 'CAPTURE',
        purchase_units: [{
          custom_id: intent.idempotencyKey,
          amount: { currency_code: intent.currency, value: (intent.amountMinor / 100).toFixed(2) },
        }],
      }),
    });
    if (res.status !== 201 || !res.json) throw new PaymentError('PAYPAL_CREATE_FAILED', `status ${res.status}`);
    return { providerRef: res.json.id, status: 'requires_action', environment: this.env, raw: res.json };
  }

  async capture(providerRef) {
    this.assertConfigured();
    const token = await this._token();
    const res = await this.http('POST', `${this.base}/v2/checkout/orders/${providerRef}/capture`, {
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    });
    if (res.status === 201 && res.json && res.json.status === 'COMPLETED') {
      const cap = res.json.purchase_units?.[0]?.payments?.captures?.[0];
      return { providerRef, captureId: cap?.id, status: 'captured', environment: this.env, raw: res.json };
    }
    return { providerRef, status: 'failed', environment: this.env, raw: res.json };
  }

  verifyWebhook(headers, rawBody) {
    this.assertConfigured();
    if (!this.webhookId) throw new NotConfiguredError('paypal', ['PAYPAL_WEBHOOK_ID']);
    // Production MUST call POST /v1/notifications/verify-webhook-signature.
    // Offline we expose a deterministic HMAC check hook so idempotency tests
    // can run without the network; it is NOT a substitute for PayPal's API.
    const sig = headers['paypal-transmission-sig'];
    if (!sig) return { verified: false, reason: 'missing signature header' };
    const expected = crypto.createHmac('sha256', this.webhookId).update(rawBody).digest('base64');
    return { verified: sig === expected, offlineCheck: true };
  }
}

module.exports = { PayPalProvider };
