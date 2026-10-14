import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const manifest = JSON.parse(fs.readFileSync(path.join(root, 'docs/gift-asset-manifest.json'), 'utf8'));
assert.equal(manifest.gifts.length, 90, 'asset manifest must map all 90 approved gift designs');
assert.ok(manifest.purpose.includes('prices are intentionally excluded'), 'asset manifest must explicitly keep pricing database-authoritative');
const names = new Set();
const keys = new Set();
const soundHashes = new Set();
for (const gift of manifest.gifts) {
  assert.ok(gift.name && gift.assetKey && gift.emoji, 'every asset record needs a name, key and emoji');
  assert.match(gift.assetKey, /^[a-z0-9-]+$/, `${gift.name} asset key must be safe`);
  assert.ok(!('coinPrice' in gift), 'historical prices must not be copied into the asset manifest');
  assert.ok(!names.has(gift.name.toLowerCase()), `duplicate gift name: ${gift.name}`);
  assert.ok(!keys.has(gift.assetKey), `duplicate asset key: ${gift.assetKey}`);
  names.add(gift.name.toLowerCase()); keys.add(gift.assetKey);
  for (const [kind, ext] of [['art', 'svg'], ['animations', 'svg'], ['sounds', 'wav']]) {
    const file = path.join(root, 'frontend', 'assets', 'gifts', kind, `${gift.assetKey}.${ext}`);
    assert.ok(fs.existsSync(file), `missing ${kind} asset for ${gift.name}: ${file}`);
    if (kind === 'sounds') {
      const wav = fs.readFileSync(file);
      assert.ok(wav.length > 44, `${gift.name} sound must contain audio data`);
      assert.equal(wav.toString('ascii', 0, 4), 'RIFF', `${gift.name} sound must be RIFF WAV`);
      assert.equal(wav.toString('ascii', 8, 12), 'WAVE', `${gift.name} sound must be WAVE audio`);
      const samples = wav.subarray(44);
      let audible = false;
      for (let i = 0; i + 1 < samples.length; i += 2) { if (samples.readInt16LE(i) !== 0) { audible = true; break; } }
      assert.ok(audible, `${gift.name} sound must contain non-zero PCM samples`);
      const digest = createHash('sha256').update(wav).digest('hex');
      assert.ok(!soundHashes.has(digest), `${gift.name} sound must not duplicate another gift sound`);
      soundHashes.add(digest);
    } else {
      const svg = fs.readFileSync(file, 'utf8');
      assert.match(svg, /^\s*<svg\b/i, `${gift.name} ${kind} must be SVG`);
      assert.match(svg, /<\/svg>\s*$/i, `${gift.name} ${kind} must close its SVG root`);
    }
  }
}
const badges = ['supporter','silver-gifter','gold-gifter','ultimate-gifter','royal-gifter','diamond-gifter'];
for (const badge of badges) assert.ok(fs.existsSync(path.join(root, 'frontend/assets/gifts/badges', `${badge}.svg`)), `missing gifter badge ${badge}`);
assert.ok(fs.existsSync(path.join(root, 'frontend/assets/gifts/multi-guest.svg')), 'multi-guest artwork must be included');
const offlineManifest = JSON.parse(fs.readFileSync(path.join(root, 'frontend/assets/gifts/asset-manifest.json'), 'utf8'));
for (const gift of manifest.gifts) for (const kind of ['art', 'animations', 'sounds']) {
  assert.ok(offlineManifest.assets.includes(`./assets/gifts/${kind}/${gift.assetKey}.${kind === 'sounds' ? 'wav' : 'svg'}`), `offline cache manifest missing ${kind} for ${gift.name}`);
}
for (const asset of [...badges.map(name => `./assets/gifts/badges/${name}.svg`), './assets/gifts/multi-guest.svg']) assert.ok(offlineManifest.assets.includes(asset), `offline cache manifest missing ${asset}`);
const server = fs.readFileSync(path.join(root, 'backend/src/server.js'), 'utf8');
const backendManifest = JSON.parse(fs.readFileSync(path.join(root, 'backend/src/gift-asset-manifest.json'), 'utf8'));
assert.deepEqual(backendManifest.gifts, manifest.gifts, 'backend and documentation asset manifests must match');
assert.match(server, /gift-asset-manifest\.json/, 'backend must load the price-free gift asset manifest');
assert.match(server, /\/assets\/gifts\/art\//, 'gift API must supply local art fallbacks');
assert.match(server, /\/assets\/gifts\/animations\//, 'gift API must supply local animation fallbacks');
assert.match(server, /\/assets\/gifts\/sounds\//, 'gift API must supply local sound paths');
const room = fs.readFileSync(path.join(root, 'frontend/src/pages-room.js'), 'utf8');
assert.match(room, /var GIFTS = \[\];/, 'LIVE must not display invented placeholder gifts');
assert.match(room, /playGiftSound\(gift\.soundUrl\)/, 'successful server-confirmed gifts must play the matching sound');
assert.match(room, /ui\.flyGift\(gift\.em, gift\.animationUrl \|\| gift\.graphicUrl\)/, 'successful server-confirmed gifts must use their artwork/animation');
assert.equal(soundHashes.size, 90, 'all 90 WAV effects must be distinct');
console.log('PASS — 90 gift art assets, 90 animations, 90 distinct audible WAVs, 6 badges and multi-guest artwork are present; gift pricing remains database-authoritative.');
