'use strict';
/**
 * Server-side coin package catalogue. Prices live on the server only; the
 * client never submits a price. These are REFERENCE list prices in the base
 * currency (USD minor units = cents). Taxes/fees and the final charged amount
 * are resolved by the payment provider at checkout — these numbers are not a
 * promise of a tax-inclusive total.
 */

// coins -> reference price in USD cents
const COIN_PACKAGES = Object.freeze([
  { id: 'pkg_100',   coins: 100,   priceMinor: 99,    currency: 'USD' },
  { id: 'pkg_500',   coins: 500,   priceMinor: 499,   currency: 'USD' },
  { id: 'pkg_1000',  coins: 1000,  priceMinor: 999,   currency: 'USD' },
  { id: 'pkg_2500',  coins: 2500,  priceMinor: 2499,  currency: 'USD' },
  { id: 'pkg_5000',  coins: 5000,  priceMinor: 4999,  currency: 'USD' },
  { id: 'pkg_10000', coins: 10000, priceMinor: 9999,  currency: 'USD' },
]);

// Custom top-up limits (configurable by admin in production).
const CUSTOM_LIMITS = Object.freeze({
  minCoins: 50,
  maxCoins: 50000,
  // linear reference rate derived from the 1000-coin package: $0.00999 / coin
  usdCentsPerCoin: 999 / 1000,
});

function getPackage(id) {
  return COIN_PACKAGES.find((p) => p.id === id) || null;
}

module.exports = { COIN_PACKAGES, CUSTOM_LIMITS, getPackage };
