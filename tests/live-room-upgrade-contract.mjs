#!/usr/bin/env node
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const parent = path.resolve(here, '..');
const root = await fs.access(path.join(parent, 'backend/src/server.js')).then(() => parent).catch(() => path.resolve(here, '..', '..'));
const read = (rel) => fs.readFile(path.join(root, rel), 'utf8');
const [ui, api, token, migration, gifts, pages, pagesExtra, commonUi, index, sw] = await Promise.all([
  read('frontend/src/pages-room.js'),
  read('backend/src/server.js'),
  read('backend/src/livekit-token.js'),
  read('database/migrations/0026_live_room_experience.sql'),
  read('database/migrations/0025_chl_gift_catalogue_pricing.sql'),
  read('frontend/src/pages.js'),
  read('frontend/src/pages-extra.js'),
  read('frontend/src/ui.js'),
  read('frontend/index.html'),
  read('frontend/sw.js'),
]);
const experience = await read('backend/src/live-room-experience.js');

function includes(haystack, value, description) {
  assert.ok(haystack.includes(value), `Missing ${description}: ${value}`);
}
function matches(haystack, regex, description) {
  assert.match(haystack, regex, `Missing ${description}`);
}

// Existing app stays wired to the additional room API routes and accepted-guest auth.
includes(api, 'handleLiveRoomExperience', 'LIVE experience router import');
includes(api, 'canAccessLiveRoom', 'room audience access guard');
includes(api, 'const BACKEND_RELEASE = "4.0.3";', 'backend release version matches website and PWA');
includes(api, 'String(room.status || "").toLowerCase() === "ended"', 'ended rooms do not receive fresh LiveKit tokens');
includes(api, 'getCurrentLiveViewerCount', 'LiveKit-sourced viewer counts');
includes(api, 'viewer_count: await getCurrentLiveViewerCount(client, room)', 'live room cards use current connected viewer counts');
includes(api, 'hasAcceptedLiveRoomGuest', 'accepted guest permissions');
includes(api, 'LIVE_ACCESS_RESTRICTED', 'restricted-room authorization');
includes(api, 'host: hostById.get(String(room.host_id)) || null', 'actual creator profile on filtered room listing');
includes(api, 'status,audience,allow_guests,max_guests,cover_image_url', 'audience fields in room-name token lookup');
includes(api, '.select("id,host_id,room_name,title,category,status,viewer_count,started_at,audience")', 'LiveKit room names are present for actual viewer counts');
includes(api, 'stopActiveRoomRecordings({ fail }, client, room, user)', 'recording shutdown before end LIVE');
assert.ok((api.match(/LIVE_ACCESS_RESTRICTED/g) || []).length >= 4, 'Room listing, detail, token and chat routes must enforce audience access.');
includes(api, 'await canAccessLiveRoom(client, room, user)', 'audience guard on chat routes');
includes(pages, "CHL.getAccessToken().catch(function(){ return null; }).then(function(token)", 'public-room discovery works for signed-out visitors');
includes(pages, "CHL.authenticatedApiRequest(endpoint, { method: 'GET' })", 'audience-filtered home/discovery list');
includes(pagesExtra, "n.type==='live_guest_invite'", 'guest invitation notification type');
includes(pagesExtra, "'Open LIVE room'", 'guest invitation navigates into the invited room');
matches(commonUi, /s\.viewer_count==null\?'—'/, 'no invented zero when current viewer count cannot be measured');
includes(ui, "['Connected viewers now', a.viewerCount == null ? 'Not available' : a.viewerCount]", 'viewer metric is explicitly marked unavailable rather than falsified');
assert.ok(!pages.includes("sb.from('live_sessions')"), 'Home/discovery must not bypass the LIVE audience filter with direct database reads.');
includes(api, 'if (handledLiveRoomExperience) return;', 'LIVE route dispatch');
includes(api, 'soundUrl: gift.sound_url || null,', 'per-gift sound URL response');
includes(api, '.select("id,name,category,graphic_url,animation_url,sound_url,coin_price,diamond_value,rarity,active")', 'database-backed gift sound field selection');
includes(token, 'canPublishSources: canPublish ? [1, 2, 3, 4] : []', 'screen share token grants');
includes(experience, "import { createHmac, createHash, randomUUID, timingSafeEqual }", 'recording signature helpers and constant-time cleanup auth');
includes(experience, "signedS3Request('HEAD', row.storage_key)", 'recording upload completion detection');
includes(experience, "['recording', 'processing'].includes(data.status)", 'deletion blocked while recording is active');
includes(experience, 'stageEligible.has(String(p.identity))', 'viewer participants excluded from guest video tiles');
includes(experience, 'export async function getCurrentLiveViewerCount', 'current viewer count reads LiveKit participants');
includes(experience, "const viewerCount = room.status === 'live' ? await getCurrentLiveViewerCount(client, room) : null;", 'analytics viewer count is LiveKit measured only during LIVE');
includes(experience, 'export async function terminateLiveKitRoom', 'ending LIVE disconnects every participant server-side');
includes(experience, '{ revokeTokenTs: BigInt(Math.floor(Date.now() / 1000)) }', 'removed guests cannot reuse an existing LiveKit token');
includes(experience, "action === 'accept' && room.allow_guests === false", 'disabled guest invitations cannot be accepted');
includes(api, 'await terminateLiveKitRoom({ fail }, room, user)', 'server ends the LiveKit room before confirming LIVE ended');

// The replacement UI must contain wired endpoints and responsive layout modes.
for (const name of ['compact', 'balanced', 'spacious', 'grid']) includes(ui, name, `${name} layout`);
for (const endpoint of ['participants', 'guests', 'battle', 'polls', 'questions', 'moderators', 'reactions', 'analytics', 'recordings', 'settings', 'chat-moderation']) includes(ui, endpoint, `${endpoint} UI/API integration`);
for (const feature of ['loadGifts', 'loadChat', 'LIVE room settings', 'Start recording', 'Download / Save', 'Schedule a LIVE', 'End LIVE', 'graphicUrl', 'animationUrl', 'soundUrl', 'giftSound(gift.soundUrl)']) includes(ui, feature, `${feature} control`);
includes(ui, 'Start next battle', 'battle can run again after the previous round ends');
includes(ui, 'function updateCoverPreview(url)', 'persisted LIVE cover image rendered in the room');
includes(ui, 'function resetStage()', 'guest accept/leave reconnect clears stale stage tiles');
includes(ui, "api(roomId, 'chat-moderation', m.id + '/report'", 'chat report path avoids double URL-encoding member IDs');
includes(ui, "var reduceMotion = localPref('chcn-live-gift-motion', 'on') === 'off';", 'reduced-motion preference disables autoplay gift animation');
includes(ui, 'await loadRoom(); await renderPanel();', 'guest invitations and leave work without a same-hash navigation');
assert.ok(!/mockGift|fakeGift|DEMO_ONLY|placeholderGuest|fake viewer/i.test(ui), 'Found a prohibited fake/demo data marker in LIVE UI.');

// Backend extension uses real existing tables/RPC data, and has no seed/demo inserts.
for (const route of ['routeGuests', 'routeBattle', 'routePolls', 'routeQuestions', 'routeModerators', 'routeRecording', 'routeSettings', 'routeAnalytics', 'routeSchedules', 'routeChatModeration']) includes(experience, route, `${route} handler`);
includes(ui, '/api/wallet/gift', 'server-authoritative gift transaction request');
includes(experience, 'gift_transactions', 'committed gift transactions for real scores/metrics');
includes(experience, 'isoPlusDays(30)', '30-day recording retention');
includes(experience, 'presignedDownloadUrl', 'short-lived private recording URL');
includes(experience, 'disableManifest: true', 'recording manifest sidecar is disabled so private cleanup covers the recording object');
includes(experience, 'response-content-disposition', 'download response forces attachment/save');
includes(experience, 'export async function stopActiveRoomRecordings', 'end-LIVE stops active Egress recordings');
includes(experience, "if (String(room.status || '').toLowerCase() === 'ended') return false;", 'ended rooms are hidden from non-host users');
includes(experience, 'Guest invitations are unavailable after LIVE ends.', 'ended rooms reject new guests');
includes(experience, 'Reactions are available only while LIVE is active.', 'ended rooms reject new reactions');
includes(experience, 'LIVE_RECORDING_CLEANUP_SECRET', 'authenticated cleanup endpoint');
includes(experience, 'LIVE_RECORDING_S3_BUCKET', 'private recording storage configuration');
includes(experience, 'pendingChecked', 'scheduled recording status finalization');
assert.ok(!/insert\s+into\s+public\.(profiles|live_sessions|gift_transactions)\s+values\s*\(/i.test(experience), 'LIVE extension must not seed invented profiles, rooms or gift transactions.');

// Database changes are additive/private and do not rewrite the approved gift catalogue.
for (const table of ['live_room_moderators', 'live_room_polls', 'live_room_poll_votes', 'live_room_reactions', 'live_room_questions', 'live_room_recordings']) {
  matches(migration, new RegExp(`create table if not exists public\\.${table}\\b`, 'i'), `${table} migration`);
  matches(migration, new RegExp(`alter table public\\.${table} enable row level security`, 'i'), `${table} RLS`);
}
includes(migration, 'revoke all on public.live_room_moderators', 'client-side writes denied for LIVE tables');
includes(migration, 'public.chcn_can_access_live_session(id,host_id,audience,status)', 'database-level LIVE audience row policy');
includes(migration, 'alter table public.gifts add column if not exists sound_url text', 'optional DB-backed gift sound assets');
includes(migration, 'drop policy if exists guests_read on public.live_guests', 'private guest invitation visibility policy');
includes(migration, 'drop policy if exists guests_self on public.live_guests', 'browser cannot self-accept by bypassing the backend');
includes(migration, 'revoke insert, update, delete on public.live_sessions from anon, authenticated', 'room lifecycle writes are backend-only');
includes(migration, 'public.chcn_can_access_live_session(s.id,s.host_id,s.audience,s.status)', 'chat reads/writes enforce room audience');
includes(migration, "notify pgrst, 'reload schema';", 'PostgREST schema metadata reload after migration');
const giftOrderMatch = ui.match(/var GIFT_ORDER = \[([\s\S]*?)\];/);
assert.ok(giftOrderMatch, 'A canonical, explicit approved gift display order is required.');
const displayedGiftOrder = [...giftOrderMatch[1].matchAll(/'([^']*)'|"([^"]*)"/g)].map((match) => match[1] ?? match[2]);
const approvedGiftOrder = ['applause', 'heart', 'ice cream', 'shining star', 'finger heart', 'single rose', 'kiss', 'panda', 'balloon', 'coffee', 'bravo', 'pink tulip', 'flower bouquet', 'swan', 'doughnut', 'teddy bear', 'birthday cake', 'sunflower', 'yard certified', 'love letter', 'stylish cap', 'confetti celebration', 'hand hearts', 'pretty like yard', 'crystal gem', 'cool sunglasses', 'beat a di yard', 'celebration toast', 'corgi', 'grand rose bouquet', 'premium headphones', 'butterfly wings', 'coral treasure', 'money gun', 'road ready', 'golden microphone', 'drum performance', 'dance spotlight', 'silver trophy', 'gaming champion', 'royal peacock', 'celebration fireworks', 'ocean dolphin', 'royal crown', 'galaxy', 'island life', 'royal peacock show', 'dream wedding', 'shooting stars', 'ocean whale', 'sunset of love', 'born fi run', 'super motorcycle', 'party bus', 'meteor shower', 'rockstar concert', 'golden dragon', 'private jet', 'cricket boss', 'hero spaceship', 'superstar performance', 'luxury sports car', 'golden eagle', 'volcanic explosion', 'interstellar journey', 'parish don', 'global superstar', 'planetary kingdom', 'royal castle', 'creator hub shuttle', 'diamond lion', 'legendary phoenix', 'yard champion', 'league champion', 'world of wonders', 'dragon emperor', 'cosmic empire', 'diamond kingdom', 'caribbean don', 'inferno lion', 'cosmic supernova', "emperor's lion", 'diamond planet', 'galactic dragon', 'imperial palace', 'infinite galaxy', 'celestial phoenix', 'world emperor', 'eternal diamond universe', 'creator hub ultimate universe'];
assert.equal(displayedGiftOrder.length, 90, 'The display order must contain all 90 approved gifts.');
assert.deepEqual(displayedGiftOrder, approvedGiftOrder, 'LIVE gift UI must preserve the approved 90-gift order exactly.');
assert.ok(index.includes('4.0.3') && sw.includes('chcn-web-v4-0-3') && sw.includes('4.0.3'), 'Website and PWA cache-buster version must be bumped together.');
assert.equal((gifts.match(/^\s*\('(?:[^']|'')*'\s*,\s*\d+\s*,\s*'/gm) || []).length, 90, 'The pre-existing approved gift price migration should still contain 90 gift entries.');

console.log('LIVE room upgrade contract checks passed.');
console.log('Scope: static contracts only; real LiveKit Egress/S3, Supabase policies, wallet transactions, and device layout still need the documented staging checks.');
