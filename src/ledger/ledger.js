'use strict';
/**
 * Creator Hub Live Next — server-authoritative ledger.
 *
 * Design rules enforced here (see docs/ARCHITECTURE.md):
 *  - Balances are NEVER trusted from the client. They are derived from an
 *    append-only double-entry ledger.
 *  - Balance TYPES are kept strictly separate and are NOT interchangeable:
 *    coins, diamonds, league_points, ad_credits, cash. Converting between
 *    them requires an explicit, rule-checked operation (not done here).
 *  - Every mutating operation requires an idempotency key. Re-applying the
 *    same key is a no-op that returns the original result (duplicate webhook /
 *    retry / refresh safety).
 *  - Credits and debits within one operation are atomic: either all postings
 *    commit or none do.
 *
 * This module is storage-agnostic. It talks to a `store` object that provides
 * the small transactional surface below so it can run against an in-memory
 * store (tests) or a Postgres-backed store (production) unchanged.
 *
 *   store.withTransaction(fn)      -> runs fn(tx) atomically
 *   tx.getIdempotent(key)          -> stored result | null
 *   tx.putIdempotent(key, result)
 *   tx.appendEntries(entries[])    -> void
 *   tx.getBalance(accountId, unit) -> integer (minor units / whole coins)
 */

const UNITS = Object.freeze(['coins', 'diamonds', 'league_points', 'ad_credits', 'cash']);

class LedgerError extends Error {
  constructor(code, message) {
    super(message);
    this.name = 'LedgerError';
    this.code = code;
  }
}

function assertUnit(unit) {
  if (!UNITS.includes(unit)) {
    throw new LedgerError('INVALID_UNIT', `Unknown balance unit: ${unit}`);
  }
}

function assertPositiveInt(amount, label) {
  if (!Number.isInteger(amount) || amount <= 0) {
    throw new LedgerError('INVALID_AMOUNT', `${label} must be a positive integer, got ${amount}`);
  }
}

class Ledger {
  constructor(store) {
    if (!store) throw new LedgerError('NO_STORE', 'Ledger requires a store');
    this.store = store;
  }

  /**
   * Post a balanced set of entries. `postings` is an array of
   *   { accountId, unit, delta }  (delta may be + or -, integer, non-zero)
   * The sum of deltas PER UNIT must be zero (double-entry invariant) unless
   * `allowMint` is true (used only for provider-confirmed external value
   * entering the system, e.g. a captured card payment crediting coins).
   */
  async post({ idempotencyKey, kind, postings, metadata = {}, allowMint = false }) {
    if (!idempotencyKey || typeof idempotencyKey !== 'string') {
      throw new LedgerError('NO_IDEMPOTENCY_KEY', 'idempotencyKey is required');
    }
    if (!Array.isArray(postings) || postings.length === 0) {
      throw new LedgerError('NO_POSTINGS', 'postings must be a non-empty array');
    }

    return this.store.withTransaction(async (tx) => {
      const existing = await tx.getIdempotent(idempotencyKey);
      if (existing) return { ...existing, idempotent: true };

      // Validate and compute per-unit sums + required debits.
      const perUnitSum = {};
      for (const p of postings) {
        assertUnit(p.unit);
        if (!Number.isInteger(p.delta) || p.delta === 0) {
          throw new LedgerError('INVALID_DELTA', `delta must be a non-zero integer for ${p.accountId}/${p.unit}`);
        }
        perUnitSum[p.unit] = (perUnitSum[p.unit] || 0) + p.delta;
      }

      if (!allowMint) {
        for (const unit of Object.keys(perUnitSum)) {
          if (perUnitSum[unit] !== 0) {
            throw new LedgerError('UNBALANCED', `postings for unit ${unit} do not sum to zero (${perUnitSum[unit]})`);
          }
        }
      }

      // Reject any debit that would drive a USER balance negative. System
      // accounts (system:mint:* / system:sink:*) represent platform issuance
      // and are intentionally allowed to run negative, exactly like an
      // issuance/equity account in double-entry bookkeeping.
      const balanceCache = {};
      for (const p of postings) {
        if (p.delta < 0 && !p.accountId.startsWith('system:')) {
          const cacheKey = `${p.accountId}:${p.unit}`;
          if (!(cacheKey in balanceCache)) {
            balanceCache[cacheKey] = await tx.getBalance(p.accountId, p.unit);
          }
          const projected = balanceCache[cacheKey] + p.delta;
          if (projected < 0) {
            throw new LedgerError('INSUFFICIENT_FUNDS',
              `insufficient ${p.unit} for ${p.accountId}: have ${balanceCache[cacheKey]}, need ${-p.delta}`);
          }
          balanceCache[cacheKey] = projected;
        }
      }

      const ts = new Date().toISOString();
      const entries = postings.map((p, i) => ({
        idempotencyKey,
        kind,
        accountId: p.accountId,
        unit: p.unit,
        delta: p.delta,
        metadata,
        seq: i,
        createdAt: ts,
      }));
      await tx.appendEntries(entries);

      const result = { idempotencyKey, kind, postings, createdAt: ts, idempotent: false };
      await tx.putIdempotent(idempotencyKey, result);
      return result;
    });
  }

  async balance(accountId, unit) {
    assertUnit(unit);
    return this.store.withTransaction((tx) => tx.getBalance(accountId, unit));
  }
}

module.exports = { Ledger, LedgerError, UNITS };
