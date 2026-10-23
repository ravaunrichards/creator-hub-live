'use strict';
const test = require('node:test');
const assert = require('node:assert');
const { Ledger, LedgerError } = require('../src/ledger/ledger');
const { MemoryStore } = require('../src/ledger/memoryStore');

test('balanced transfer moves coins between two users', async () => {
  const l = new Ledger(new MemoryStore());
  await l.post({ idempotencyKey: 'seed', kind: 'seed', allowMint: true,
    postings: [{ accountId: 'system:mint:coins', unit: 'coins', delta: -100 },
               { accountId: 'user:a', unit: 'coins', delta: 100 }] });
  await l.post({ idempotencyKey: 't1', kind: 'transfer',
    postings: [{ accountId: 'user:a', unit: 'coins', delta: -40 },
               { accountId: 'user:b', unit: 'coins', delta: 40 }] });
  assert.strictEqual(await l.balance('user:a', 'coins'), 60);
  assert.strictEqual(await l.balance('user:b', 'coins'), 40);
});

test('idempotency key replays the original result and does NOT double-apply', async () => {
  const l = new Ledger(new MemoryStore());
  await l.post({ idempotencyKey: 'seed', kind: 'seed', allowMint: true,
    postings: [{ accountId: 'system:mint:coins', unit: 'coins', delta: -100 },
               { accountId: 'user:a', unit: 'coins', delta: 100 }] });
  const first = await l.post({ idempotencyKey: 'dup', kind: 'transfer',
    postings: [{ accountId: 'user:a', unit: 'coins', delta: -10 },
               { accountId: 'user:b', unit: 'coins', delta: 10 }] });
  const second = await l.post({ idempotencyKey: 'dup', kind: 'transfer',
    postings: [{ accountId: 'user:a', unit: 'coins', delta: -10 },
               { accountId: 'user:b', unit: 'coins', delta: 10 }] });
  assert.strictEqual(first.idempotent, false);
  assert.strictEqual(second.idempotent, true);
  assert.strictEqual(await l.balance('user:a', 'coins'), 90);
  assert.strictEqual(await l.balance('user:b', 'coins'), 10);
});

test('insufficient funds is rejected and nothing commits (atomicity)', async () => {
  const l = new Ledger(new MemoryStore());
  await l.post({ idempotencyKey: 'seed', kind: 'seed', allowMint: true,
    postings: [{ accountId: 'system:mint:coins', unit: 'coins', delta: -5 },
               { accountId: 'user:a', unit: 'coins', delta: 5 }] });
  await assert.rejects(() => l.post({ idempotencyKey: 'x', kind: 'transfer',
    postings: [{ accountId: 'user:a', unit: 'coins', delta: -10 },
               { accountId: 'user:b', unit: 'coins', delta: 10 }] }),
    (e) => e instanceof LedgerError && e.code === 'INSUFFICIENT_FUNDS');
  assert.strictEqual(await l.balance('user:a', 'coins'), 5);
  assert.strictEqual(await l.balance('user:b', 'coins'), 0);
});

test('unbalanced non-mint postings are rejected', async () => {
  const l = new Ledger(new MemoryStore());
  await assert.rejects(() => l.post({ idempotencyKey: 'u', kind: 'bad',
    postings: [{ accountId: 'user:a', unit: 'coins', delta: 10 }] }),
    (e) => e.code === 'UNBALANCED');
});

test('balance units are kept separate (coins != diamonds)', async () => {
  const l = new Ledger(new MemoryStore());
  await l.post({ idempotencyKey: 's', kind: 'seed', allowMint: true,
    postings: [{ accountId: 'system:mint:coins', unit: 'coins', delta: -10 },
               { accountId: 'user:a', unit: 'coins', delta: 10 },
               { accountId: 'system:mint:diamonds', unit: 'diamonds', delta: -7 },
               { accountId: 'user:a', unit: 'diamonds', delta: 7 }] });
  assert.strictEqual(await l.balance('user:a', 'coins'), 10);
  assert.strictEqual(await l.balance('user:a', 'diamonds'), 7);
});

test('concurrent debits cannot overspend', async () => {
  const l = new Ledger(new MemoryStore());
  await l.post({ idempotencyKey: 'seed', kind: 'seed', allowMint: true,
    postings: [{ accountId: 'system:mint:coins', unit: 'coins', delta: -100 },
               { accountId: 'user:a', unit: 'coins', delta: 100 }] });
  const attempts = Array.from({ length: 20 }, (_, i) => l.post({
    idempotencyKey: `c${i}`, kind: 'spend',
    postings: [{ accountId: 'user:a', unit: 'coins', delta: -10 },
               { accountId: 'system:sink:coins', unit: 'coins', delta: 10 }] })
    .then(() => true).catch(() => false));
  const results = await Promise.all(attempts);
  const ok = results.filter(Boolean).length;
  assert.strictEqual(ok, 10); // exactly 100/10 succeed
  assert.strictEqual(await l.balance('user:a', 'coins'), 0);
});
