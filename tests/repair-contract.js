// Cross-layer repair regression checks that require no external services.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const WEB = path.join(ROOT, 'frontend');
const ANDROID_WEB = path.join(ROOT, 'android', 'app', 'src', 'main', 'assets', 'web');
const SERVER = fs.readFileSync(path.join(ROOT, 'backend', 'src', 'server.js'), 'utf8');
const TOKEN = fs.readFileSync(path.join(ROOT, 'backend', 'src', 'livekit-token.js'), 'utf8');
const ROOM = fs.readFileSync(path.join(WEB, 'src', 'pages-room.js'), 'utf8');
const ACTIVITY = fs.readFileSync(path.join(ROOT, 'android', 'app', 'src', 'main', 'java', 'com', 'creatorhub', 'app', 'MainActivity.java'), 'utf8');
const MIGRATION = fs.readFileSync(path.join(ROOT, 'database', 'migrations', '0009_live_pending_state.sql'), 'utf8');
const RLS = fs.readFileSync(path.join(ROOT, 'database', 'migrations', '0010_rls_hardening.sql'), 'utf8');
const SETTINGS = fs.readFileSync(path.join(ROOT, 'database', 'migrations', '0011_user_settings.sql'), 'utf8');
const CHAT = fs.readFileSync(path.join(ROOT, 'database', 'migrations', '0012_live_chat_messages.sql'), 'utf8');
const TEAMS = fs.readFileSync(path.join(ROOT, 'backend', 'src', 'teams-routes.js'), 'utf8');
const WALLET_REPAIR = fs.readFileSync(path.join(ROOT, 'database', 'migrations', '0039_wallet_team_integrity.sql'), 'utf8');
const COMMENT_DELETE = fs.readFileSync(path.join(ROOT, 'database', 'migrations', '0038_comments_author_and_post_owner_delete.sql'), 'utf8');
const WALLET_UI = fs.readFileSync(path.join(WEB, 'src', 'pages-wallet.js'), 'utf8');

function assert(ok, message) { if (!ok) throw new Error(message); }

assert(SERVER.includes('await verifyHostPublishing('), 'LIVE start does not verify host media.');
const verify = SERVER.indexOf('await verifyHostPublishing(');
const update = SERVER.indexOf('.update({\n            status: "live"', verify);
assert(update > verify, 'LIVE database promotion precedes LiveKit verification.');
assert(TOKEN.includes("canPublishSources: canPublish ? [1, 2] : []"), 'Host token does not restrict publishing sources to camera and microphone.');
assert(!SERVER.includes("'wss://creator-hub-live-9susyfri.livekit.cloud'"), 'Server still contains the previous hard-coded LiveKit URL.');
assert(ROOM.includes('joinResult && joinResult.roomName'), 'Frontend does not consume joinResult.roomName.');
assert(ROOM.includes('room.room_name'), 'Frontend does not retain backend room_name fallback.');
assert(!ROOM.includes('var roomName = roomId;'), 'Frontend still aliases database room ID as LiveKit room name.');
assert(MIGRATION.includes("'pending', 'live', 'ended'"), 'Database migration does not permit pending/live/ended states.');
assert(MIGRATION.includes('add column if not exists updated_at'), 'Database migration does not add updated_at required by server writes.');
assert(RLS.includes('alter table public.coin_packages enable row level security'), 'RLS hardening migration missing coin_packages.');
assert(RLS.includes('alter table public.league_events enable row level security'), 'RLS hardening migration missing league_events.');
assert(ACTIVITY.includes('onShowFileChooser'), 'Android WebView file chooser bridge is missing.');
assert(ACTIVITY.includes('REQ_FILE_CHOOSER'), 'Android file chooser request path is missing.');
assert(ACTIVITY.includes('allRequiredGranted'), 'Android media permission callback does not require all requested permissions.');
assert(SETTINGS.includes('create table if not exists public.user_settings'), 'Persistent user settings table is missing.');
assert(SETTINGS.includes('user_id = auth.uid()'), 'Persistent user settings RLS is missing owner restriction.');
assert(CHAT.includes('create table if not exists public.live_chat_messages'), 'LIVE chat persistence table is missing.');
const LIVE_LIST = fs.readFileSync(path.join(WEB, 'src', 'pages.js'), 'utf8');
const LIVE_CSS = fs.readFileSync(path.join(WEB, 'styles', 'app.css'), 'utf8');
const LIVE_SW = fs.readFileSync(path.join(WEB, 'sw.js'), 'utf8');
assert(LIVE_LIST.includes(".eq('status','live').is('ended_at', null)"), 'Live discovery can include ended sessions.');
assert(SERVER.includes('.is("ended_at", null)'), 'Backend live-room API can include ended sessions.');
assert(LIVE_LIST.includes('window.setInterval(refresh, 10000)'), 'Live discovery does not refresh ended broadcasts automatically.');
assert(LIVE_CSS.includes('font-weight: 800') && LIVE_CSS.includes('prefers-contrast: more'), 'Readable bold typography and high-contrast support are missing.');
assert(LIVE_SW.includes('chl-web-v3-3-3'), 'Service worker cache was not invalidated after UI repairs.');
assert(SERVER.includes('"/api/wallet/gift"'), 'Server-authoritative gift endpoint is missing.');
assert(SERVER.includes('"/api/wallet/transactions"'), 'Wallet transaction endpoint is missing.');
assert(fs.existsSync(path.join(ROOT, 'backend', 'src', 'teams-routes.js')), 'Imported teams route module is missing; the backend cannot start.');
assert(SERVER.includes('pathname === "/api/leagues/standings"'), 'League standings route is not wired into the backend router.');
assert(TEAMS.includes('export async function handleTeamsRoute'), 'Teams route module has no exported handler.');
assert(TEAMS.includes('create_team') && TEAMS.includes('join_team') && TEAMS.includes('leave_team'), 'Team create/join/leave RPC contracts are incomplete.');
const TEAM_UI = fs.readFileSync(path.join(WEB, 'src', 'pages-creator.js'), 'utf8');
assert(TEAM_UI.includes("CHL.authenticatedApiRequest('/api/teams',{method:'POST',body:{name:name}})"), 'Team creation is not connected to the authenticated backend.');
assert(TEAM_UI.includes("'/api/teams/'+encodeURIComponent(teamId)+'/join'"), 'Team join action is not connected to the backend.');
assert(TEAM_UI.includes("'/api/teams/'+encodeURIComponent(teamId)+'/leave'"), 'Team leave action is not connected to the backend.');
assert(!TEAM_UI.includes('Create-team form — connect backend to persist') && !TEAM_UI.includes("CHL.toast('Join request sent')"), 'Teams still contain fake success toasts instead of real API actions.');
assert(WALLET_REPAIR.includes('create policy comments_del') && WALLET_REPAIR.includes('author_id = auth.uid()'), 'Forward wallet migration does not repair the comment deletion policy.');
assert(WALLET_REPAIR.includes('create or replace function public.convert_wallet_currency'), 'Wallet conversion RPC is not created by the repair migration.');
assert(WALLET_REPAIR.includes('create or replace function public.request_diamond_payout'), 'Diamond payout RPC is not created by the repair migration.');
assert(WALLET_REPAIR.includes('create or replace function public.admin_review_diamond_payout'), 'Admin payout review/refund RPC is not created by the repair migration.');
assert(WALLET_REPAIR.includes('idempotency_key') && WALLET_REPAIR.includes('lifetime_gifts_sent'), 'Wallet schema repair omits API-required columns/idempotency fields.');
assert(!COMMENT_DELETE.includes('chcn_my_account_active'), 'Creator Hub Live comment policy calls a foreign-project helper.');
assert(WALLET_UI.includes('function choosePaymentMethod') && WALLET_UI.includes('Choose a payment method'), 'Coin purchase buttons skip the payment-method selection step.');
assert(WALLET_UI.includes('capturedAmount') || SERVER.includes('capturedAmount'), 'PayPal capture does not validate the provider-confirmed amount.');
assert(SERVER.includes('buildPaypalReturnUrl("success")') && SERVER.includes('PAYPAL_RETURN_URL_REQUIRED'), 'PayPal return URL construction is not guarded.');
assert(SERVER.includes('pathname === "/api/payments/paypal/info" && method === "DELETE"'), 'Saved PayPal payout email cannot be unlinked.');
assert(SERVER.includes('GET, POST, PUT, PATCH, DELETE, OPTIONS'), 'CORS preflight blocks PATCH or DELETE routes used by the app.');
assert(fs.readFileSync(path.join(WEB, 'src', 'pages-settings.js'), 'utf8').includes("method:'DELETE',body:{}"), 'Payment settings do not expose the PayPal email unlink path.');


async function verifyNewRouteBehaviors() {
  const { handleTeamsRoute } = await import('../backend/src/teams-routes.js');
  const dataByTable = {
    teams: [{ id: '2bdf22d2-cf0c-41e5-b1e5-4be2fc8107d1', name: 'Test Team', level: 1, points: 0 }],
    league_seasons: [],
  };
  const rpcCalls = [];
  function query(table) {
    return {
      select() { return this; }, eq() { return this; }, order() { return this; }, limit() { return this; },
      ilike() { return this; }, in() { return this; }, maybeSingle() { return Promise.resolve({ data: null, error: null }); },
      then(resolve, reject) { return Promise.resolve({ data: dataByTable[table] || [], error: null }).then(resolve, reject); },
    };
  }
  const client = {
    from(table) { return query(table); },
    rpc(name, args) { rpcCalls.push({ name, args }); return Promise.resolve({ data: { id: '2bdf22d2-cf0c-41e5-b1e5-4be2fc8107d1', name: args.p_name || 'Test Team' }, error: null }); },
  };
  const fail = (status, code, message) => Object.assign(new Error(message), { status, code });
  const ok = (res, body) => { res.writableEnded = true; res.body = body; };
  const send = (res, status, body) => { res.writableEnded = true; res.statusCode = status; res.body = body; };
  const base = { req: {}, url: new URL('http://localhost/api/teams'), res: {}, fail, ok, send, db: () => client,
    requireSupabaseUser: async () => ({ id: 'f764baff-fda7-48bf-88fa-0f59a2aa6322' }), readJson: async () => ({ name: 'Test Team' }) };

  const listResponse = { writableEnded: false };
  await handleTeamsRoute({ ...base, pathname: '/api/teams', method: 'GET', res: listResponse, url: new URL('http://localhost/api/teams') });
  assert(listResponse.writableEnded && listResponse.body.teams[0].name === 'Test Team', 'Teams list route did not return the database-backed team rows.');

  const standingsResponse = { writableEnded: false };
  await handleTeamsRoute({ ...base, pathname: '/api/leagues/standings', method: 'GET', res: standingsResponse, url: new URL('http://localhost/api/leagues/standings') });
  assert(standingsResponse.writableEnded && standingsResponse.body.season === null && standingsResponse.body.standings.length === 0, 'No-active-season standings should return a clean empty state, not a 404 or fabricated standings.');

  const createResponse = { writableEnded: false };
  await handleTeamsRoute({ ...base, pathname: '/api/teams', method: 'POST', res: createResponse, url: new URL('http://localhost/api/teams') });
  assert(createResponse.writableEnded && createResponse.statusCode === 201 && rpcCalls.some((item) => item.name === 'create_team'), 'Team creation did not call the authoritative database RPC.');
  const teamId = '2bdf22d2-cf0c-41e5-b1e5-4be2fc8107d1';
  const joinResponse = { writableEnded: false };
  await handleTeamsRoute({ ...base, pathname: `/api/teams/${teamId}/join`, method: 'POST', res: joinResponse, url: new URL(`http://localhost/api/teams/${teamId}/join`) });
  assert(joinResponse.writableEnded && joinResponse.statusCode === 201 && rpcCalls.some((item) => item.name === 'join_team'), 'Team joining did not call the authoritative database RPC.');

  const leaveResponse = { writableEnded: false };
  await handleTeamsRoute({ ...base, pathname: `/api/teams/${teamId}/leave`, method: 'DELETE', res: leaveResponse, url: new URL(`http://localhost/api/teams/${teamId}/leave`) });
  assert(leaveResponse.writableEnded && leaveResponse.body.left === true && rpcCalls.some((item) => item.name === 'leave_team'), 'Team leaving did not call the authoritative database RPC.');

  let invalidIdRejected = false;
  try { await handleTeamsRoute({ ...base, pathname: '/api/teams/not-a-uuid/join', method: 'POST', res: { writableEnded: false }, url: new URL('http://localhost/api/teams/not-a-uuid/join') }); }
  catch (error) { invalidIdRejected = error.status === 400 && error.code === 'INVALID_ID'; }
  assert(invalidIdRejected, 'Team mutation route accepted an invalid team ID.');
}
await verifyNewRouteBehaviors();

function list(dir) {
  const out = [];
  function walk(d) {
    for (const e of fs.readdirSync(d, { withFileTypes: true })) {
      const p = path.join(d, e.name);
      if (e.isDirectory()) walk(p); else out.push(path.relative(dir, p));
    }
  }
  walk(dir); return out.sort();
}
const webFiles = list(WEB);
const androidFiles = list(ANDROID_WEB);
assert(JSON.stringify(webFiles) === JSON.stringify(androidFiles), 'Frontend and Android packaged web file trees differ.');
for (const rel of webFiles) {
  assert(fs.readFileSync(path.join(WEB, rel)).equals(fs.readFileSync(path.join(ANDROID_WEB, rel))), `Web parity failure: ${rel}`);
}

console.log('PASS — LiveKit start gate and room-name contract');
console.log('PASS — token publishing-source restriction');
console.log('PASS — database LIVE state/update_at migration');
console.log('PASS — Android file chooser bridge and strict AV permission gate');
console.log(`PASS — frontend ↔ Android web parity (${webFiles.length} files)`);
console.log('PASS — persistent settings, LIVE chat, wallet transaction and gift contracts');
console.log('PASS — teams/league route module, wallet conversion and payout schema, PayPal return/amount validation, payment-method selection');
