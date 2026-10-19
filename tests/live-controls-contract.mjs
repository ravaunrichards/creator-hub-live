import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const livekit = fs.readFileSync(path.join(ROOT, 'frontend/src/livekit.js'), 'utf8');
const room = fs.readFileSync(path.join(ROOT, 'frontend/src/pages-room.js'), 'utf8');
const create = fs.readFileSync(path.join(ROOT, 'frontend/src/pages-wallet.js'), 'utf8');
const androidLivekit = fs.readFileSync(path.join(ROOT, 'android/app/src/main/assets/web/src/livekit.js'), 'utf8');
const androidRoom = fs.readFileSync(path.join(ROOT, 'android/app/src/main/assets/web/src/pages-room.js'), 'utf8');
function assert(ok, message) { if (!ok) throw new Error(message); }

assert(/CHL\.switchCamera\s*=\s*async function/.test(livekit), 'Camera flip handler is missing from LiveKit integration.');
assert(/switchActiveDevice\('videoinput'/.test(livekit), 'Camera flip does not switch the active LiveKit video input.');
assert(/frontPattern/.test(livekit) && /rearPattern/.test(livekit), 'Camera flip must prefer the opposite-facing camera when device labels allow it.');
assert(/CHL\.setCameraZoom\s*=\s*async function/.test(livekit), 'Camera zoom handler is missing from LiveKit integration.');
assert(/applyConstraints\(\{\s*advanced:\s*\[\{\s*zoom:/.test(livekit), 'Camera zoom does not apply supported hardware constraints.');
assert(/cameraSource/.test(livekit) && /capabilities\.zoom/.test(livekit), 'Hardware zoom must target a published camera track and require actual zoom capability.');
assert(/'video','Video LIVE/.test(create) && /'audio','Audio-Only LIVE/.test(create) && /'screen','Screen-Sharing LIVE/.test(create), 'All three separate LIVE modes must remain selectable.');
assert(/mediaMode: f\.mediaMode\.value/.test(create), 'Selected LIVE mode must be sent to the backend when creating a room.');
assert(/Flip camera/.test(room) && /Choose screen and Go LIVE/.test(room) && /CHL\.startScreenShare\(\)/.test(room), 'Camera flip and screen-share controls are missing from the LIVE room.');
assert(livekit === androidLivekit, 'Android WebView LiveKit integration is not synchronized with frontend source.');
assert(room === androidRoom, 'Android WebView LIVE room controls are not synchronized with frontend source.');
console.log('PASS — front/rear camera switching has an implementation and prefers opposite-facing cameras');
console.log('PASS — hardware camera zoom has an implementation');
console.log('PASS — Video LIVE, Audio LIVE and Screen Share LIVE remain distinct');
console.log('PASS — screen-share and camera controls remain present');
console.log('PASS — Android and web LIVE sources are byte-identical');
