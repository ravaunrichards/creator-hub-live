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

function assert(ok, message) { if (!ok) throw new Error(message); }

assert(SERVER.includes('await verifyHostPublishing('), 'LIVE start does not verify host media.');
const verify = SERVER.indexOf('await verifyHostPublishing(');
const update = SERVER.indexOf(".update({\n              status: 'live'", verify);
assert(update > verify, 'LIVE database promotion precedes LiveKit verification.');
assert(TOKEN.includes("canPublishSources: canPublish ? ['camera', 'microphone'] : []"), 'Host token does not restrict publishing sources.');
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
assert(SERVER.includes("'/api/wallet/gift'"), 'Server-authoritative gift endpoint is missing.');
assert(SERVER.includes("'/api/wallet/transactions'"), 'Wallet transaction endpoint is missing.');

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
