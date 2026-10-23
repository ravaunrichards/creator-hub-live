'use strict';
const test = require('node:test');
const assert = require('node:assert');
const { PaymentGateway } = require('../src/payments/gateway');
const { PayPalProvider } = require('../src/payments/providers/paypal');
const { CardGatewayProvider } = require('../src/payments/providers/cardGateway');
const { LocalJmProvider } = require('../src/payments/providers/localJm');
const { NotConfiguredError } = require('../src/payments/providers/base');

test('unconfigured providers are NOT advertised as eligible', () => {
  const g = new PaymentGateway();
  g.register(new PayPalProvider({}));           // no creds
  g.register(new CardGatewayProvider({}));      // no creds
  const methods = g.eligibleMethods({ country: 'JM', currency: 'JMD' });
  assert.strictEqual(methods.length, 0);
});

test('unconfigured provider refuses to fake success', async () => {
  const p = new PayPalProvider({});
  await assert.rejects(() => p.createIntent({ idempotencyKey: 'k', amountMinor: 999, currency: 'USD' }),
    (e) => e instanceof NotConfiguredError && e.code === 'PROVIDER_NOT_CONFIGURED');
});

test('eligibility filters by country and currency', () => {
  const g = new PaymentGateway();
  const card = new CardGatewayProvider({ apiKey: 'k', merchantId: 'm', endpoint: 'https://x',
    httpClient: async () => ({ status: 200, json: {} }), currencies: ['JMD'], countries: ['JM'] });
  g.register(card);
  assert.strictEqual(g.eligibleMethods({ country: 'JM', currency: 'JMD' }).length, 4);
  assert.strictEqual(g.eligibleMethods({ country: 'US', currency: 'JMD' }).length, 0);
  assert.strictEqual(g.eligibleMethods({ country: 'JM', currency: 'EUR' }).length, 0);
});

test('card gateway maps provider statuses honestly', async () => {
  const responses = { capture: { status: 'declined', reason: 'do_not_honor' } };
  const card = new CardGatewayProvider({ apiKey: 'k', merchantId: 'm', endpoint: 'https://x',
    env: 'sandbox', httpClient: async (m, url) => {
      if (url.endsWith('/capture')) return { status: 200, json: responses.capture };
      return { status: 201, json: { sessionId: 'sess_1', clientSecret: 'cs' } };
    } });
  const intent = await card.createIntent({ idempotencyKey: 'k1', amountMinor: 999, currency: 'JMD' });
  assert.strictEqual(intent.status, 'requires_action');
  assert.strictEqual(intent.environment, 'sandbox');
  const cap = await card.capture('sess_1');
  assert.strictEqual(cap.status, 'failed');
  assert.strictEqual(cap.declineReason, 'do_not_honor');
});

test('paypal order create + capture via injected http (sandbox clearly flagged)', async () => {
  const http = async (method, url) => {
    if (url.endsWith('/oauth2/token')) return { status: 200, json: { access_token: 'tok' } };
    if (url.endsWith('/orders')) return { status: 201, json: { id: 'ORD1' } };
    if (url.endsWith('/capture')) return { status: 201, json: { status: 'COMPLETED',
      purchase_units: [{ payments: { captures: [{ id: 'CAP1' }] } }] } };
    return { status: 404, json: {} };
  };
  const pp = new PayPalProvider({ clientId: 'c', clientSecret: 's', env: 'sandbox', httpClient: http });
  const intent = await pp.createIntent({ idempotencyKey: 'k', amountMinor: 999, currency: 'USD' });
  assert.strictEqual(intent.providerRef, 'ORD1');
  const cap = await pp.capture('ORD1');
  assert.strictEqual(cap.status, 'captured');
  assert.strictEqual(cap.captureId, 'CAP1');
  assert.strictEqual(cap.environment, 'sandbox');
});

test('Jamaican local method stays PENDING and needs authorized manual confirmation', async () => {
  const lynk = new LocalJmProvider({ method: 'lynk', merchantHandle: '@chl-biz' });
  const intent = await lynk.createIntent({ idempotencyKey: 'abc123456789', amountMinor: 150000 });
  assert.strictEqual(intent.status, 'pending');
  assert.strictEqual(intent.requiresManualVerification, true);
  assert.ok(intent.instructions.reference.startsWith('CHL-LYNK-'));
  // reviewer confirmation required
  assert.throws(() => lynk.confirmManual(intent.providerRef, { verified: true }));
  const confirmed = lynk.confirmManual(intent.providerRef, { reviewerId: 'admin:1', verified: true });
  assert.strictEqual(confirmed.status, 'captured');
  assert.strictEqual(confirmed.verifiedBy, 'admin:1');
});
