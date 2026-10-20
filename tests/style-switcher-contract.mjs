import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';

const root = process.cwd();
const read = (p) => fs.readFileSync(path.join(root, p), 'utf8');
const css = read('frontend/styles/app.css');
const platformCss = read('frontend/styles/platform-tools.css');
const js = read('frontend/src/style-switcher.js');
const html = read('frontend/index.html');
const integration = read('frontend/src/style-switcher-integration.js');
const sw = read('frontend/sw.js');
const migration = read('database/migrations/0038_appearance_preferences.sql');

// CSS structure guard for both stylesheets that control the current visual system.
function assertCssStructure(source, file) {
  let depth = 0, quote = '', comment = false, escape = false;
  for (let i = 0; i < source.length; i++) {
    const c = source[i], n = source[i + 1];
    if (comment) { if (c === '*' && n === '/') { comment = false; i++; } continue; }
    if (quote) { if (escape) { escape = false; continue; } if (c === '\\') { escape = true; continue; } if (c === quote) quote = ''; continue; }
    if (c === '/' && n === '*') { comment = true; i++; continue; }
    if (c === '"' || c === "'") { quote = c; continue; }
    if (c === '{') depth++;
    if (c === '}') { depth--; assert.ok(depth >= 0, `${file} has an unmatched closing brace`); }
  }
  assert.equal(depth, 0, `${file} has unclosed rule blocks`);
  assert.equal(comment, false, `${file} has an unclosed comment`);
  assert.equal(quote, '', `${file} has an unclosed string`);
}
assertCssStructure(css, 'app.css');
assertCssStructure(platformCss, 'platform-tools.css');
assert.match(html, /src\/style-switcher\.js/);
assert.match(html, /src\/style-switcher-integration\.js/);
assert.doesNotMatch(html, /src\/style-system\.js/, 'Legacy appearance writer must not race the new preference format');
assert.match(integration, /CHL\.routes\['\/settings\/appearance'\]\s*=/);
assert.match(integration, /CHL\.StyleSwitcher\.render/);
assert.match(integration, /onAuthChanged/);
assert.match(sw, /src\/style-switcher-integration\.js/);
assert.match(sw, /chl-web-v3-3-12/);
assert.match(html, /styles\/platform-tools\.css\?v=6\.0\.10/);
assert.match(html, /sw\.js\?v=6\.0\.14/);
assert.doesNotMatch(html, /chcn_appearance/, 'CHL must not bootstrap a separate CHCN appearance theme');
for (const asset of ['styles/studio-edition.css','styles/nexus-edition.css','styles/platform-responsive.css','styles/chl-style-system.css','styles/platform-tools.css','src/pages-teams.js','src/pages-accessibility.js','src/pages-account.js','src/pages-community.js','src/pages-profile.js','src/studio-edition.js','src/swipe-feed.js','src/pages-platform-tools.js','src/style-switcher.js','src/style-switcher-integration.js']) {
  assert.ok(sw.includes("'./" + asset + "'"), `Service-worker offline shell is missing ${asset}`);
}
assert.match(migration, /add column if not exists appearance jsonb/i);
assert.match(migration, /NULL means the account has not saved an appearance yet/i);

const themeIds = [...js.matchAll(/^\s{4}(night|ocean|violet|emerald|rose|light):\s+\{/gm)].map(m => m[1]);
assert.deepEqual(themeIds, ['night', 'ocean', 'violet', 'emerald', 'rose', 'light']);
for (const family of ['typography', 'surfaces', 'density', 'motion', 'contrast']) assert.match(js, new RegExp('\\b' + family + ':\\s*\\{'));
for (const theme of themeIds) {
  assert.match(css, new RegExp('data-chl-theme="' + theme + '"'));
  assert.match(platformCss, new RegExp('data-chl-theme="' + theme + '"'));
}
assert.match(platformCss, /Appearance token bridge/);
assert.match(platformCss, /--chl-front-accent:\s*var\(--brand\)/);
assert.match(platformCss, /--chl-front-panel:\s*var\(--card\)/);
assert.match(platformCss, /data-chl-density="compact"/);
assert.match(platformCss, /data-chl-contrast="high"/);
assert.match(platformCss, /Apply the selected CHL theme to the real Nexus shell/);
assert.match(platformCss, /studio-nav-link\.active \{ box-shadow: inset 3px 0 var\(--brand\); \}/);
assert.match(platformCss, /data-chl-theme="light"\] #app\.studio-root \.studio-sidebar \{ background: #111a2c; \}/);
for (const selector of ['studio-sidebar','studio-topbar','studio-search input','studio-feature-card','nexus-mission-panel','studio-outlet .input']) {
  assert.ok(platformCss.includes(selector), `Theme-aware shell styling is missing ${selector}`);
}
assert.match(js, /chl_appearance_v2/);
assert.match(js, /migrateLegacyLocalPreference/);
assert.match(js, /updateComboPreview/);
const themeLines = js.split(/\r?\n/).filter(line => /^\s{4}(night|ocean|violet|emerald|rose|light):\s+\{/.test(line));
const parsedThemes = Object.fromEntries(themeLines.map(line => {
  const id = line.match(/^\s{4}(\w+):/)[1];
  const values = Object.fromEntries([...line.matchAll(/(bg|bg2|card|line|txt|mut|brand|brand2):\s*'([^']+)'/g)].map(m => [m[1], m[2]]));
  return [id, values];
}));
function luminance(hex) { const rgb=[0,2,4].map(i=>parseInt(hex.slice(1).slice(i,i+2),16)/255).map(v=>v<=0.04045?v/12.92:Math.pow((v+0.055)/1.055,2.4)); return .2126*rgb[0]+.7152*rgb[1]+.0722*rgb[2]; }
function contrast(a,b) { const x=luminance(a),y=luminance(b); return (Math.max(x,y)+.05)/(Math.min(x,y)+.05); }
let comboCount=0;
for (const [id,t] of Object.entries(parsedThemes)) {
  for (const typography of ['system','studio','readable']) for (const surfaces of ['standard','soft','sharp']) for (const density of ['comfortable','compact']) for (const motion of ['standard','reduced']) for (const contrastMode of ['standard','high']) {
    comboCount++;
    const txt=contrastMode==='high'?(id==='light'?'#000000':'#ffffff'):t.txt;
    const mut=contrastMode==='high'?(id==='light'?'#171717':'#ffffff'):t.mut;
    const bg=id==='light'&&contrastMode==='high'?'#ffffff':t.bg;
    const card=id==='light'&&contrastMode==='high'?'#ffffff':t.card;
    assert.ok(contrast(txt,bg)>=4.5 && contrast(txt,card)>=4.5 && contrast(mut,bg)>=4.5 && contrast(mut,card)>=4.5, `Contrast failure in ${id}/${typography}/${surfaces}/${density}/${motion}/${contrastMode}`);
    assert.ok(contrast('#ffffff',t.brand)>=4.5 && contrast('#ffffff',t.brand2)>=4.5, `Primary-button text contrast failure in ${id}`);
  }
}
assert.equal(comboCount, 432, 'Expected 432 theme/family combinations');
assert.match(js, /Run style relay tests/);
assert.match(js, /runtimeErrors/);
assert.match(js, /overflowCombinations/);
assert.match(js, /getComputedStyle/);
assert.match(js, /user_settings/);
assert.match(js, /localStorage/);
assert.match(js, /Preview selection/);
assert.match(js, /Apply & save/);

const androidRoot = 'android/app/src/main/assets/web';
for (const rel of ['index.html', 'src/style-switcher.js', 'src/style-switcher-integration.js', 'styles/platform-tools.css', 'sw.js']) {
  assert.equal(read(path.join('frontend', rel)), read(path.join(androidRoot, rel)), `Android WebView copy differs: ${rel}`);
}
console.log('PASS — source integration, legacy preference migration, both CSS structures, 6 theme bridges, 432 static contrast combinations, offline shell, and Android parity.');
console.log('NOTE — this is a static contract test; it does not replace a real-browser viewport/device run.');
