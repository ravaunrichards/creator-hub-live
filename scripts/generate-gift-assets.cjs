// Completes the approved gift catalogue's static artwork by rendering any
// MISSING art/animation SVGs with the SAME template already used by the
// hand-made assets in this repo. It copies the exact per-category colour
// palette, layout, emoji badge, gift name and coin price from the existing
// files so new entries are visually consistent with the originals. It never
// overwrites an existing asset and never invents a palette: a category must
// already have at least one reference asset in the repo.
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const gifts = JSON.parse(
  fs.readFileSync(path.join(root, 'docs/approved-gift-catalogue.json'), 'utf8')
);
const artDir = path.join(root, 'frontend/assets/gifts/art');
const animDir = path.join(root, 'frontend/assets/gifts/animations');

// Extract the 3-stop palette (dark, mid, light) from an existing art SVG.
function paletteFrom(file) {
  const t = fs.readFileSync(file, 'utf8');
  const stops = [...t.matchAll(/stop-color="(#[0-9a-fA-F]+)"/g)].map((m) => m[1]);
  // The art gradient #g defines dark/mid/light as its first three stops.
  return { dark: stops[0], mid: stops[1], light: stops[2] };
}

// Build a palette map keyed by category using the FIRST existing art file we
// find for that category. Fail loudly if a category has no reference art.
const paletteByCategory = {};
for (const g of gifts) {
  if (paletteByCategory[g.category]) continue;
  const p = path.join(artDir, g.assetKey + '.svg');
  if (fs.existsSync(p)) paletteByCategory[g.category] = paletteFrom(p);
}

function esc(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function artSvg(gift, pal) {
  const label = esc(gift.name);
  const emoji = esc(gift.emoji);
  return `<svg xmlns="http://www.w3.org/2000/svg" width="240" height="200" viewBox="0 0 240 200" role="img" aria-label="${label}">
<defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop stop-color="${pal.dark}"/><stop offset=".55" stop-color="${pal.mid}"/><stop offset="1" stop-color="${pal.light}"/></linearGradient><radialGradient id="glow"><stop stop-color="${pal.light}" stop-opacity=".75"/><stop offset="1" stop-color="${pal.mid}" stop-opacity="0"/></radialGradient></defs>
<rect x="4" y="4" width="232" height="192" rx="28" fill="#090d1d"/>
<rect x="6" y="6" width="228" height="188" rx="26" fill="url(#g)" opacity=".96"/>
<circle cx="120" cy="83" r="78" fill="url(#glow)"/>
<circle cx="120" cy="82" r="56" fill="none" stroke="${pal.light}" stroke-width="1.5" stroke-opacity=".7" stroke-dasharray="7 3" transform="rotate(51 120 82)"/>
<path d="M 101 46 l 5 13 14 2 -10 9 3 14 -12 -7 -12 7 3 -14 -10 -9 14 -2z" fill="${pal.light}" opacity=".82" transform="rotate(16 101 64)"/>
<circle cx="146" cy="79" r="5" fill="${pal.light}" opacity=".8"/>
<circle cx="174" cy="111" r="4" fill="#fff" opacity=".7"/>
<text x="120" y="101" text-anchor="middle" font-size="55" font-family="'Segoe UI Emoji','Apple Color Emoji',sans-serif" filter="drop-shadow(0 4px 4px rgba(0,0,0,.28))">${emoji}</text>
<path d="M42 139 H198" stroke="${pal.light}" stroke-opacity=".62" stroke-width="1.2"/>
<text x="120" y="160" text-anchor="middle" font-family="system-ui,sans-serif" font-weight="800" font-size="14" fill="#ffffff" stroke="#101020" stroke-width=".6" paint-order="stroke">${label}</text>
<text x="120" y="180" text-anchor="middle" font-family="system-ui,sans-serif" font-size="10" font-weight="700" letter-spacing="1.5" fill="${pal.light}">CREATOR HUB GIFT</text></svg>`;
}

function animSvg(gift, pal) {
  const label = esc(gift.name);
  const emoji = esc(gift.emoji);
  const price = Number(gift.coinPrice).toLocaleString('en-US');
  return `<svg xmlns="http://www.w3.org/2000/svg" width="420" height="320" viewBox="0 0 420 320" role="img" aria-label="Animated ${label}">
<defs><radialGradient id="b"><stop stop-color="${pal.mid}" stop-opacity=".76"/><stop offset="1" stop-color="#080c18" stop-opacity="0"/></radialGradient><linearGradient id="r"><stop stop-color="${pal.dark}"/><stop offset="1" stop-color="${pal.light}"/></linearGradient></defs>
<circle cx="210" cy="145" r="130" fill="url(#b)"/>
<circle cx="210" cy="145" r="81" fill="none" stroke="${pal.mid}" stroke-width="3" stroke-dasharray="16 13"><animateTransform attributeName="transform" type="rotate" from="0 210 145" to="360 210 145" dur="4.1s" repeatCount="indefinite"/></circle>
<circle cx="210" cy="145" r="97" fill="none" stroke="${pal.light}" stroke-opacity=".8" stroke-width="2" stroke-dasharray="2 14"><animateTransform attributeName="transform" type="rotate" from="360 210 145" to="0 210 145" dur="4.8s" repeatCount="indefinite"/></circle>
<g><animateTransform attributeName="transform" type="translate" values="0 4;0 -8;0 4" dur="1.3s" repeatCount="indefinite"/><text x="210" y="177" font-size="94" text-anchor="middle" font-family="'Segoe UI Emoji','Apple Color Emoji',sans-serif">${emoji}</text></g>
<path d="M70 220 Q210 188 350 220" fill="none" stroke="url(#r)" stroke-width="2" stroke-opacity=".7"/>
<text x="210" y="260" text-anchor="middle" fill="#fff" font-family="system-ui,sans-serif" font-weight="850" font-size="18">${label}</text>
<text x="210" y="284" text-anchor="middle" fill="${pal.light}" font-family="system-ui,sans-serif" font-size="12" letter-spacing="2">${price} COINS</text></svg>`;
}

let artMade = 0;
let animMade = 0;
const skipped = [];
for (const gift of gifts) {
  const pal = paletteByCategory[gift.category];
  if (!pal) {
    skipped.push(gift.name + ' (no reference palette for ' + gift.category + ')');
    continue;
  }
  const artPath = path.join(artDir, gift.assetKey + '.svg');
  const animPath = path.join(animDir, gift.assetKey + '.svg');
  if (!fs.existsSync(artPath)) {
    fs.writeFileSync(artPath, artSvg(gift, pal));
    artMade++;
  }
  if (!fs.existsSync(animPath)) {
    fs.writeFileSync(animPath, animSvg(gift, pal));
    animMade++;
  }
}

console.log('Generated art SVGs:', artMade);
console.log('Generated animation SVGs:', animMade);
if (skipped.length) {
  console.log('SKIPPED (no palette):');
  skipped.forEach((s) => console.log('  -', s));
}
