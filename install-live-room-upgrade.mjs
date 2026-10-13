#!/usr/bin/env node
import fs from 'node:fs/promises';
import { constants as fsConstants } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const payloadRoot = path.join(scriptDir, 'payload');
const targetRoot = path.resolve(process.argv[2] || process.cwd());
const required = [
  'backend/src/server.js',
  'backend/src/livekit-token.js',
  'frontend/src/pages-room.js',
  'frontend/src/pages.js',
  'frontend/src/pages-extra.js',
  'frontend/src/ui.js',
  'frontend/index.html',
  'frontend/sw.js',
  'package.json',
];
const dateStamp = new Date().toISOString().replace(/[-:.TZ]/g, '').slice(0, 14);
const payloadFiles = [
  ['database/migrations/0026_live_room_experience.sql', 'database/migrations/0026_live_room_experience.sql'],
  ['backend/src/live-room-experience.js', 'backend/src/live-room-experience.js'],
  ['scripts/cleanup-live-recordings.mjs', 'scripts/cleanup-live-recordings.mjs'],
  ['tests/live-room-upgrade-contract.mjs', 'tests/live-room-upgrade-contract.mjs'],
  ['docs/LIVE-ROOM-UPGRADE-INSTALL.md', 'docs/LIVE-ROOM-UPGRADE-INSTALL.md'],
];

function insist(count, label) {
  if (count !== 1) throw new Error(`Preflight failed: expected exactly one ${label} anchor, found ${count}. No project files were changed.`);
}
function replaceOnce(source, from, to, label) {
  const count = source.split(from).length - 1;
  insist(count, label);
  return source.replace(from, to);
}

for (const rel of required) {
  try { await fs.access(path.join(targetRoot, rel)); }
  catch { throw new Error(`Target folder does not look like the existing Creator Hub repository: ${rel} is missing. No project files were changed.`); }
}
const sourceFiles = new Map();
for (const [sourceRel] of payloadFiles) sourceFiles.set(sourceRel, await fs.readFile(path.join(payloadRoot, sourceRel), 'utf8'));
sourceFiles.set('frontend/src/pages-room.js', await fs.readFile(path.join(payloadRoot, 'frontend/src/pages-room.js'), 'utf8'));
const destinationsToCreate = payloadFiles.map(([, destinationRel]) => path.join(targetRoot, destinationRel));
for (const destination of destinationsToCreate) {
  try { await fs.access(destination); throw new Error(`Refusing to overwrite existing ${path.relative(targetRoot, destination)}. Review it first; no project files were changed.`); }
  catch (error) { if (error.message.startsWith('Refusing to overwrite')) throw error; }
}
let server = await fs.readFile(path.join(targetRoot, 'backend/src/server.js'), 'utf8');
let tokenSource = await fs.readFile(path.join(targetRoot, 'backend/src/livekit-token.js'), 'utf8');
let pagesSource = await fs.readFile(path.join(targetRoot, 'frontend/src/pages.js'), 'utf8');
let pagesExtraSource = await fs.readFile(path.join(targetRoot, 'frontend/src/pages-extra.js'), 'utf8');
let commonUiSource = await fs.readFile(path.join(targetRoot, 'frontend/src/ui.js'), 'utf8');
let indexSource = await fs.readFile(path.join(targetRoot, 'frontend/index.html'), 'utf8');
let swSource = await fs.readFile(path.join(targetRoot, 'frontend/sw.js'), 'utf8');
const packageData = JSON.parse(await fs.readFile(path.join(targetRoot, 'package.json'), 'utf8'));
if (!packageData.scripts || typeof packageData.scripts.check !== 'string') throw new Error('Preflight failed: package.json does not have the expected scripts.check contract. No project files were changed.');
packageData.scripts['live-room:check'] = 'node tests/live-room-upgrade-contract.mjs';
if (!packageData.scripts.check.includes('node tests/live-room-upgrade-contract.mjs')) {
  const backendTestAnchor = ' && cd backend && npm test';
  insist(packageData.scripts.check.split(backendTestAnchor).length - 1, 'root check-script insertion');
  packageData.scripts.check = packageData.scripts.check.replace(backendTestAnchor, ' && node tests/live-room-upgrade-contract.mjs' + backendTestAnchor);
}
// Bump the website/PWA asset version together so the new room UI is not hidden by the old shell cache.
if (!indexSource.includes('4.0.2')) throw new Error('Preflight failed: expected 4.0.2 asset query markers in frontend/index.html. No project files were changed.');
if (!swSource.includes("chcn-web-v4-0-2") || !swSource.includes('4.0.2')) throw new Error('Preflight failed: expected the existing 4.0.2 service-worker cache markers. No project files were changed.');
indexSource = indexSource.replaceAll('4.0.2', '4.0.3');
swSource = swSource.replaceAll('chcn-web-v4-0-2', 'chcn-web-v4-0-3').replaceAll('4.0.2', '4.0.3');
packageData.version = '4.0.3';
const packageSource = JSON.stringify(packageData, null, 2) + '\n';

// Verify every patch anchor before making any target changes.
server = replaceOnce(
  server,
  'import { handlePayoutRoute } from "./payout-routes.js";\n',
  'import { handlePayoutRoute } from "./payout-routes.js";\nimport { handleLiveRoomExperience, hasAcceptedLiveRoomGuest, canAccessLiveRoom, getCurrentLiveViewerCount, stopActiveRoomRecordings, terminateLiveKitRoom } from "./live-room-experience.js";\n',
  'backend import insertion'
);
server = replaceOnce(server, 'const BACKEND_RELEASE = "4.0.0";', 'const BACKEND_RELEASE = "4.0.3";', 'backend release version synchronization');
const joinAnchor = `        const canPublish = String(room.host_id) === String(user.id);\n        return ok(res, {\n          joined: true,\n          roomId: room.id,\n          status: room.status,\n          roomName: room.room_name,\n          isHost: canPublish,\n          canPublish,\n        });`;
const joinPatch = `        if (!(await canAccessLiveRoom(client, room, user))) {\n          throw fail(403, "LIVE_ACCESS_RESTRICTED", "This LIVE room is limited to its configured audience.");\n        }\n        const isHost = String(room.host_id) === String(user.id);\n        const isGuest = !isHost && await hasAcceptedLiveRoomGuest(client, room.id, user.id);\n        const canPublish = isHost || isGuest;\n        return ok(res, {\n          joined: true,\n          roomId: room.id,\n          status: room.status,\n          roomName: room.room_name,\n          isHost,\n          isGuest,\n          canPublish,\n        });`;
server = replaceOnce(server, joinAnchor, joinPatch, 'server-authoritative LIVE join permissions');
server = replaceOnce(
  server,
  '.select("id,name,coin_price,diamond_value,active")',
  '.select("id,name,category,graphic_url,animation_url,sound_url,coin_price,diamond_value,rarity,active")',
  'database-backed gift artwork fields'
);
server = replaceOnce(
  server,
  `        name: gift.name,
        coinPrice: gift.coin_price == null ? null : Number(gift.coin_price),`,
  `        name: gift.name,
        category: gift.category || null,
        graphicUrl: gift.graphic_url || null,
        animationUrl: gift.animation_url || null,
        soundUrl: gift.sound_url || null,
        rarity: gift.rarity || null,
        coinPrice: gift.coin_price == null ? null : Number(gift.coin_price),`,
  'database-backed gift artwork response fields'
);
server = replaceOnce(
  server,
  `.select("id,host_id,title,category,status,viewer_count,started_at")
        .eq("status", "live")`,
  `.select("id,host_id,room_name,title,category,status,viewer_count,started_at,audience")
        .eq("status", "live")`,
  'LIVE room list audience field'
);
server = replaceOnce(
  server,
  '      return ok(res, { rooms: data || [] });',
  `      let viewer = null;
      if (String(req.headers.authorization || "").startsWith("Bearer ")) {
        try { viewer = await requireSupabaseUser(req); } catch (_) { viewer = null; }
      }
      const candidates = data || [];
      const hostIds = [...new Set(candidates.map((room) => String(room.host_id)).filter(Boolean))];
      let hostById = new Map();
      if (hostIds.length) {
        const { data: hosts, error: hostError } = await client.from("profiles")
          .select("id,username,display_name,avatar_url,privacy").in("id", hostIds);
        if (hostError) throw hostError;
        hostById = new Map((hosts || []).map((host) => [String(host.id), host]));
      }
      const visibleRooms = [];
      for (const candidate of candidates) {
        if (await canAccessLiveRoom(client, candidate, viewer, hostById.get(String(candidate.host_id)))) visibleRooms.push(candidate);
      }
      const rooms = await Promise.all(visibleRooms.map(async (room) => ({ ...room, viewer_count: await getCurrentLiveViewerCount(client, room), host: hostById.get(String(room.host_id)) || null })));
      return ok(res, { rooms });`,
  'LIVE room list audience enforcement'
);
server = replaceOnce(
  server,
  `      if (!liveParts.action && method === "GET") {
        const room = await liveRoomById(client, liveParts.id);
        return ok(res, room);
      }`,
  `      if (!liveParts.action && method === "GET") {
        const user = await requireSupabaseUser(req);
        const room = await liveRoomById(client, liveParts.id);
        if (!(await canAccessLiveRoom(client, room, user))) {
          throw fail(403, "LIVE_ACCESS_RESTRICTED", "This LIVE room is limited to its configured audience.");
        }
        return ok(res, room);
      }`,
  'LIVE room detail audience enforcement'
);
const tokenAnchor = 'canPublish = String(room.host_id) === String(user.id);';
const tokenPatch = `if (String(room.status || "").toLowerCase() === "ended") {\n          throw fail(409, "LIVE_ENDED", "This LIVE session has ended.");\n        }\n        if (!(await canAccessLiveRoom(client, room, user))) {\n          throw fail(403, "LIVE_ACCESS_RESTRICTED", "This LIVE room is limited to its configured audience.");\n        }\n        canPublish = String(room.host_id) === String(user.id) || await hasAcceptedLiveRoomGuest(client, room.id, user.id);`;
const tokenCount = server.split(tokenAnchor).length - 1;
if (tokenCount !== 2) throw new Error(`Preflight failed: expected the two existing LiveKit token permission anchors, found ${tokenCount}. No project files were changed.`);
server = server.split(tokenAnchor).join(tokenPatch);
const hookAnchor = '    // 404 Fallback\n';
const hookPatch = `    // Existing-project LIVE room features (guests, battles, polls, recordings, settings).\n    const handledLiveRoomExperience = await handleLiveRoomExperience({\n      req, res, pathname, method, fail, ok, db, requireSupabaseUser, readJson, liveRoomById, normalizeExternalError\n    });\n    if (handledLiveRoomExperience) return;\n\n    // 404 Fallback\n`;
server = replaceOnce(server, hookAnchor, hookPatch, 'LIVE experience route hook');
server = replaceOnce(
  server,
  `        const { data, error } = await client
          .from("live_sessions")
          .update({
            status: "ended",`,
  `        await stopActiveRoomRecordings({ fail }, client, room, user);
        await terminateLiveKitRoom({ fail }, room, user);
        const { data, error } = await client
          .from("live_sessions")
          .update({
            status: "ended",`,
  'end-LIVE recording shutdown'
);

// Keep the pre-existing persisted chat routes behind the same audience check as the room itself.
server = replaceOnce(
  server,
  `      const room = await liveRoomById(client, chatParts.id);
      if (room.status === "ended")`,
  `      const room = await liveRoomById(client, chatParts.id);
      if (!(await canAccessLiveRoom(client, room, user))) {
        throw fail(403, "LIVE_ACCESS_RESTRICTED", "This LIVE room is limited to its configured audience.");
      }
      if (room.status === "ended")`,
  'LIVE chat send audience enforcement'
);
server = replaceOnce(
  server,
  `      await requireSupabaseUser(req);
      const room = await liveRoomById(db(), chatParts.id);
      const client = db();`,
  `      const user = await requireSupabaseUser(req);
      const client = db();
      const room = await liveRoomById(client, chatParts.id);
      if (!(await canAccessLiveRoom(client, room, user))) {
        throw fail(403, "LIVE_ACCESS_RESTRICTED", "This LIVE room is limited to its configured audience.");
      }`,
  'LIVE chat read audience enforcement'
);
server = replaceOnce(
  server,
  '.select("id,host_id,room_name,status")',
  '.select("id,host_id,room_name,status,audience,allow_guests,max_guests,cover_image_url")',
  'LiveKit room-name token privacy fields'
);
tokenSource = replaceOnce(tokenSource, 'canPublishSources: canPublish ? [1, 2] : [],', 'canPublishSources: canPublish ? [1, 2, 3, 4] : [],', 'LiveKit camera/microphone/screenshare token grants');

// Home/discovery must use the audience-filtered backend list, not direct
// Supabase selects that could expose follower-only/private LIVE sessions.
const loadMarker = '  function loadLive(grid, limit){';
if (pagesSource.split(loadMarker).length - 1 !== 1) throw new Error('Preflight failed: expected exactly one existing live discovery loader. No project files were changed.');
const loadStart = pagesSource.indexOf(loadMarker);
const discoverMarker = '\n  /* ============ DISCOVER ============ */';
const loadEnd = pagesSource.indexOf(discoverMarker, loadStart);
if (loadEnd < 0) throw new Error('Preflight failed: could not find the discovery route boundary after loadLive. No project files were changed.');
const replacementLoader = `  function loadLive(grid, limit){
    var endpoint = '/api/live/rooms?limit=' + encodeURIComponent(limit || 20);
    CHL.getAccessToken().catch(function(){ return null; }).then(function(token){ return token ? CHL.authenticatedApiRequest(endpoint, { method: 'GET' }) : CHL.apiRequest(endpoint, { method: 'GET' }); })
      .then(function(r){
        grid.innerHTML = '';
        var rows = (r && Array.isArray(r.rooms)) ? r.rooms : [];
        if (!rows.length){
          grid.appendChild(ui.empty('📴','No one is live right now','Be the first to go LIVE — your stream will appear here in real time.', el('a',{href:'#/create',class:'btn primary',style:'margin-top:8px'},'Start streaming')));
          grid.style.display='block'; return;
        }
        grid.style.display='';
        rows.forEach(function(s){ grid.appendChild(ui.liveTile(s)); });
      }).catch(function(e){ grid.innerHTML=''; grid.appendChild(el('div',{class:'note',text:'Could not load streams: '+(e.message || 'request failed')})); });
  }
`;
pagesSource = pagesSource.slice(0, loadStart) + replacementLoader + pagesSource.slice(loadEnd);

// Route real guest-invitation notifications to the existing LIVE room so invitees
// can accept/decline without needing to discover a private room manually.
pagesExtraSource = replaceOnce(
  pagesExtraSource,
  "else if(n.type==='live_schedule')text+='scheduled a LIVE session';",
  "else if(n.type==='live_schedule')text+='scheduled a LIVE session';else if(n.type==='live_guest_invite')text+='invited you to join a LIVE session';",
  'guest invitation notification label'
);
pagesExtraSource = replaceOnce(
  pagesExtraSource,
  "if(d.conversation_id)links.push(el('a',{href:'#/messages/'+d.conversation_id,class:'chip'},'Reply'));",
  "if(d.conversation_id)links.push(el('a',{href:'#/messages/'+d.conversation_id,class:'chip'},'Reply'));if(n.type==='live_guest_invite'&&(d.room_id||d.live_id))links.push(el('a',{href:'#/live/'+encodeURIComponent(d.room_id||d.live_id),class:'chip'},'Open LIVE room'));",
  'guest invitation notification room link'
);
commonUiSource = replaceOnce(
  commonUiSource,
  'CHL.fmt(s.viewer_count||0)',
  "(s.viewer_count==null?'—':CHL.fmt(s.viewer_count))",
  'truthful viewer-count display when LiveKit count is unavailable'
);

// Ensure the migration is new and existing targets are not silently overwritten by a second copy.

// All anchors passed. Back up changed existing files, then install all related files.
const writes = [
  ['backend/src/server.js', server],
  ['backend/src/livekit-token.js', tokenSource],
  ['frontend/src/pages.js', pagesSource],
  ['frontend/src/pages-extra.js', pagesExtraSource],
  ['frontend/src/ui.js', commonUiSource],
  ['frontend/index.html', indexSource],
  ['frontend/sw.js', swSource],
  ['frontend/src/pages-room.js', sourceFiles.get('frontend/src/pages-room.js')],
  ['package.json', packageSource],
];
const backups = [];
for (const [rel] of writes) {
  const absolute = path.join(targetRoot, rel);
  const backup = `${absolute}.pre-live-room-${dateStamp}.bak`;
  try { await fs.access(backup); throw new Error(`Backup already exists: ${path.relative(targetRoot, backup)}. No project files were changed.`); }
  catch (error) { if (error.message.startsWith('Backup already exists')) throw error; }
  backups.push([absolute, backup]);
}
for (const [absolute, backup] of backups) await fs.copyFile(absolute, backup, fsConstants.COPYFILE_EXCL).catch(async (error) => {
  if (error.code !== 'EEXIST') throw error;
  throw new Error(`Backup already exists: ${backup}. No target files were written.`);
});
try {
  for (const [rel, content] of writes) await fs.writeFile(path.join(targetRoot, rel), content, 'utf8');
  for (const [sourceRel, destinationRel] of payloadFiles) {
    const destination = path.join(targetRoot, destinationRel);
    await fs.mkdir(path.dirname(destination), { recursive: true });
    // New files are never overwritten.
    try { await fs.access(destination); throw new Error(`Refusing to overwrite existing ${destinationRel}. Restore the backups and investigate.`); }
    catch (error) { if (error.message.startsWith('Refusing to overwrite')) throw error; }
    await fs.writeFile(destination, sourceFiles.get(sourceRel), 'utf8');
  }
} catch (error) {
  // Restore modified pre-existing files on installer failure.
  for (const [absolute, backup] of backups) {
    try { await fs.copyFile(backup, absolute); } catch (_) {}
  }
  for (const destination of destinationsToCreate) { try { await fs.rm(destination, { force: true }); } catch (_) {} }
  throw error;
}
console.log('Creator Hub LIVE room upgrade files installed into the selected checkout.');
console.log(`Target: ${targetRoot}`);
console.log('Backups:');
backups.forEach(([, backup]) => console.log(`  ${path.relative(targetRoot, backup)}`));
console.log('Next: read docs/LIVE-ROOM-UPGRADE-INSTALL.md and manually review/run the SQL migration before deployment.');
