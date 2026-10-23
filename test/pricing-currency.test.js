'use strict';
const test = require('node:test');
const assert = require('node:assert');
const { resolveCoinPurchase, PricingError } = require('../src/pricing/pricing');
const { CurrencyConverter } = require('../src/currency/currency');

test('package pricing is server-authoritative', () => {
  const r = resolveCoinPurchase({ packageId: 'pkg_1000' });
  assert.strictEqual(r.coins, 1000);
  assert.strictEqual(r.priceMinor, 999);
  assert.strictEqual(r.currency, 'USD');
});

test('unknown package rejected', () => {
  assert.throws(() => resolveCoinPurchase({ packageId: 'nope' }), (e) => e.code === 'UNKNOWN_PACKAGE');
});

test('custom coin amount respects configurable limits', () => {
  assert.throws(() => resolveCoinPurchase({ customCoins: 1 }), (e) => e.code === 'OUT_OF_RANGE');
  assert.throws(() => resolveCoinPurchase({ customCoins: 999999 }), (e) => e.code === 'OUT_OF_RANGE');
  const r = resolveCoinPurchase({ customCoins: 1000 });
  assert.strictEqual(r.coins, 1000);
  assert.strictEqual(r.priceMinor, 999);
});

test('a client-sent price is ignored (only coins/packageId are honored)', () => {
  const r = resolveCoinPurchase({ packageId: 'pkg_100', priceMinor: 1 });
  assert.strictEqual(r.priceMinor, 99); // not 1
});

test('currency conversion marks estimates and timestamps', () => {
  const now = Date.parse('2026-10-23T00:00:00Z');
  const c = new CurrencyConverter({ now: () => now, maxAgeMs: 3600000,
    rateSource: (f, t) => (f === 'USD' && t === 'JMD'
      ? { rate: 157.5, asOf: '2026-10-22T23:30:00Z' } : null) });
  const r = c.convert(999, 'USD', 'JMD'); // $9.99 -> JMD
  assert.strictEqual(r.estimate, true);
  assert.strictEqual(r.stale, false);
  assert.strictEqual(r.amountMinor, Math.round(9.99 * 157.5 * 100));
  assert.ok(r.asOf);
});

test('stale rate is flagged, not silently used as fresh', () => {
  const now = Date.parse('2026-10-23T00:00:00Z');
  const c = new CurrencyConverter({ now: () => now, maxAgeMs: 3600000,
    rateSource: () => ({ rate: 157.5, asOf: '2026-10-22T10:00:00Z' }) });
  const r = c.convert(999, 'USD', 'JMD');
  assert.strictEqual(r.stale, true);
});

test('unavailable rate returns unavailable, never a fabricated number', () => {
  const c = new CurrencyConverter({ rateSource: () => null });
  const r = c.convert(100, 'USD', 'JMD');
  assert.strictEqual(r.unavailable, true);
  assert.strictEqual(r.amountMinor, null);
});

test('same-currency conversion is exact, not an estimate', () => {
  const c = new CurrencyConverter({ rateSource: () => null });
  const r = c.convert(500, 'USD', 'USD');
  assert.strictEqual(r.estimate, false);
  assert.strictEqual(r.amountMinor, 500);
});
