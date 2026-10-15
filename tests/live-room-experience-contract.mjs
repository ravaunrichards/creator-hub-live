import assert from 'node:assert/strict';
import fs from 'node:fs';
import { pathToFileURL } from 'node:url';
import path from 'node:path';

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const read = (p) => fs.readFileSync(path.join(root, p), 'utf8');
const server = read('backend/src/server.js');
const moduleSource = read('backend/src/live-room-experience.js');
const migration = read('database/migrations/0026_nexus_live_room_experience.sql');
const env = read('backend/.env.example');
const liveUi = read('frontend/src/pages-room.js');
assert.match(server, /import \{ handleLiveRoomExperience \} from "\.\/live-room-experience\.js"/);
assert.match(server, /await handleLiveRoomExperience\(\{[\s\S]*?requireSupabaseUser, readJson/);
for (const feature of ['participants','gift-events','polls','questions','moderators','analytics','recordings','settings','chat-moderation','reactions']) {
  assert.ok(moduleSource.includes(feature), `LIVE experience must route ${feature}`);
}
for (const table of ['live_room_moderators','live_room_polls','live_room_poll_votes','live_room_reactions','live_room_questions','live_room_recordings']) {
  assert.match(migration, new RegExp(`create table if not exists public\\.${table}\\b`), `migration must create ${table}`);
  assert.match(migration, new RegExp(`alter table public\\.${table} enable row level security`), `${table} must have RLS enabled`);
}
assert.match(migration, /revoke all on public\.live_room_moderators[\s\S]*from anon,authenticated/i);
assert.match(migration, /grant all on public\.live_room_moderators[\s\S]*to service_role/i);
assert.match(migration, /to_regclass\('public\.gifts'\) is null/);
assert.match(migration, /to_regclass\('public\.live_schedules'\) is null/);
assert.match(migration, /chcn_can_access_live_session/);
assert.match(migration, /where status='active' and kind='poll'/, 'active Q&A prompts must not block the active poll');
assert.match(liveUi, /roomTitleHeading\.textContent = String\(room\.title \|\| 'LIVE'\)/, 'the authoritative LIVE title must be shown');
assert.match(liveUi, /coverImageUrl: settingCoverUrl\.value/, 'host room settings must save the cover URL');
assert.match(liveUi, /data-recording-download/, 'refreshing download links must not accumulate duplicate links');
assert.match(migration, /revoke insert,update,delete on public\.live_sessions from anon,authenticated/i);
assert.match(server, /idempotency-key/i, 'core gift settlement must continue requiring idempotency keys');
assert.match(moduleSource, /LIVE_RECORDING_S3_BUCKET/);
assert.match(moduleSource, /response-content-disposition/);
assert.match(moduleSource, /timingSafeEqual/);
assert.match(env, /LIVE_RECORDING_S3_BUCKET=/);
assert.match(env, /LIVE_RECORDING_CLEANUP_SECRET=/);

// Import the real handler without loading optional vendor packages at module load time.
const { handleLiveRoomExperience } = await import(pathToFileURL(path.join(root, 'backend/src/live-room-experience.js')));
function fakeClient(room, moderator = null) {
  return {
    from(table) {
      const q = {
        select() { return this; }, eq() { return this; }, in() { return this; },
        maybeSingle: async () => table === 'live_sessions' ? { data: room, error: null } : ({ data: moderator, error: null }),
      };
      return q;
    }
  };
}
const room = { id:'room-1', host_id:'host-1', room_name:'chl_abc123', status:'live', audience:'public', allow_guests:true, title:'Test' };
function context({ pathname, method='GET', user={id:'host-1'}, body={}, roomRow=room, moderator=null }={}) {
  const client = fakeClient(roomRow, moderator);
  return {
    pathname, method, req:{ headers:{} }, res:{},
    requireSupabaseUser: async()=>user,
    db:()=>client,
    readJson:async()=>body,
    ok:(_res,payload)=>{ context.lastPayload=payload; },
    fail:(status,code,message)=>Object.assign(new Error(message),{status,code}),
    send:()=>{},
  };
}
let ctx = context({ pathname:'/api/live/rooms/room-1/reactions', method:'POST', body:{reaction:'<script>'} });
await assert.rejects(() => handleLiveRoomExperience(ctx), e => e.code === 'REACTION_INVALID' && e.status === 400);
ctx = context({ pathname:'/api/live/rooms/room-1/moderators', method:'POST', user:{id:'viewer-1'}, body:{userId:'target-1'} });
await assert.rejects(() => handleLiveRoomExperience(ctx), e => e.code === 'HOST_REQUIRED' && e.status === 403);
process.env.LIVEKIT_URL='wss://configured.invalid'; process.env.LIVEKIT_API_KEY='key'; process.env.LIVEKIT_API_SECRET='secret';
ctx = context({ pathname:'/api/live/rooms/room-1/recordings/start', method:'POST', body:{} });
await assert.rejects(() => handleLiveRoomExperience(ctx), e => e.code === 'RECORDING_STORAGE_NOT_CONFIGURED' && e.status === 503);
delete process.env.LIVEKIT_URL; delete process.env.LIVEKIT_API_KEY; delete process.env.LIVEKIT_API_SECRET;
ctx = context({ pathname:'/api/live/rooms/room-1/not-a-real-feature', method:'GET' });
assert.equal(await handleLiveRoomExperience(ctx), false, 'unknown paths must pass through to the server 404 handler');
console.log('PASS — LIVE experience wiring, RLS/table migration, moderator authorization, input validation, recording configuration gate and unmatched route contract.');
