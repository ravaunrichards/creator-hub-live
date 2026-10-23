'use strict';
/**
 * Server-authoritative price resolution. The client sends a package id OR a
 * requested custom coin amount — NEVER a price. The server computes the amount
 * to charge. This prevents client-side price tampering.
 */
const { getPackage, CUSTOM_LIMITS } = require('./coinPackages');

class PricingError extends Error {
  constructor(code, message) { super(message); this.name = 'PricingError'; this.code = code; }
}

/**
 * Resolve a coin purchase to an authoritative { coins, priceMinor, currency }.
 * @param {object} req { packageId?: string, customCoins?: number }
 */
function resolveCoinPurchase(req) {
  if (req.packageId) {
    const pkg = getPackage(req.packageId);
    if (!pkg) throw new PricingError('UNKNOWN_PACKAGE', `No such coin package: ${req.packageId}`);
    return { coins: pkg.coins, priceMinor: pkg.priceMinor, currency: pkg.currency, packageId: pkg.id };
  }
  if (typeof req.customCoins === 'number') {
    const coins = req.customCoins;
    if (!Number.isInteger(coins)) throw new PricingError('INVALID_AMOUNT', 'customCoins must be an integer');
    if (coins < CUSTOM_LIMITS.minCoins || coins > CUSTOM_LIMITS.maxCoins) {
      throw new PricingError('OUT_OF_RANGE',
        `customCoins must be between ${CUSTOM_LIMITS.minCoins} and ${CUSTOM_LIMITS.maxCoins}`);
    }
    // round half-up to the nearest cent
    const priceMinor = Math.round(coins * CUSTOM_LIMITS.usdCentsPerCoin);
    return { coins, priceMinor, currency: 'USD', packageId: null };
  }
  throw new PricingError('NO_SELECTION', 'Provide packageId or customCoins');
}

module.exports = { resolveCoinPurchase, PricingError };
