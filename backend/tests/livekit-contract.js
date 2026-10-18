// LiveKit contract regression tests that do not require network credentials.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { classifyPublishedTracks, missingMediaForMode } from '../src/livekit-verification.js';

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const SERVER = fs.readFileSync(path.join(ROOT, 'src', 'server.js'), 'utf8');
const ROOM_PAGE = fs.readFileSync(path.join(ROOT, '..', 'frontend', 'src', 'pages-room.js'), 'utf8');
const TOKEN = fs.readFileSync(path.join(ROOT, 'src', 'livekit-token.js'), 'utf8');

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

const cases = [
  ['host absent', [], false, false],
  ['host connected but no tracks', [{ source: 1, muted: true }], false, false],
  ['camera only', [{ source: 1, muted: false }], true, false],
  ['microphone only', [{ source: 2, muted: false }], false, true],
  ['camera + microphone', [{ source: 1, muted: false }, { source: 2, muted: false }], true, true],
  ['muted camera + microphone', [{ source: 1, muted: true }, { source: 2, muted: false }], false, true],
  ['screen-share video + microphone', [{ source: 3, muted: false }, { source: 2, muted: false }], false, true],
  ['screen-share video + microphone', [{ source: 3, muted: false }, { source: 2, muted: false }], false, true],
  ['screen-share video only', [{ source: 3, muted: false }], false, false],
  ['wrong/unknown source', [{ source: 0, muted: false }], false, false],
];

for (const [name, tracks, camera, microphone] of cases) {
  const actual = classifyPublishedTracks(tracks);
  assert(actual.camera === camera && actual.microphone === microphone, `${name}: unexpected classification ${JSON.stringify(actual)}`);
  console.log(`PASS — ${name}`);
}

assert(SERVER.includes("await verifyHostPublishing("), 'LIVE start endpoint does not verify host publication before update.');
const verifyIndex = SERVER.indexOf('await verifyHostPublishing(');
const updateMatch = /\.update\(\{\s*status:\s*['\"]live['\"]/g;
const updateIndices = Array.from(SERVER.matchAll(updateMatch), (match) => match.index);
const updateIndex = updateIndices.find((index) => index > verifyIndex) ?? -1;
assert(verifyIndex >= 0 && updateIndex > verifyIndex, 'LIVE status update appears before host publication verification.');
assert(/const LIVEKIT_URL = String\(\s*process\.env\.LIVEKIT_URL\s*\|\|\s*['\"]{2}/.test(SERVER), 'Server still has a silent hard-coded LIVEKIT_URL fallback.');
assert(TOKEN.includes('canPublishSources: publishSources'), 'Token must use mode-specific source grants.');
assert(TOKEN.includes("mode === 'audio' ? [2]"), 'Audio LIVE must grant microphone only.');
assert(TOKEN.includes('isHost ? [3, 4] : []'), 'Screen LIVE must grant screen sources to the host only.');
assert(missingMediaForMode({ camera: false, microphone: true, screenShare: false }, 'audio').length === 0, 'Audio LIVE must accept microphone-only publication.');
assert(missingMediaForMode({ camera: false, microphone: false, screenShare: true }, 'screen').length === 0, 'Screen LIVE must accept screen-share-only publication.');
assert(missingMediaForMode({ camera: false, microphone: true, screenShare: false }, 'video').includes('camera'), 'Video LIVE must still require a camera.');
assert(ROOM_PAGE.includes('joinResult && joinResult.roomName') && ROOM_PAGE.includes('room.room_name'), 'Frontend does not use the backend-authoritative LiveKit room name.');
assert(!/var roomName = roomId;/.test(ROOM_PAGE), 'Frontend still substitutes the database room UUID as the LiveKit room name.');

console.log('PASS — LIVE start authorization ordering');
console.log('PASS — no production LiveKit URL fallback');
console.log('PASS — host publish-source restriction');
console.log('PASS — database room ID and LiveKit room-name contract');
