'use strict';
const test = require('node:test');
const assert = require('node:assert');
const { Ledger } = require('../src/ledger/ledger');
const { MemoryStore } = require('../src/ledger/memoryStore');
const { WalletService } = require('../src/wallet/walletService');
const { GiftService } = require('../src/gifts/gifts');

function freshWallet() { return new WalletService(new Ledger(new MemoryStore())); }

test('coins are credited ONLY on captured payment', async () => {
  const w = freshWallet();
  const notCaptured = await w.creditCoinsFromPayment({ userId: '1',
    purchaseRequest: { packageId: 'pkg_1000' },
    confirmation: { status: 'pending', providerRef: 'P1' } });
  assert.strictEqual(notCaptured.credited, false);
  assert.strictEqual(await w.balance('1'), 0);
});

test('frontend-reported success without capture credits nothing', async () => {
  const w = freshWallet();
  const r = await w.creditCoinsFromPayment({ userId: '1',
    purchaseRequest: { packageId: 'pkg_1000' },
    confirmation: { status: 'frontend_says_ok', providerRef: 'P1' } });
  assert.strictEqual(r.credited, false);
});

test('captured payment credits exactly the server-resolved coin amount', async () => {
  const w = freshWallet();
  const r = await w.creditCoinsFromPayment({ userId: '1',
    purchaseRequest: { packageId: 'pkg_2500' },
    confirmation: { status: 'captured', providerRef: 'P2', environment: 'sandbox' } });
  assert.strictEqual(r.credited, true);
  assert.strictEqual(r.coins, 2500);
  assert.strictEqual(await w.balance('1'), 2500);
});

test('duplicate capture webhook never double-credits (idempotent by providerRef)', async () => {
  const w = freshWallet();
  const conf = { status: 'captured', providerRef: 'P3', environment: 'production' };
  const a = await w.creditCoinsFromPayment({ userId: '1', purchaseRequest: { packageId: 'pkg_500' }, confirmation: conf });
  const b = await w.creditCoinsFromPayment({ userId: '1', purchaseRequest: { packageId: 'pkg_500' }, confirmation: conf });
  assert.strictEqual(a.idempotent, false);
  assert.strictEqual(b.idempotent, true);
  assert.strictEqual(await w.balance('1'), 500); // not 1000
});

test('gift debits coins and credits diamonds atomically', async () => {
  const ledger = new Ledger(new MemoryStore());
  const w = new WalletService(ledger);
  const gifts = new GiftService(ledger);
  await w.creditCoinsFromPayment({ userId: 'sender', purchaseRequest: { packageId: 'pkg_1000' },
    confirmation: { status: 'captured', providerRef: 'buy1', environment: 'sandbox' } });
  const res = await gifts.sendGift({ senderId: 'sender', recipientId: 'creator', giftId: 'crown', quantity: 2, eventId: 'g1' });
  assert.strictEqual(res.sent, true);
  assert.strictEqual(res.totalCoins, 200);
  assert.strictEqual(res.totalDiamonds, 120);
  assert.strictEqual(await ledger.balance('user:sender', 'coins'), 800);
  assert.strictEqual(await ledger.balance('user:creator', 'diamonds'), 120);
  assert.strictEqual(await ledger.balance('user:creator', 'coins'), 0); // diamonds != coins
});

test('gift with insufficient coins is rejected, no diamonds minted', async () => {
  const ledger = new Ledger(new MemoryStore());
  const gifts = new GiftService(ledger);
  await assert.rejects(() => gifts.sendGift({ senderId: 'poor', recipientId: 'creator', giftId: 'galaxy', quantity: 1, eventId: 'g2' }));
  assert.strictEqual(await ledger.balance('user:creator', 'diamonds'), 0);
});

test('duplicate gift event is idempotent', async () => {
  const ledger = new Ledger(new MemoryStore());
  const w = new WalletService(ledger);
  const gifts = new GiftService(ledger);
  await w.creditCoinsFromPayment({ userId: 's', purchaseRequest: { packageId: 'pkg_1000' },
    confirmation: { status: 'captured', providerRef: 'buy2', environment: 'sandbox' } });
  await gifts.sendGift({ senderId: 's', recipientId: 'c', giftId: 'heart', quantity: 1, eventId: 'dup-ev' });
  const second = await gifts.sendGift({ senderId: 's', recipientId: 'c', giftId: 'heart', quantity: 1, eventId: 'dup-ev' });
  assert.strictEqual(second.idempotent, true);
  assert.strictEqual(await ledger.balance('user:s', 'coins'), 995); // charged once
});
