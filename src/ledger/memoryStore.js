'use strict';
/**
 * In-memory store implementing the Ledger's transactional surface.
 * Used by the automated tests and local dev. Production uses a Postgres store
 * (database/migrations) implementing the identical interface.
 *
 * NOTE: this is a single-process store with a coarse async lock so that
 * concurrent post() calls are serialized the way a real SERIALIZABLE DB
 * transaction would be. It lets the concurrency test exercise real behaviour
 * rather than a fake.
 */

class MemoryStore {
  constructor() {
    this.entries = [];
    this.idempotent = new Map();
    this._lock = Promise.resolve();
  }

  async withTransaction(fn) {
    // Serialize transactions (mimics row-locking / SERIALIZABLE isolation).
    const run = this._lock.then(async () => {
      const snapshotEntries = this.entries.length;
      const added = [];
      const tx = {
        getIdempotent: async (key) => this.idempotent.get(key) || null,
        putIdempotent: async (key, result) => { this.idempotent.set(key, result); },
        appendEntries: async (entries) => { for (const e of entries) added.push(e); },
        getBalance: async (accountId, unit) => {
          let sum = 0;
          for (const e of this.entries) {
            if (e.accountId === accountId && e.unit === unit) sum += e.delta;
          }
          for (const e of added) {
            if (e.accountId === accountId && e.unit === unit) sum += e.delta;
          }
          return sum;
        },
      };
      try {
        const out = await fn(tx);
        // commit
        for (const e of added) this.entries.push(e);
        return out;
      } catch (err) {
        // rollback: discard `added`, restore length defensively
        this.entries.length = Math.min(this.entries.length, snapshotEntries);
        throw err;
      }
    });
    // keep the lock chain alive even on failure
    this._lock = run.then(() => undefined, () => undefined);
    return run;
  }
}

module.exports = { MemoryStore };
