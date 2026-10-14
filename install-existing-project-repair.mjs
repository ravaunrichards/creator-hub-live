#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const target = path.resolve(process.argv[2] || '');
const required = [
  'frontend/index.html', 'frontend/src/pages-room.js', 'frontend/styles/app.css',
  'frontend/sw.js', 'frontend/config.js', 'backend/src/server.js',
  'backend/src/live-room-experience.js', 'backend/package.json', 'package.json', 'package-lock.json',
  'android-wrapper/app/build.gradle.kts', 'github/workflows/creator-hub-android.yml'
];
if (!process.argv[2] || required.some((p) => !fs.existsSync(path.join(target, p)))) {
  console.error('Usage: node install-existing-project-repair.mjs /path/to/existing/creator-hub-live');
  console.error('Preflight requires the existing Creator Hub repository structure. No files changed.');
  process.exit(2);
}
const stamp = new Date().toISOString().replace(/[-:.TZ]/g, '').slice(0, 14);
const changes = new Map();
const adds = new Map();
const read = (rel) => fs.readFileSync(path.join(target, rel), 'utf8');
const set = (rel, content) => { if (content !== read(rel)) changes.set(rel, content); };
function once(text, from, to, label) {
  const count = text.split(from).length - 1;
  if (count !== 1) throw new Error(`Preflight failed: expected one ${label} anchor; found ${count}. No project files changed.`);
  return text.replace(from, to);
}
function requireOnce(text, needle, label) {
  const count = text.split(needle).length - 1;
  if (count !== 1) throw new Error(`Preflight failed: expected one ${label}; found ${count}. No project files changed.`);
}

// 1. Connect the existing, implemented LIVE-experience router to the real HTTP server.
let server = read('backend/src/server.js');
if (!server.includes('from "./live-room-experience.js"')) {
  server = once(server,
    'import { handlePayoutRoute } from "./payout-routes.js";',
    'import { handlePayoutRoute } from "./payout-routes.js";\nimport { handleLiveRoomExperience } from "./live-room-experience.js";',
    'LIVE router import');
}
if (!server.includes('if (await handleLiveRoomExperience(')) {
  server = once(server,
    '    // PayPal Payments - Create Order',
    '    // Existing LIVE-experience handlers: room controls, guests, polls, questions,\n    // moderation, reactions, analytics, recordings, settings and schedules.\n    if (await handleLiveRoomExperience({ pathname, method, req, res, fail, ok, db, requireSupabaseUser, readJson, liveRoomById })) return;\n\n    // PayPal Payments - Create Order',
    'LIVE router dispatch');
}
// Return the real database-backed gift metadata. The production schema currently
// has graphic_url/animation_url/sound_url, category, emoji and catalog_order;
// do not assume migration-0029-only asset_key/sort_order columns exist yet.
const oldGiftSelect = '.select("id,name,coin_price,diamond_value,active")';
if (server.includes(oldGiftSelect)) {
  server = once(server, oldGiftSelect,
    '.select("id,name,category,graphic_url,animation_url,sound_url,coin_price,diamond_value,active,emoji,catalog_order")',
    'gift catalogue selected fields');
}
const oldGiftMap = `      const gifts = (data || []).map((gift) => ({
        id: gift.id,
        name: gift.name,
        coinPrice: gift.coin_price == null ? null : Number(gift.coin_price),
        diamondValue:
          gift.diamond_value == null ? null : Number(gift.diamond_value),
        active: Boolean(gift.active),
      }));`;
const newGiftMap = `      const gifts = (data || []).map((gift) => {
        const derivedKey = String(gift.name || 'gift').normalize('NFKD').toLowerCase().replace(/[’']/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 90) || 'gift';
        const assetKey = /^[a-z0-9-]+$/.test(derivedKey) ? derivedKey : 'gift';
        return {
          id: gift.id, name: gift.name, category: gift.category || null,
          coinPrice: gift.coin_price == null ? null : Number(gift.coin_price),
          diamondValue: gift.diamond_value == null ? null : Number(gift.diamond_value),
          active: Boolean(gift.active), emoji: gift.emoji || null,
          sortOrder: gift.catalog_order == null ? null : Number(gift.catalog_order), assetKey,
          graphicUrl: gift.graphic_url || '/assets/gifts/art/' + assetKey + '.svg',
          animationUrl: gift.animation_url || '/assets/gifts/animations/' + assetKey + '.svg',
          soundUrl: gift.sound_url || '/assets/gifts/sounds/' + assetKey + '.wav',
        };
      });`;
if (server.includes(oldGiftMap)) server = once(server, oldGiftMap, newGiftMap, 'gift catalogue response mapper');
server = server.replace('const BACKEND_RELEASE = "4.0.2";', 'const BACKEND_RELEASE = "4.2.0";');
set('backend/src/server.js', server);

// 2. Remove the six reaction-counter boxes and the unwanted Run preflight control.
let room = read('frontend/src/pages-room.js');
const preflightStart = "    var preflightButton = button('✓ Run preflight', async function () {";
const endMarker = "    var endButton = button('End LIVE', async function () {";
if (room.includes(preflightStart)) {
  const start = room.indexOf(preflightStart);
  const end = room.indexOf(endMarker, start);
  if (start < 0 || end < 0 || room.indexOf(preflightStart, start + 1) >= 0) throw new Error('Preflight removal anchors are ambiguous. No project files changed.');
  room = room.slice(0, start) + room.slice(end);
}
room = once(room,
  'controls.appendChild(micButton); controls.appendChild(cameraButton); controls.appendChild(shareButton); controls.appendChild(preflightButton); controls.appendChild(endButton);',
  'controls.appendChild(micButton); controls.appendChild(cameraButton); controls.appendChild(shareButton); controls.appendChild(endButton);',
  'preflight button removal');
room = once(room,
  'video.appendChild(reactionBar); layout.appendChild(video);',
  'layout.appendChild(video);',
  'reaction counter removal');
// Render the real database emoji and allow same-origin project assets. The
// current Supabase gift URL columns are empty, so use existing named assets;
// a missing illustration still falls back to the gift's real emoji and label.
room = room.replace("text: EMOJI[text(gift.name).toLowerCase()] || '🎁'", "text: gift.emoji || EMOJI[text(gift.name).toLowerCase()] || '🎁'");
room = once(room,
  "var animationUrl = !reduceMotion && gift.animationUrl && /^https:\\/\\//i.test(String(gift.animationUrl)) ? String(gift.animationUrl) : '';\n        var graphicUrl = gift.graphicUrl && /^https:\\/\\//i.test(String(gift.graphicUrl)) ? String(gift.graphicUrl) : '';",
  "var animationUrl = !reduceMotion && gift.animationUrl && (/^https:\\/\\//i.test(String(gift.animationUrl)) || /^\\/assets\\/gifts\\//i.test(String(gift.animationUrl))) ? String(gift.animationUrl) : '';\n        var graphicUrl = gift.graphicUrl && (/^https:\\/\\//i.test(String(gift.graphicUrl)) || /^\\/assets\\/gifts\\//i.test(String(gift.graphicUrl))) ? String(gift.graphicUrl) : '';",
  'same-origin gift image URLs');
room = once(room,
  "if (!soundUrl || !/^https:\\/\\//i.test(String(soundUrl))) return;",
  "if (!soundUrl || !(/^https:\\/\\//i.test(String(soundUrl)) || /^\\/assets\\/gifts\\/sounds\\/[a-z0-9-]+\\.wav$/i.test(String(soundUrl)))) return;\n    if (String(soundUrl).charAt(0) === '/') soundUrl = new URL(String(soundUrl), window.location.href).toString();",
  'same-origin gift sound URLs');
set('frontend/src/pages-room.js', room);

// 3. Invalidate old static-shell caches and keep the existing app responsive.
let index = read('frontend/index.html').replaceAll('4.0.2', '4.2.0');
set('frontend/index.html', index);
let config = read('frontend/config.js').replaceAll('4.0.2', '4.2.0');
set('frontend/config.js', config);
let sw = read('frontend/sw.js').replaceAll('4.0.2', '4.2.0').replaceAll('chcn-web-v4-0-2', 'chcn-web-v4-2-0');
set('frontend/sw.js', sw);
let css = read('frontend/styles/app.css');
if (!css.includes('.ch-live .gift-grid[hidden]')) css += `\n\n/* Repair 4.2.0: author grid styles must not override the native hidden state. */\n.ch-live .gift-grid[hidden], .ch-live [hidden] { display: none !important; }\n.ch-live, .live-room-layout, .live-room-side, .live-video-card { min-width: 0; max-width: 100%; }\n@media (max-width: 760px) { .live-room-layout { grid-template-columns: minmax(0, 1fr); } .live-stage { height: min(62vh, 560px); min-height: 260px; } .ch-live .ch-controls { flex-wrap: wrap; } .ch-live .ch-controls > button { flex: 1 1 42%; min-width: 0; } }\n@media (max-width: 380px) { .live-stage { min-height: 220px; } .ch-live .ch-controls > button { flex-basis: 100%; } }\n`;
set('frontend/styles/app.css', css);

// 4. Keep package versions aligned and run a focused regression contract on future checks.
const rootPkg = JSON.parse(read('package.json'));
rootPkg.version = '4.2.0';
if (!rootPkg.scripts || typeof rootPkg.scripts.check !== 'string') throw new Error('Root check script missing. No project files changed.');
if (!rootPkg.scripts.check.includes('tests/live-routing-repair-contract.mjs')) {
  rootPkg.scripts.check = rootPkg.scripts.check.replace(' && cd backend && npm test', ' && node tests/live-routing-repair-contract.mjs && cd backend && npm test');
}
set('package.json', JSON.stringify(rootPkg, null, 2) + '\n');
set('package-lock.json', read('package-lock.json').replaceAll('4.0.2', '4.2.0'));
const backendPkg = JSON.parse(read('backend/package.json'));
if (backendPkg.scripts?.test && !backendPkg.scripts.test.includes('tests/live-routing-repair-contract.mjs')) {
  // The test is at repository root; it is intentionally run by the root check, not from backend cwd.
}
const gradle = read('android-wrapper/app/build.gradle.kts').replace('versionCode = 410', 'versionCode = 420').replace('versionName = "4.1.0"', 'versionName = "4.2.0"');
set('android-wrapper/app/build.gradle.kts', gradle);

const workflowSource = read('github/workflows/creator-hub-android.yml');
const workflowDest = path.join(target, '.github/workflows/creator-hub-android.yml');
if (!fs.existsSync(workflowDest)) adds.set('.github/workflows/creator-hub-android.yml', workflowSource);

const test = `import assert from 'node:assert/strict';\nimport fs from 'node:fs';\nconst read = (p) => fs.readFileSync(new URL('../' + p, import.meta.url), 'utf8');\nconst server = read('backend/src/server.js');\nconst live = read('backend/src/live-room-experience.js');\nconst room = read('frontend/src/pages-room.js');\nconst index = read('frontend/index.html');\nconst sw = read('frontend/sw.js');\nconst css = read('frontend/styles/app.css');\nassert.match(server, /import \\{ handleLiveRoomExperience \\} from ".\\/live-room-experience\\.js"/);\nassert.match(server, /if \\(await handleLiveRoomExperience\\(/);\nassert.match(live, /export async function handleLiveRoomExperience/);\nassert.ok(!room.includes("✓ Run preflight"), 'Unwanted Run preflight button still exists');\nassert.ok(!room.includes('video.appendChild(reactionBar)'), 'Six reaction counters are still mounted below the video controls');\nassert.match(room, /make\\('button', \\{ type: 'button', class: 'ch-gift'/, 'Gift tiles must remain real buttons');\nassert.match(index, /4\\.2\\.0/);\nassert.match(sw, /chcn-web-v4-2-0/);\nassert.match(css, /\\.ch-live \\.gift-grid\\[hidden\\]/);\nassert.match(server, /BACKEND_RELEASE = "4\\.2\\.0"/);
assert.ok(server.includes("graphicUrl: gift.graphic_url || '/assets/gifts/art/'"));
assert.ok(server.includes("soundUrl: gift.sound_url || '/assets/gifts/sounds/'"));
assert.match(room, /gift\.emoji \|\| EMOJI/);\nconsole.log('PASS: LIVE route is wired, unwanted reaction counters/preflight are removed, gift tiles remain buttons, and cache/version contracts are aligned. Static contract only; live provider tests still required.');\n`;
adds.set('tests/live-routing-repair-contract.mjs', test);
const installDoc = `# Creator Hub Creator Network — Existing-project repair package 4.2.0\n\nThis package patches the existing repository only. It does not create a demo, seed fake data, change Supabase data, or deploy services.\n\n## Install\n\n1. Make a backup of the existing repository and database before any production release.\n2. Run from the package folder: \`node install-existing-project-repair.mjs /absolute/path/to/creator-hub-live\`.\n3. Review every \`.pre-chcn-repair-*.bak\` file and the resulting git diff before committing/deploying.\n4. In the existing checkout run \`npm run check\`; separately run \`cd backend && npm test\` if the root suite did not finish.\n5. Deploy through the existing Render release process only after tests pass.\n\n## What this patch changes\n\n- Connects the existing \`backend/src/live-room-experience.js\` handler to the backend HTTP router. Nested LIVE routes no longer fall through merely because the handler was never invoked.\n- Removes the unwanted six reaction-counter controls below the video and the Run preflight button. Existing reaction handling remains in source, but those six controls are no longer rendered.\n- Fixes the author-CSS \`hidden\` override for the gift gallery and tightens narrow-screen LIVE layout behavior.\n- Invalidates the old static cache and aligns app/backend/Android version metadata.\n- Places the existing Android workflow under GitHub's active \`.github/workflows/\` directory without deleting the original misplaced file.\n- Adds a focused static regression contract.\n\n## Important limits\n\nThis is a source patch, not proof that the deployed service is fixed. The installer does not apply SQL, alter production records, set secrets, deploy Render, run a real LiveKit broadcast, charge PayPal, or produce an APK. Do not apply a migration just because it exists in the repository: compare it with Supabase migration history and take a backup first. The applied Supabase history has 0027_live_room_experience but not 0029_complete_social_live_gifting. That migration has a strict 90-gift preflight while the current database has 96 total gift rows; reconcile and back up the real database before applying it. Do not load the dormant pages-project-upgrade.js until its guest-requests/gift-events routes and schema are verified.\n\nThe codebase is still the existing script-based frontend after this patch. React/Vite migration is a separate, staged engineering project; replacing the app in one pass would risk removing existing functionality and would not itself fix backend route mismatches.\n`;
adds.set('docs/REPAIR-4.2.0-INSTALL.md', installDoc);

// Check all anchors and destination collisions before the first write.
for (const [rel] of adds) {
  if (fs.existsSync(path.join(target, rel))) throw new Error(`Preflight failed: refusing to overwrite new-file destination ${rel}. No project files changed.`);
}
const backups = [];
for (const [rel] of changes) {
  const full = path.join(target, rel);
  const backup = `${full}.pre-chcn-repair-${stamp}.bak`;
  if (fs.existsSync(backup)) throw new Error(`Preflight failed: backup already exists ${backup}. No project files changed.`);
  backups.push({ rel, full, backup });
}
for (const b of backups) fs.copyFileSync(b.full, b.backup, fs.constants.COPYFILE_EXCL);
const written = [];
try {
  for (const [rel, content] of changes) {
    fs.writeFileSync(path.join(target, rel), content, 'utf8'); written.push(rel);
  }
  for (const [rel, content] of adds) {
    const full = path.join(target, rel); fs.mkdirSync(path.dirname(full), { recursive: true });
    fs.writeFileSync(full, content, 'utf8'); written.push(rel);
  }
} catch (error) {
  for (const b of backups) { try { fs.copyFileSync(b.backup, b.full); } catch {} }
  for (const rel of written) { if (adds.has(rel)) { try { fs.rmSync(path.join(target, rel), { force: true }); } catch {} } }
  throw new Error(`Write failed; existing-file backups were restored where possible. ${error.message}`);
}
console.log(JSON.stringify({ ok: true, target, changed: [...changes.keys()], added: [...adds.keys()], backups: backups.map((b) => path.relative(target, b.backup)), next: ['Review git diff', 'Run npm run check', 'Verify backend health and every LIVE endpoint', 'Confirm Supabase migration state before applying SQL', 'Deploy only after real staging checks'] }, null, 2));
