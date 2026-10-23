'use strict';
/**
 * Creator Hub Live Next — minimal zero-dependency HTTP API wiring the
 * server-authoritative financial core. Uses node:http so it runs offline with
 * no npm install.
 *
 * SECURITY NOTE (read before deploying): this reference server uses a STUB
 * auth header (x-user-id) and an in-memory ledger store so the flows are
 * runnable without a database. It is NOT production-ready as-is:
 *   - Replace stubAuth() with real JWT/session verification.
 *   - Replace MemoryStore with the Postgres store backed by
 *     database/migrations (RLS + service-role on the server only).
 *   - Terminate TLS and bind behind a reverse proxy.
 * It binds to 127.0.0.1 only.
 */
const http = require('http');
const { Ledger } = require('../ledger/ledger');
const { MemoryStore } = require('../ledger/memoryStore');
const { WalletService } = require('../wallet/walletService');
const { GiftService } = require('../gifts/gifts');
const { PaymentGateway } = require('../payments/gateway');
const { PayPalProvider } = require('../payments/providers/paypal');
const { CardGatewayProvider } = require('../payments/providers/cardGateway');
const { LocalJmProvider } = require('../payments/providers/localJm');
const { COIN_PACKAGES } = require('../pricing/coinPackages');
const { resolveCoinPurchase } = require('../pricing/pricing');

const ledger = new Ledger(new MemoryStore());
const wallet = new WalletService(ledger);
const gifts = new GiftService(ledger);

// Build gateway from env. Providers only become "eligible" when configured.
const gateway = new PaymentGateway()
  .register(new PayPalProvider({
    clientId: process.env.PAYPAL_CLIENT_ID,
    clientSecret: process.env.PAYPAL_CLIENT_SECRET,
    env: process.env.PAYPAL_ENV || 'sandbox',
    httpClient: undefined, // inject a real fetch-based client in production
  }))
  .register(new CardGatewayProvider({
    apiKey: process.env.CARD_GATEWAY_API_KEY,
    merchantId: process.env.CARD_GATEWAY_MERCHANT_ID,
    endpoint: process.env.CARD_GATEWAY_ENDPOINT,
    env: process.env.CARD_GATEWAY_ENV || 'sandbox',
    httpClient: undefined,
  }))
  .register(new LocalJmProvider({
    method: 'lynk',
    merchantHandle: process.env.LYNK_MERCHANT_HANDLE,
    env: process.env.LOCAL_ENV || 'sandbox',
  }));

function stubAuth(req) {
  // TODO: replace with real JWT/session verification.
  return req.headers['x-user-id'] || null;
}

function send(res, code, body) {
  const payload = JSON.stringify(body);
  res.writeHead(code, { 'Content-Type': 'application/json' });
  res.end(payload);
}

function readBody(req) {
  return new Promise((resolve) => {
    let data = '';
    req.on('data', (c) => { data += c; if (data.length > 1e6) req.destroy(); });
    req.on('end', () => { try { resolve(data ? JSON.parse(data) : {}); } catch { resolve({}); } });
  });
}

const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url, 'http://127.0.0.1');
    const p = url.pathname;

    if (req.method === 'GET' && p === '/api/health') return send(res, 200, { ok: true });

    if (req.method === 'GET' && p === '/api/coin-packages') {
      return send(res, 200, { packages: COIN_PACKAGES });
    }

    // Eligible, CONFIGURED payment methods for this context only.
    if (req.method === 'GET' && p === '/api/payments/methods') {
      const methods = gateway.eligibleMethods({
        country: url.searchParams.get('country'),
        currency: url.searchParams.get('currency'),
        txType: url.searchParams.get('txType') || 'coin_purchase',
      });
      return send(res, 200, { methods });
    }

    const userId = stubAuth(req);
    if (!userId) return send(res, 401, { error: 'unauthorized' });

    if (req.method === 'GET' && p === '/api/wallet/balance') {
      return send(res, 200, {
        coins: await wallet.balance(userId, 'coins'),
        diamonds: await wallet.balance(userId, 'diamonds'),
      });
    }

    // Create a coin-purchase intent. Server resolves the price; client never sends one.
    if (req.method === 'POST' && p === '/api/payments/intent') {
      const body = await readBody(req);
      const resolved = resolveCoinPurchase(body.purchaseRequest || {});
      // In production: const intent = await gateway.createIntent(body.providerId, {...})
      return send(res, 200, {
        resolved,
        note: 'Create the provider intent server-side, then capture via webhook. '
          + 'Coins are credited only on a verified captured status.',
      });
    }

    // Simulated capture->credit path for local dev (REAL credit logic, stub confirmation).
    if (req.method === 'POST' && p === '/api/payments/dev-capture') {
      const body = await readBody(req);
      const result = await wallet.creditCoinsFromPayment({
        userId,
        purchaseRequest: body.purchaseRequest || {},
        confirmation: body.confirmation || {},
      });
      return send(res, 200, result);
    }

    if (req.method === 'POST' && p === '/api/gifts/send') {
      const body = await readBody(req);
      const result = await gifts.sendGift({ senderId: userId, ...body });
      return send(res, 200, result);
    }

    return send(res, 404, { error: 'not found' });
  } catch (err) {
    return send(res, 400, { error: err.code || 'bad_request', message: err.message });
  }
});

if (require.main === module) {
  const port = Number(process.env.PORT) || 8080;
  server.listen(port, '127.0.0.1', () => {
    // eslint-disable-next-line no-console
    console.log(`CHL Next API (reference) listening on http://127.0.0.1:${port}`);
  });
}

module.exports = { server, gateway, wallet, gifts, ledger };
