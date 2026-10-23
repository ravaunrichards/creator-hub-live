'use strict';
// Foreground smoke test: boots the API in-process, exercises real endpoints,
// asserts results, then exits. No background daemon.
const http = require('http');
const { server } = require('../src/http/server');

function req(method, path, { body, userId } = {}) {
  return new Promise((resolve, reject) => {
    const data = body ? JSON.stringify(body) : null;
    const headers = { 'Content-Type': 'application/json' };
    if (userId) headers['x-user-id'] = userId;
    const addr = server.address();
    const r = http.request({ host: '127.0.0.1', port: addr.port, path, method, headers }, (res) => {
      let d = ''; res.on('data', (c) => (d += c));
      res.on('end', () => resolve({ status: res.statusCode, json: d ? JSON.parse(d) : null }));
    });
    r.on('error', reject);
    if (data) r.write(data);
    r.end();
  });
}

(async () => {
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  const out = [];
  const health = await req('GET', '/api/health');
  out.push(['health', health.json.ok === true]);

  const methods = await req('GET', '/api/payments/methods?country=JM&currency=JMD');
  // No providers configured in this env -> empty list (honest).
  out.push(['no-unconfigured-methods', Array.isArray(methods.json.methods) && methods.json.methods.length === 0]);

  const unauth = await req('GET', '/api/wallet/balance');
  out.push(['auth-required', unauth.status === 401]);

  const cap = await req('POST', '/api/payments/dev-capture', { userId: 'u1',
    body: { purchaseRequest: { packageId: 'pkg_2500' },
      confirmation: { status: 'captured', providerRef: 'DEV1', environment: 'sandbox' } } });
  out.push(['coins-credited-on-capture', cap.json.credited === true && cap.json.coins === 2500]);

  const dup = await req('POST', '/api/payments/dev-capture', { userId: 'u1',
    body: { purchaseRequest: { packageId: 'pkg_2500' },
      confirmation: { status: 'captured', providerRef: 'DEV1', environment: 'sandbox' } } });
  out.push(['duplicate-capture-idempotent', dup.json.idempotent === true]);

  const bal = await req('GET', '/api/wallet/balance', { userId: 'u1' });
  out.push(['balance-not-double-credited', bal.json.coins === 2500]);

  const gift = await req('POST', '/api/gifts/send', { userId: 'u1',
    body: { recipientId: 'c1', giftId: 'crown', quantity: 1, eventId: 'ev1' } });
  out.push(['gift-sent', gift.json.sent === true && gift.json.totalCoins === 100]);

  const bal2 = await req('GET', '/api/wallet/balance', { userId: 'u1' });
  out.push(['coins-debited-after-gift', bal2.json.coins === 2400]);

  server.close();
  let allOk = true;
  for (const [name, ok] of out) { console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}`); if (!ok) allOk = false; }
  console.log(allOk ? '\nSMOKE: ALL PASS' : '\nSMOKE: FAILURES');
  process.exit(allOk ? 0 : 1);
})().catch((e) => { console.error(e); process.exit(1); });
