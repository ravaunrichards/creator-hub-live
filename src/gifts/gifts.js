'use strict';
/**
 * Virtual gifting economy.
 *  - Gift prices are authoritative server data (catalogue below).
 *  - Sending a gift ATOMICALLY debits the sender's coins and credits the
 *    recipient's diamonds at the configured conversion for THIS gift. Coins and
 *    diamonds are separate units and are never implicitly equal to cash.
 *  - A gift is only "sent" after the ledger posting commits.
 */
const GIFT_CATALOGUE = Object.freeze([
  { id: 'spark',    name: 'Spark',        coins: 1,    diamonds: 1,   asset: 'spark.glb' },
  { id: 'heart',    name: 'Glow Heart',  coins: 5,    diamonds: 3,   asset: 'heart.glb' },
  { id: 'crown',    name: 'Royal Crown', coins: 100,  diamonds: 60,  asset: 'crown.glb' },
  { id: 'rocket',   name: 'Star Rocket', coins: 500,  diamonds: 300, asset: 'rocket.glb' },
  { id: 'galaxy',   name: 'Galaxy',      coins: 2000, diamonds: 1200, asset: 'galaxy.glb' },
]);

function getGift(id) { return GIFT_CATALOGUE.find((g) => g.id === id) || null; }

class GiftService {
  constructor(ledger) { this.ledger = ledger; }

  async sendGift({ senderId, recipientId, giftId, quantity = 1, eventId }) {
    if (!Number.isInteger(quantity) || quantity <= 0) throw new Error('quantity must be a positive integer');
    if (senderId === recipientId) throw new Error('cannot send a gift to yourself');
    const gift = getGift(giftId);
    if (!gift) throw new Error(`unknown gift: ${giftId}`);
    const totalCoins = gift.coins * quantity;
    const totalDiamonds = gift.diamonds * quantity;
    const key = `gift:${eventId || `${senderId}:${recipientId}:${giftId}:${Date.now()}`}`;

    const result = await this.ledger.post({
      idempotencyKey: key,
      kind: 'gift_send',
      postings: [
        { accountId: `user:${senderId}`, unit: 'coins', delta: -totalCoins },
        { accountId: 'system:sink:coins', unit: 'coins', delta: totalCoins },
        // diamonds minted to recipient as creator earnings (separate unit)
        { accountId: 'system:mint:diamonds', unit: 'diamonds', delta: -totalDiamonds },
        { accountId: `user:${recipientId}`, unit: 'diamonds', delta: totalDiamonds },
      ],
      allowMint: true,
      metadata: { giftId, quantity, totalCoins, totalDiamonds },
    });
    return { sent: true, giftId, quantity, totalCoins, totalDiamonds, idempotent: result.idempotent };
  }
}

module.exports = { GIFT_CATALOGUE, getGift, GiftService };
