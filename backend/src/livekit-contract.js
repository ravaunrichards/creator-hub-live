// LiveKit contract regression tests that do not require network credentials.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { classifyPublishedTracks } from '../src/livekit-verification.js';

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
  ['screen share only', [{ source: 3, muted: false }], false, false],
  ['muted screen share', [{ source: 3, muted: true }], false, false],
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
assert(/const publishSources = !canPublish \? \[] : mode === 'audio' \? \[2\] : mode === 'screen' \? \(isHost \? \[3, 4\] : \[]\) : \[1, 2, 3, 4\]/.test(TOKEN), 'Host token must restrict publishing sources according to the server-authoritative LIVE mode and retain in-room screen sharing.');
assert(/if \(mode === 'audio'\)[\s\S]*?if \(!media\.microphone\)/.test(TOKEN), 'Audio-only LIVE must require a microphone but not camera publishing.');
assert(/if \(mode === 'screen'\)[\s\S]*?if \(!media\.screen\)/.test(TOKEN), 'Screen-only LIVE must require an actual screen-share track.');
assert(SERVER.includes('media_mode: mediaMode'), 'LIVE room creation does not persist its selected media mode.');
assert(ROOM_PAGE.includes('joinResult && joinResult.roomName') && ROOM_PAGE.includes('room.room_name'), 'Frontend does not use the backend-authoritative LiveKit room name.');
assert(!/var roomName = roomId;/.test(ROOM_PAGE), 'Frontend still substitutes the database room UUID as the LiveKit room name.');

console.log('PASS — LIVE start authorization ordering');
console.log('PASS — no production LiveKit URL fallback');
console.log('PASS — mode-specific publish-source restrictions');
console.log('PASS — media-mode persistence');
console.log('PASS — database room ID and LiveKit room-name contract');
