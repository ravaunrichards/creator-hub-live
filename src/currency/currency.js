'use strict';
/**
 * Currency conversion module.
 *
 * Rules enforced:
 *  - We never invent live rates. A rate SOURCE must be supplied; each rate
 *    carries a timestamp. If a rate is older than `maxAgeMs` it is treated as
 *    STALE and conversions return estimate=true with stale=true, never a
 *    silently "fresh" number.
 *  - Conversions are clearly marked as ESTIMATES. The final charged amount is
 *    whatever the payment provider authorizes in the settlement currency.
 *  - Rounding is explicit (half-up to the currency's minor unit).
 */

class CurrencyError extends Error {
  constructor(code, message) { super(message); this.name = 'CurrencyError'; this.code = code; }
}

// Minor-unit exponents for currencies we reference. JMD/USD use 2 decimals.
const MINOR_EXP = { USD: 2, JMD: 2, EUR: 2, GBP: 2, CAD: 2, JPY: 0 };

function minorExp(code) {
  if (!(code in MINOR_EXP)) throw new CurrencyError('UNKNOWN_CURRENCY', `No minor-unit config for ${code}`);
  return MINOR_EXP[code];
}

class CurrencyConverter {
  /**
   * @param {object} opts
   *   opts.rateSource(from,to) -> { rate:number, asOf:ISOstring } | null
   *   opts.maxAgeMs   staleness threshold (default 1h)
   *   opts.now()      injectable clock for tests
   */
  constructor(opts = {}) {
    this.rateSource = opts.rateSource;
    this.maxAgeMs = opts.maxAgeMs || 60 * 60 * 1000;
    this.now = opts.now || (() => Date.now());
    if (typeof this.rateSource !== 'function') {
      throw new CurrencyError('NO_RATE_SOURCE', 'rateSource function is required');
    }
  }

  /**
   * Convert an integer minor-unit amount from one currency to another.
   * Returns an ESTIMATE object; callers must treat `amountMinor` as indicative.
   */
  convert(amountMinor, from, to) {
    if (!Number.isInteger(amountMinor) || amountMinor < 0) {
      throw new CurrencyError('INVALID_AMOUNT', 'amountMinor must be a non-negative integer');
    }
    const fromExp = minorExp(from);
    const toExp = minorExp(to);
    if (from === to) {
      return { amountMinor, currency: to, rate: 1, asOf: null, estimate: false, stale: false };
    }
    const quote = this.rateSource(from, to);
    if (!quote || typeof quote.rate !== 'number' || !quote.asOf) {
      return { amountMinor: null, currency: to, rate: null, asOf: null,
        estimate: true, stale: true, unavailable: true };
    }
    const ageMs = this.now() - Date.parse(quote.asOf);
    const stale = ageMs > this.maxAgeMs;

    // Convert through major units to keep differing minor exponents correct.
    const major = amountMinor / Math.pow(10, fromExp);
    const convertedMajor = major * quote.rate;
    const amountOut = Math.round(convertedMajor * Math.pow(10, toExp)); // half-up

    return { amountMinor: amountOut, currency: to, rate: quote.rate, asOf: quote.asOf,
      estimate: true, stale, unavailable: false };
  }
}

module.exports = { CurrencyConverter, CurrencyError, MINOR_EXP };
