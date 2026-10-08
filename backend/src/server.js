import 'dotenv/config';
import http from 'node:http';
import { URL } from 'node:url';
import { createClient } from '@supabase/supabase-js';
import { createLiveKitToken, validateRoomName, livekitHealth, verifyHostPublishing } from './livekit-token.js';

const PORT = Number(process.env.PORT || 3000);
const FRONTEND_URL = String(process.env.FRONTEND_URL || process.env.NEXT_PUBLIC_APP_URL || '').replace(/\/$/, '');
const SUPABASE_URL = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || process.env.SUPABASE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const PAYPAL_ENV = String(process.env.PAYPAL_ENV || process.env.PAYPAL_MODE || 'sandbox').toLowerCase();
const PAYPAL_CLIENT_ID = process.env.PAYPAL_CLIENT_ID;
const PAYPAL_CLIENT_SECRET = process.env.PAYPAL_CLIENT_SECRET;
const PAYPAL_WEBHOOK_ID = process.env.PAYPAL_WEBHOOK_ID;
const PAYPAL_BASE = PAYPAL_ENV === 'live' ? 'https://api-m.paypal.com' : 'https://api-m.sandbox.paypal.com';
const PAYPAL_RETURN_URL = String(process.env.PAYPAL_RETURN_URL || (FRONTEND_URL ? FRONTEND_URL.split(',')[0] : '') || '').replace(/\/$/, '');
const LIVEKIT_URL = process.env.LIVEKIT_URL || 'wss://creator-hub-live-9susyfri.livekit.cloud';

function fail(status, code, message, details) { const e = new Error(message); e.status = status; e.code = code; e.details = details; return e; }
function secureHeaders(extra = {}) { return { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff', 'X-Frame-Options': 'DENY', 'Referrer-Policy': 'no-referrer', ...extra }; }
function send(res, status, body, extra = {}) { res.writeHead(status, secureHeaders(extra)); res.end(JSON.stringify(body)); }
function ok(res, body) { return send(res, 200, { ok: true, ...body }); }
function errorResponse(res, error) { const e = error instanceof Error ? error : new Error(String(error)); const status = e.status || 500; return send(res, status, { ok: false, code: e.code || 'INTERNAL_ERROR', error: status >= 500 ? (e.message || 'Internal server error.') : e.message, details: e.details || undefined }); }
function allowedOrigin(origin) { if (!origin) return true; const list = FRONTEND_URL.split(',').map(x => x.trim()).filter(Boolean); return list.length ? list.includes(origin) : origin === `http://localhost:${PORT}` || origin === `http://127.0.0.1:${PORT}`; }
function applyCors(req, res) { const origin = req.headers.origin; if (origin && allowedOrigin(origin)) res.setHeader('Access-Control-Allow-Origin', origin); res.setHeader('Vary', 'Origin'); res.setHeader('Access-Control-Allow-Headers', 'Authorization, Content-Type, Idempotency-Key, PayPal-Request-Id, X-Requested-With'); res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS'); }
async function readJson(req) { let raw = ''; for await (const chunk of req) raw += chunk; if (!raw.trim()) return {}; try { return JSON.parse(raw); } catch { throw fail(400, 'INVALID_JSON', 'Request body must be valid JSON.'); } }
function requireServerConfig(keys) { const missing = keys.filter(k => !process.env[k]); if (missing.length) throw fail(503, 'REQUIRES_CONFIGURATION', 'Backend configuration is incomplete.', { missing }); }
function db() { requireServerConfig(['SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY']); return createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, { auth: { autoRefreshToken: false, persistSession: false } }); }
async function requireSupabaseUser(req) { requireServerConfig(['SUPABASE_URL', 'SUPABASE_ANON_KEY']); const h = req.headers.authorization || ''; if (!h.startsWith('Bearer ')) throw fail(401, 'AUTH_REQUIRED', 'Authentication required.'); const token = h.slice(7).trim(); if (!token) throw fail(401, 'AUTH_REQUIRED', 'Authentication required.'); const authClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, { auth: { autoRefreshToken: false, persistSession: false } }); const { data, error } = await authClient.auth.getUser(token); if (error || !data?.user) throw fail(401, 'AUTH_REQUIRED', 'Invalid or expired Supabase session.'); return data.user; }
async function profileFor(user) { const { data, error } = await db().from('profiles').select('id,username,display_name,is_admin').eq('id', user.id).maybeSingle(); if (error) throw error; return data || { id: user.id, is_admin: false }; }
async function requireAdmin(req) { const user = await requireSupabaseUser(req); const p = await profileFor(user); if (!p.is_admin) throw fail(403, 'FORBIDDEN', 'Administrator permission is required.'); return user; }
function requireIdem(req) { const key = String(req.headers['idempotency-key'] || '').trim(); if (!key || key.length < 16 || key.length > 200) throw fail(400, 'PAYMENT_DUPLICATE', 'A unique Idempotency-Key with 16-200 characters is required.'); return key; }
function clampLimit(v, def, max) { const n = Number(v); if (!Number.isFinite(n) || n <= 0) return def; return Math.min(Math.floor(n), max); }

// ---------------------------------------------------------------------------
// PayPal (server-authoritative). Secrets never leave the backend process.
// ---------------------------------------------------------------------------
async function paypalToken() { requireServerConfig(['PAYPAL_CLIENT_ID', 'PAYPAL_CLIENT_SECRET']); const auth = Buffer.from(`${PAYPAL_CLIENT_ID}:${PAYPAL_CLIENT_SECRET}`).toString('base64'); const r = await fetch(`${PAYPAL_BASE}/v1/oauth2/token`, { method: 'POST', headers: { Authorization: `Basic ${auth}`, 'Content-Type': 'application/x-www-form-urlencoded' }, body: 'grant_type=client_credentials' }); const text = await r.text(); if (!r.ok) throw fail(502, 'PAYMENT_PROVIDER_ERROR', `PayPal OAuth failed (${r.status}).`); let d; try { d = JSON.parse(text); } catch { throw fail(502, 'PAYMENT_PROVIDER_ERROR', 'PayPal OAuth returned an invalid response.'); } return d.access_token; }
async function paypal(path, options = {}) { const token = await paypalToken(); const headers = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', ...(options.headers || {}) }; const r = await fetch(`${PAYPAL_BASE}${path}`, { ...options, headers }); const text = await r.text(); let d = {}; try { d = text ? JSON.parse(text) : {}; } catch { d = {}; } if (!r.ok) throw fail(502, 'PAYMENT_PROVIDER_ERROR', d?.message || `PayPal request failed (${r.status}).`, { paypalStatus: r.status }); return d; }
async function paymentByOrder(client, orderId) { const { data, error } = await client.from('payments').select('*').eq('provider_order_id', orderId).maybeSingle(); if (error) throw error; if (!data) throw fail(404, 'PAYMENT_FAILED', 'Payment order was not found.'); return data; }
async function creditCapture(client, payment, captureId) { if (!captureId) throw fail(502, 'PAYMENT_VERIFICATION_FAILED', 'PayPal capture ID was not returned.'); const idem = `paypal:capture:${captureId}`; const { error } = await client.rpc('credit_coins', { p_user: payment.user_id, p_amount: payment.package_coins, p_source: 'paypal', p_provider: 'paypal', p_reference: captureId, p_reason: `PayPal coin purchase ${payment.provider_order_id}`, p_idempotency_key: idem }); if (error) throw error; const { error: updateError } = await client.from('payments').update({ provider_capture_id: captureId, status: 'completed', credited: true, updated_at: new Date().toISOString() }).eq('id', payment.id); if (updateError) throw updateError; return true; }
async function coinPackage(client, coins) { const { data, error } = await client.from('coin_packages').select('*').eq('coins', coins).eq('active', true).maybeSingle(); if (error) throw error; if (!data) throw fail(400, 'INVALID_PACKAGE', 'The requested coin package is not available.'); return data; }
async function ensureWallet(client, userId) { const { error } = await client.from('wallets').upsert({ user_id: userId }, { onConflict: 'user_id', ignoreDuplicates: true }); if (error) throw error; }
async function walletFor(client, userId) { await ensureWallet(client, userId); const { data, error } = await client.from('wallets').select('coin_balance,diamond_balance,lifetime_gifts_sent').eq('user_id', userId).maybeSingle(); if (error) throw error; return data || { coin_balance: 0, diamond_balance: 0, lifetime_gifts_sent: 0 }; }

// Resolve a path like /api/live/rooms/<id>/start into { id, action }.
function liveRoomParts(pathname) { const m = pathname.match(/^\/api\/live\/rooms(?:\/([^/]+))?(?:\/(join|start|end|leave))?\/?$/); if (!m) return null; return { id: m[1] ? decodeURIComponent(m[1]) : null, action: m[2] || null }; }
async function liveRoomById(client, id) { const { data, error } = await client.from('live_sessions').select('*').eq('id', id).maybeSingle(); if (error) throw error; if (!data) throw fail(404, 'LIVE_ROOM_NOT_FOUND', 'LIVE room not found.'); return data; }

// ===========================================================================
// HTTP router. Real server-authoritative handlers backed by Supabase + PayPal
// + LiveKit. No fake data; missing credentials surface as REQUIRES_CONFIGURATION.
// ===========================================================================
const server = http.createServer(async (req, res) => {
  applyCors(req, res);
  const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  const pathname = url.pathname.replace(/\/+$/, '') || '/';
  const method = req.method;
  if (method === 'OPTIONS') { res.writeHead(204, secureHeaders()); return res.end(); }

  try {
    // ---- Infrastructure -------------------------------------------------
    if (pathname === '/api/health' && method === 'GET') {
      return ok(res, { status: 'operational', livekit: livekitHealth(), time: new Date().toISOString() });
    }
    if (pathname === '/api/livekit/health' && method === 'GET') {
      return ok(res, { livekit: livekitHealth() });
    }

    // ---- LiveKit participant token (contract: FE sends roomId) ----------
    if (pathname === '/api/livekit/token' && method === 'POST') {
      const user = await requireSupabaseUser(req);
      const body = await readJson(req);
      const client = db();
      let roomName = null, canPublish = false;
      const roomId = body.roomId ? String(body.roomId).trim() : null;
      if (roomId) {
        const room = await liveRoomById(client, roomId);
        roomName = room.room_name;
        canPublish = room.host_id === user.id;
      } else if (body.roomName && validateRoomName(body.roomName)) {
        roomName = String(body.roomName);
        const { data: room } = await client.from('live_sessions').select('host_id').eq('room_name', roomName).maybeSingle();
        canPublish = !!(room && room.host_id === user.id);
      } else {
        throw fail(400, 'INVALID_ROOM', 'A valid LIVE room is required.');
      }
      const token = await createLiveKitToken({ userId: user.id, roomName, canPublish, ttlSeconds: body.ttlSeconds });
      return ok(res, { token, serverUrl: LIVEKIT_URL, canPublish, roomName, identity: user.id });
    }

    // ---- LIVE rooms -----------------------------------------------------
    if (pathname === '/api/live/rooms' && method === 'GET') {
      const client = db();
      const limit = clampLimit(url.searchParams.get('limit'), 30, 100);
      const { data, error } = await client.from('live_sessions').select('id,host_id,title,category,status,viewer_count,started_at').eq('status', 'live').order('started_at', { ascending: false }).limit(limit);
      if (error) throw error;
      return ok(res, { rooms: data || [] });
    }
    if (pathname === '/api/live/rooms' && method === 'POST') {
      const user = await requireSupabaseUser(req);
      const body = await readJson(req);
      const title = String(body.title || '').trim().slice(0, 200);
      if (!title) throw fail(400, 'INVALID_INPUT', 'A stream title is required.');
      const client = db();
      const roomName = 'chl_' + (globalThis.crypto?.randomUUID?.() || Date.now().toString(36)).replace(/-/g, '');
      const { data, error } = await client.from('live_sessions').insert({ host_id: user.id, room_name: roomName, title, category: body.category ? String(body.category).slice(0, 60) : null, status: 'pending' }).select('*').single();
      if (error) throw error;
      return ok(res, data);
    }
    const lrp = liveRoomParts(pathname);
    if (lrp && lrp.id) {
      const client = db();
      if (!lrp.action && method === 'GET') {
        const room = await liveRoomById(client, lrp.id);
        return ok(res, room);
      }
      if (lrp.action === 'join' && method === 'POST') {
        const user = await requireSupabaseUser(req);
        const room = await liveRoomById(client, lrp.id);
        if (room.status === 'ended') throw fail(409, 'LIVE_ENDED', 'This LIVE session has ended.');
        return ok(res, { joined: true, roomId: room.id, status: room.status });
      }
      if (lrp.action === 'start' && method === 'POST') {
        const user = await requireSupabaseUser(req);
        const room = await liveRoomById(client, lrp.id);
        if (room.host_id !== user.id) throw fail(403, 'FORBIDDEN', 'Only the host can start this LIVE room.');
        // Server-authoritative gate: do not mark LIVE until the host actually publishes media.
        await verifyHostPublishing(room.room_name, user.id);
        const { data, error } = await client.from('live_sessions').update({ status: 'live', started_at: new Date().toISOString() }).eq('id', room.id).select('*').single();
        if (error) throw error;
        return ok(res, data);
      }
      if ((lrp.action === 'end' || lrp.action === 'leave') && method === 'POST') {
        const user = await requireSupabaseUser(req);
        const room = await liveRoomById(client, lrp.id);
        if (lrp.action === 'end') {
          if (room.host_id !== user.id) throw fail(403, 'FORBIDDEN', 'Only the host can end this LIVE room.');
          const { data, error } = await client.from('live_sessions').update({ status: 'ended', ended_at: new Date().toISOString() }).eq('id', room.id).select('*').single();
          if (error) throw error;
          return ok(res, data);
        }
        return ok(res, { left: true });
      }
    }

    // ---- Payments (PayPal, server-verified, idempotent) -----------------
    if (pathname === '/api/payments/create-order' && method === 'POST') {
      const user = await requireSupabaseUser(req);
      const idem = requireIdem(req);
      const body = await readJson(req);
      const coins = Number(body.coins);
      const client = db();
      const pkg = await coinPackage(client, coins);
      const { data: existing } = await client.from('payments').select('*').eq('user_id', user.id).eq('idempotency_key', idem).maybeSingle();
      if (existing && existing.provider_order_id) {
        const existingOrder = await paypal(`/v2/checkout/orders/${existing.provider_order_id}`, { method: 'GET' });
        const link = (existingOrder.links || []).find(l => l.rel === 'approve' || l.rel === 'payer-action');
        return ok(res, { orderId: existing.provider_order_id, approveUrl: link ? link.href : null });
      }
      const returnBase = PAYPAL_RETURN_URL || (FRONTEND_URL.split(',')[0] || '');
      const order = await paypal('/v2/checkout/orders', { method: 'POST', headers: { 'PayPal-Request-Id': idem }, body: JSON.stringify({ intent: 'CAPTURE', purchase_units: [{ amount: { currency_code: pkg.currency, value: Number(pkg.price).toFixed(2) }, custom_id: `${user.id}:${pkg.coins}` }], application_context: { brand_name: 'Creator Hub Creator Network', user_action: 'PAY_NOW', return_url: returnBase ? `${returnBase}/?paypal=success` : undefined, cancel_url: returnBase ? `${returnBase}/?paypal=cancel` : undefined } }) });
      const link = (order.links || []).find(l => l.rel === 'approve' || l.rel === 'payer-action');
      const { error: insErr } = await client.from('payments').insert({ user_id: user.id, provider: 'paypal', provider_order_id: order.id, package_coins: pkg.coins, amount: pkg.price, currency: pkg.currency, status: 'created', idempotency_key: idem, raw: order });
      if (insErr) throw insErr;
      return ok(res, { orderId: order.id, approveUrl: link ? link.href : null });
    }
    if (pathname === '/api/payments/capture-order' && method === 'POST') {
      const user = await requireSupabaseUser(req);
      const body = await readJson(req);
      const orderId = String(body.orderId || '').trim();
      if (!orderId) throw fail(400, 'PAYMENT_FAILED', 'An orderId is required.');
      const client = db();
      const payment = await paymentByOrder(client, orderId);
      if (payment.user_id !== user.id) throw fail(403, 'FORBIDDEN', 'This payment belongs to another account.');
      if (payment.credited) return ok(res, { credited: true, status: 'completed' });
      const cap = await paypal(`/v2/checkout/orders/${orderId}/capture`, { method: 'POST', headers: { 'PayPal-Request-Id': `capture:${orderId}` }, body: '{}' });
      const capture = cap?.purchase_units?.[0]?.payments?.captures?.[0];
      if (!capture || capture.status !== 'COMPLETED') {
        await client.from('payments').update({ status: 'pending', raw: cap, updated_at: new Date().toISOString() }).eq('id', payment.id);
        throw fail(402, 'PAYMENT_VERIFICATION_FAILED', 'PayPal did not confirm a completed capture.');
      }
      await creditCapture(client, payment, capture.id);
      return ok(res, { credited: true, status: 'completed' });
    }
    if (pathname === '/api/payments/webhook' && method === 'POST') {
      requireServerConfig(['PAYPAL_WEBHOOK_ID']);
      const event = await readJson(req);
      const verify = await paypal('/v1/notifications/verify-webhook-signature', { method: 'POST', body: JSON.stringify({ auth_algo: req.headers['paypal-auth-algo'], cert_url: req.headers['paypal-cert-url'], transmission_id: req.headers['paypal-transmission-id'], transmission_sig: req.headers['paypal-transmission-sig'], transmission_time: req.headers['paypal-transmission-time'], webhook_id: PAYPAL_WEBHOOK_ID, webhook_event: event }) });
      if (verify.verification_status !== 'SUCCESS') throw fail(400, 'WEBHOOK_VERIFICATION_FAILED', 'PayPal webhook signature verification failed.');
      const client = db();
      if (event.event_type === 'PAYMENT.CAPTURE.COMPLETED') {
        const capture = event.resource || {};
        const orderId = capture?.supplementary_data?.related_ids?.order_id;
        if (orderId) { const payment = await paymentByOrder(client, orderId); if (!payment.credited) await creditCapture(client, payment, capture.id); }
      }
      return ok(res, { received: true });
    }
    if (pathname === '/api/payments/refund' && method === 'POST') {
      await requireAdmin(req);
      const body = await readJson(req);
      const captureId = String(body.captureId || '').trim();
      if (!captureId) throw fail(400, 'PAYMENT_FAILED', 'A captureId is required.');
      const client = db();
      await paypal(`/v2/payments/captures/${captureId}/refund`, { method: 'POST', body: '{}' });
      const { data: payment } = await client.from('payments').select('*').eq('provider_capture_id', captureId).maybeSingle();
      if (payment) {
        await client.from('payments').update({ status: 'refunded', updated_at: new Date().toISOString() }).eq('id', payment.id);
        const { error: dErr } = await client.rpc('debit_coins', { p_user: payment.user_id, p_amount: payment.package_coins, p_source: 'refund', p_reference: captureId, p_reason: `Refund of order ${payment.provider_order_id}`, p_idempotency_key: `paypal:refund:${captureId}` });
        if (dErr) return ok(res, { refunded: true, coinsReversed: false, note: dErr.message });
      }
      return ok(res, { refunded: true });
    }

    // ---- Wallet (server-authoritative; balances never trusted from client)
    if (pathname === '/api/wallet/balance' && method === 'GET') {
      const user = await requireSupabaseUser(req);
      const w = await walletFor(db(), user.id);
      return ok(res, w);
    }
    if (pathname === '/api/wallet/transactions' && method === 'GET') {
      const user = await requireSupabaseUser(req);
      const limit = clampLimit(url.searchParams.get('limit'), 20, 100);
      const { data, error } = await db().from('coin_ledger').select('amount,balance_after,source,reason,reference,created_at').eq('user_id', user.id).order('created_at', { ascending: false }).limit(limit);
      if (error) throw error;
      return ok(res, { transactions: data || [] });
    }
    if (pathname === '/api/wallet/deposit' && method === 'POST') {
      // Deposit = initiate a server-authoritative coin purchase (PayPal order).
      const user = await requireSupabaseUser(req);
      const idem = requireIdem(req);
      const body = await readJson(req);
      const client = db();
      const pkg = await coinPackage(client, Number(body.coins));
      const returnBase = PAYPAL_RETURN_URL || (FRONTEND_URL.split(',')[0] || '');
      const order = await paypal('/v2/checkout/orders', { method: 'POST', headers: { 'PayPal-Request-Id': idem }, body: JSON.stringify({ intent: 'CAPTURE', purchase_units: [{ amount: { currency_code: pkg.currency, value: Number(pkg.price).toFixed(2) }, custom_id: `${user.id}:${pkg.coins}` }], application_context: { brand_name: 'Creator Hub Creator Network', user_action: 'PAY_NOW', return_url: returnBase ? `${returnBase}/?paypal=success` : undefined, cancel_url: returnBase ? `${returnBase}/?paypal=cancel` : undefined } }) });
      const link = (order.links || []).find(l => l.rel === 'approve' || l.rel === 'payer-action');
      await client.from('payments').insert({ user_id: user.id, provider: 'paypal', provider_order_id: order.id, package_coins: pkg.coins, amount: pkg.price, currency: pkg.currency, status: 'created', idempotency_key: idem, raw: order });
      return ok(res, { orderId: order.id, approveUrl: link ? link.href : null });
    }
    if (pathname === '/api/wallet/withdraw' && method === 'POST') {
      const user = await requireSupabaseUser(req);
      const idem = requireIdem(req);
      const body = await readJson(req);
      const amount = Math.floor(Number(body.amount));
      if (!(amount > 0)) throw fail(400, 'INVALID_INPUT', 'A positive diamond amount is required.');
      const { data, error } = await db().rpc('request_diamond_withdrawal', { p_user: user.id, p_amount: amount, p_reference: `withdraw:${idem}` });
      if (error) throw fail(400, 'WITHDRAWAL_FAILED', error.message);
      return ok(res, { withdrawal: data });
    }
    if (pathname === '/api/wallet/purchase' && method === 'POST') {
      const user = await requireSupabaseUser(req);
      const idem = requireIdem(req);
      const body = await readJson(req);
      const amount = Math.floor(Number(body.amount));
      if (!(amount > 0)) throw fail(400, 'INVALID_INPUT', 'A positive coin amount is required.');
      const { data, error } = await db().rpc('debit_coins', { p_user: user.id, p_amount: amount, p_source: 'purchase', p_reference: String(body.reference || idem), p_reason: String(body.reason || 'In-app purchase'), p_idempotency_key: idem });
      if (error) throw fail(400, 'PURCHASE_FAILED', error.message);
      return ok(res, { wallet: data });
    }
    if (pathname === '/api/wallet/gift' && method === 'POST') {
      const user = await requireSupabaseUser(req);
      const idem = requireIdem(req);
      const body = await readJson(req);
      const recipientId = String(body.recipientId || '').trim();
      const giftName = String(body.gift || '').trim();
      if (!recipientId) throw fail(400, 'INVALID_INPUT', 'A gift recipient is required.');
      if (recipientId === user.id) throw fail(400, 'INVALID_INPUT', 'You cannot gift yourself.');
      const client = db();
      const { data: gift, error: gErr } = await client.from('gifts').select('id').eq('name', giftName).eq('active', true).maybeSingle();
      if (gErr) throw gErr;
      if (!gift) throw fail(400, 'GIFT_UNAVAILABLE', 'The selected gift is not available.');
      const { data, error } = await client.rpc('send_gift', { p_sender: user.id, p_recipient: recipientId, p_gift: gift.id, p_live: body.liveId || null, p_idempotency_key: idem });
      if (error) throw fail(400, 'GIFT_FAILED', error.message);
      return ok(res, { transaction: data });
    }

    // ---- Leagues (read-only; standings computed server-side only) -------
    if (pathname === '/api/leagues/standings' && method === 'GET') {
      const client = db();
      const { data: season } = await client.from('league_seasons').select('id,name').eq('status', 'active').maybeSingle();
      if (!season) return ok(res, { season: null, standings: [] });
      const { data, error } = await client.from('league_standings').select('*, teams(name,division_code,level)').eq('season_id', season.id).order('division_code', { ascending: true }).order('position', { ascending: true });
      if (error) throw error;
      return ok(res, { season, standings: data || [] });
    }
    if (pathname === '/api/leagues' && method === 'GET') {
      const { data, error } = await db().from('leagues').select('*').order('rank', { ascending: true });
      if (error) throw error;
      return ok(res, { leagues: data || [] });
    }

    // ---- Not found ------------------------------------------------------
    throw fail(404, 'NOT_FOUND', `The requested endpoint '${pathname}' does not exist.`);
  } catch (err) {
    return errorResponse(res, err);
  }
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`Creator Hub Creator Network backend listening on port ${PORT} (PayPal ${PAYPAL_ENV}).`);
});

export { server };
