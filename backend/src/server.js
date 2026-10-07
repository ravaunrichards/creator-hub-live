import 'dotenv/config';
import http from 'node:http';
import { URL } from 'node:url';
import { createClient } from '@supabase/supabase-js';

// CRITICAL FIX: Changed from './livekit/token.mjs' to match the actual file location and extension
import { createLiveKitToken, validateRoomName, livekitHealth } from './livekit-token.js';

const PORT = Number(process.env.PORT || 3000);
const FRONTEND_URL = String(process.env.FRONTEND_URL || process.env.NEXT_PUBLIC_APP_URL || '').replace(/\/\$/, '');
const API_BASE = String(process.env.API_BASE || '').replace(/\/\$/, '');
const SUPABASE_URL = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || process.env.SUPABASE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const PAYPAL_ENV = String(process.env.PAYPAL_ENV || process.env.PAYPAL_MODE || 'sandbox').toLowerCase();
const PAYPAL_CLIENT_ID = process.env.PAYPAL_CLIENT_ID;
const PAYPAL_CLIENT_SECRET = process.env.PAYPAL_CLIENT_SECRET;
const PAYPAL_WEBHOOK_ID = process.env.PAYPAL_WEBHOOK_ID;
const PAYPAL_BASE = PAYPAL_ENV === 'live' ? 'https://api-m.paypal.com' : 'https://api-m.sandbox.paypal.com';

// ✔️ UPDATED FALLBACK: Pointing to your active LiveKit application domain context
const LIVEKIT_URL = process.env.LIVEKIT_URL || 'wss://creator-hub-live-9susyfri.livekit.cloud';

function fail(status, code, message, details) { const e = new Error(message); e.status = status; e.code = code; e.details = details; return e; }
function secureHeaders(extra = {}) { return { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff', 'X-Frame-Options': 'DENY', 'Referrer-Policy': 'no-referrer', ...extra }; }
function send(res, status, body, extra = {}) { res.writeHead(status, secureHeaders(extra)); res.end(JSON.stringify(body)); }
function ok(res, body) { return send(res, 200, body); }
function errorResponse(res, error) { const e = error instanceof Error ? error : new Error(String(error)); const status = e.status || 500; return send(res, status, { ok: false, code: e.code || 'INTERNAL_ERROR', error: status >= 500 ? (e.message || 'Internal server error.') : e.message, details: e.details || undefined }); }
function allowedOrigin(origin) { if (!origin) return true; const list = FRONTEND_URL.split(',').map(x => x.trim()).filter(Boolean); return list.length ? list.includes(origin) : origin === `http://localhost:${PORT}` || origin === `http://127.0.0.1:${PORT}`; }
function applyCors(req, res) { const origin = req.headers.origin; if (origin && allowedOrigin(origin)) res.setHeader('Access-Control-Allow-Origin', origin); res.setHeader('Vary', 'Origin'); res.setHeader('Access-Control-Allow-Headers', 'Authorization, Content-Type, Idempotency-Key, PayPal-Request-Id, X-Requested-With'); res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS'); }
async function readJson(req) { let raw = ''; for await (const chunk of req) raw += chunk; if (!raw.trim()) return {}; try { return JSON.parse(raw); } catch { throw fail(400, 'INVALID_JSON', 'Request body must be valid JSON.'); } }
function requireServerConfig(keys) { const missing = keys.filter(k => !process.env[k]); if (missing.length) throw fail(503, 'REQUIRES_CONFIGURATION', 'Backend configuration is incomplete.', { missing }); }
function db() { requireServerConfig(['SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY']); return createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, { auth: { autoRefreshToken: false, persistSession: false } }); }
async function requireSupabaseUser(req) { requireServerConfig(['SUPABASE_URL', 'SUPABASE_ANON_KEY']); const h = req.headers.authorization || ''; if (!h.startsWith('Bearer ')) throw fail(401, 'AUTH_REQUIRED', 'Authentication required.'); const token = h.slice(7).trim(); if (!token) throw fail(401, 'AUTH_REQUIRED', 'Authentication required.'); const authClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, { auth: { autoRefreshToken: false, persistSession: false } }); const { data, error } = await authClient.auth.getUser(token); if (error || !data?.user) throw fail(401, 'AUTH_REQUIRED', 'Invalid or expired Supabase session.'); return data.user; }
async function profileFor(user) { const { data, error } = await db().from('profiles').select('id,username,display_name,is_admin').eq('id', user.id).maybeSingle(); if (error) throw error; return data || { id: user.id, is_admin: false }; }
async function requireAdmin(req) { const user = await requireSupabaseUser(req); const p = await profileFor(user); if (!p.is_admin) throw fail(403, 'FORBIDDEN', 'Administrator permission is required.'); return user; }
async function requireRole(req, allowed) { const user = await requireSupabaseUser(req); const p = await profileFor(user); if (p.is_admin) return user; const roles = Array.isArray(allowed) ? allowed : [allowed]; if (roles.includes('user')) return user; throw fail(403, 'FORBIDDEN', 'Required role is not assigned.'); }
async function requireLeagueAuthority(req, matchId) { const user = await requireSupabaseUser(req); const client = db(); const prof = await profileFor(user); if (prof.is_admin) return user; const { data: m, error: me } = await client.from('league_matches').select('id,home_team_id,away_team_id,season_id,status').eq('id', matchId).maybeSingle(); if (me) throw me; if (!m) throw fail(404, 'INVALID_MATCH', 'League match not found.'); const { data: members, error } = await client.from('team_members').select('team_id,role').eq('user_id', user.id).in('role', ['owner','captain','manager']); if (error) throw error; const permitted = (members || []).some(x => x.team_id === m.home_team_id || x.team_id === m.away_team_id); if (!permitted) throw fail(403, 'FORBIDDEN', 'You do not have league authority for this match.'); return user; }
function requireIdem(req) { const key = String(req.headers['idempotency-key'] || '').trim(); if (!key || key.length < 16 || key.length > 200) throw fail(400, 'PAYMENT_DUPLICATE', 'A unique Idempotency-Key with 16–200 characters is required.'); return key; }

async function paypalToken() { requireServerConfig(['PAYPAL_CLIENT_ID', 'PAYPAL_CLIENT_SECRET']); const auth = Buffer.from(`${PAYPAL_CLIENT_ID}:${PAYPAL_CLIENT_SECRET}`).toString('base64'); const r = await fetch(`${PAYPAL_BASE}/v1/oauth2/token`, { method: 'POST', headers: { Authorization: `Basic ${auth}`, 'Content-Type': 'application/x-www-form-urlencoded' }, body: 'grant_type=client_credentials' }); const text = await r.text(); if (!r.ok) throw fail(502, 'PAYMENT_PROVIDER_ERROR', `PayPal OAuth failed (${r.status}).`); let d; try { d = JSON.parse(text); } catch { throw fail(502, 'PAYMENT_PROVIDER_ERROR', 'PayPal OAuth returned an invalid response.'); } return d.access_token; }
async function paypal(path, options = {}) { const token = await paypalToken(); const headers = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', ...(options.headers || {}) }; const r = await fetch(`${PAYPAL_BASE}${path}`, { ...options, headers }); const text = await r.text(); let d = {}; try { d = text ? JSON.parse(text) : {}; } catch { d = {}; } if (!r.ok) throw fail(502, 'PAYMENT_PROVIDER_ERROR', d?.message || `PayPal request failed (${r.status}).`, { paypalStatus: r.status }); return d; }
async function paymentByOrder(client, orderId) { const { data, error } = await client.from('payments').select('*').eq('provider_order_id', orderId).maybeSingle(); if (error) throw error; if (!data) throw fail(404, 'PAYMENT_FAILED', 'Payment order was not found.'); return data; }
async function creditCapture(client, payment, captureId) { if (!captureId) throw fail(502, 'PAYMENT_VERIFICATION_FAILED', 'PayPal capture ID was not returned.'); const idem = `paypal:capture:${captureId}`; const { data, error } = await client.rpc('credit_coins', { p_user: payment.user_id, p_amount: payment.package_coins, p_source: 'paypal', p_provider: 'paypal', p_reference: captureId, p_reason: `PayPal coin purchase ${payment.provider_order_id}`, p_idempotency_key: idem }); if (error) throw error; const { error: updateError } = await client.from('payments').update({ provider_capture_id: captureId, status: 'completed', credited: true, updated_at: new Date().toISOString() }).eq('id', payment.id); if (updateError) throw updateError; return data; }

// ==========================================
// 🚀 PRODUCTION PLATFORM RUNTIME ROUTER ENGINE
// ==========================================

const server = http.createServer(async (req, res) => {
  applyCors(req, res);

  const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  const pathname = url.pathname;

  // Intercept and bypass CORS Preflight checks smoothly
  if (req.method === 'OPTIONS') {
    res.writeHead(204, secureHeaders());
    return res.end();
  }

  try {
    // 🌐 Infrastructure Verification Endpoint
    if (pathname === '/api/health' && req.method === 'GET') {
      const livekit = livekitHealth();
      return ok(res, { ok: true, status: 'operational', livekit });
    }

    // 📹 LiveKit Real-Time Web RTC Streaming Tokens
    if (pathname === '/api/livekit/token' && req.method === 'POST') {
      const user = await requireSupabaseUser(req);
      const body = await readJson(req);
      const { roomName, canPublish, ttlSeconds } = body;

      const token = await createLiveKitToken({
        userId: user.id,
        roomName,
        canPublish,
        ttlSeconds
      });

      return ok(res, { ok: true, token });
    }

    // ❌ Fallback Exception: Resource Not Found Catch
    throw fail(404, 'NOT_FOUND', `The requested router endpoint '${pathname}' does not exist.`);

  } catch (err) {
    return errorResponse(res, err);
  }
});

// Fire up network interface listeners safely
server.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Production app container actively listening and serving requests on port ${PORT}`);
});