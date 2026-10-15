import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
function assert(ok, message) { if (!ok) throw new Error(message); }
const gifts = path.join(ROOT, 'frontend', 'assets', 'gifts');
const android = path.join(ROOT, 'android', 'app', 'src', 'main', 'assets', 'web');
const assetSets = {};
for (const dir of ['art', 'animations', 'sounds', 'badges']) {
  const files = fs.readdirSync(path.join(gifts, dir)).filter((n) => !n.startsWith('.'));
  assetSets[dir] = new Set(files.map((n) => path.parse(n).name));
  assert(files.length > 0, `Gift asset directory is empty: ${dir}`);
  for (const file of files) {
    const a = fs.readFileSync(path.join(gifts, dir, file));
    const b = fs.readFileSync(path.join(android, 'assets', 'gifts', dir, file));
    assert(a.equals(b), `Android gift asset differs: ${dir}/${file}`);
    assert(a.length > 0, `Empty gift asset: ${dir}/${file}`);
    if (dir === 'sounds') assert(a.subarray(0, 4).toString() === 'RIFF' && a.subarray(8, 12).toString() === 'WAVE', `Invalid WAV header: ${file}`);
  }
}
for (const key of assetSets.art) {
  assert(assetSets.animations.has(key), `Missing matching gift animation: ${key}`);
  assert(assetSets.sounds.has(key), `Missing matching gift sound: ${key}`);
}
const room = fs.readFileSync(path.join(ROOT, 'frontend', 'src', 'pages-room.js'), 'utf8');
assert(room.includes("el('button'") && room.includes("assets/gifts/art/") && room.includes("assets/gifts/animations/") && room.includes("assets/gifts/sounds/"), 'LIVE gift UI is not wired to accessible buttons and restored assets.');
assert(room.includes("authenticatedApiRequest('/api/gifts'") && room.includes("authenticatedApiRequest('/api/wallet/gift'"), 'LIVE gifts are not sourced and sent through the authenticated backend APIs.');
const core = fs.readFileSync(path.join(ROOT, 'frontend', 'src', 'core.js'), 'utf8');
const html = fs.readFileSync(path.join(ROOT, 'frontend', 'index.html'), 'utf8');
const sw = fs.readFileSync(path.join(ROOT, 'frontend', 'sw.js'), 'utf8');
assert(core.includes("'Creator Hub Creator Network'"), 'Runtime brand fallback is not Creator Hub Creator Network.');
assert(html.includes('<title>Creator Hub Creator Network'), 'Document title does not identify Creator Hub Creator Network.');
assert(sw.includes("chcn-web-nexus-v6-0-2") && sw.includes("./assets/gifts/asset-manifest.json"), 'Service worker cache version or gift-asset manifest precache is stale.');
for (const rel of ['src/core.js', 'src/pages-settings.js', 'styles/app.css', 'sw.js', 'config.js', 'index.html']) {
  const a = fs.readFileSync(path.join(ROOT, 'frontend', rel));
  const b = fs.readFileSync(path.join(android, rel));
  assert(a.equals(b), `Android web runtime differs from frontend: ${rel}`);
}
const env = fs.readFileSync(path.join(ROOT, 'backend', '.env.example'), 'utf8');
const secretLines = env.split(/\r?\n/).filter((line) => /^(SUPABASE_SERVICE_ROLE_KEY|LIVEKIT_API_SECRET|PAYPAL_CLIENT_SECRET)=/.test(line));
assert(secretLines.every((line) => { const v = line.split('=', 2)[1] || ''; return v.startsWith('YOUR_') || v.startsWith('replace_with_'); }), 'Example environment file contains a non-placeholder secret.');
console.log('PASS — restored gift assets exist and match Android copies');
console.log('PASS — WAV headers are valid');
console.log('PASS — LIVE gifts use accessible buttons and backend-authoritative catalogue/transactions');
console.log('PASS — environment template contains no live-looking private secrets');
console.log('PASS — CHL runtime branding and service-worker cache are consistent');
console.log('PASS — key Android web runtime files match frontend byte-for-byte');
