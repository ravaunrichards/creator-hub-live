'use strict';
const { resolveCoinPurchase } = require('../pricing/pricing');

/**
 * Wallet service: converts a TRUSTED, server-verified payment confirmation into
 * a coin credit. The only path to new coins is through here, and only when the
 * payment status is a terminal success ('captured').
 *
 * Enforced invariants:
 *  - Coins are credited with allowMint via a double-entry posting that also
 *    records the source transaction (coins debit from a system 'mint' account
 *    so the ledger stays auditable).
 *  - The payment's idempotencyKey is reused as the ledger idempotencyKey, so a
 *    duplicate webhook / retry / refresh can never double-credit.
 *  - Frontend "success" is irrelevant; only `confirmation.status === 'captured'`
 *    credits coins.
 */
class WalletService {
  constructor(ledger) { this.ledger = ledger; }

  async creditCoinsFromPayment({ userId, purchaseRequest, confirmation }) {
    if (!confirmation || confirmation.status !== 'captured') {
      return { credited: false, reason: `payment not captured (status=${confirmation && confirmation.status})` };
    }
    // Re-resolve price server-side; never trust a client-sent coin amount.
    const resolved = resolveCoinPurchase(purchaseRequest);
    const key = `coin_credit:${confirmation.providerRef}`;
    const result = await this.ledger.post({
      idempotencyKey: key,
      kind: 'coin_purchase',
      allowMint: true,
      postings: [
        { accountId: 'system:mint:coins', unit: 'coins', delta: -resolved.coins },
        { accountId: `user:${userId}`, unit: 'coins', delta: resolved.coins },
      ],
      metadata: {
        providerRef: confirmation.providerRef,
        environment: confirmation.environment,
        priceMinor: resolved.priceMinor,
        currency: resolved.currency,
        packageId: resolved.packageId,
      },
    });
    return { credited: true, coins: resolved.coins, idempotent: result.idempotent, ledgerKey: key };
  }

  balance(userId, unit = 'coins') { return this.ledger.balance(`user:${userId}`, unit); }
}

module.exports = { WalletService };
