import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';

const root = process.cwd();
const read = (p) => fs.readFileSync(path.join(root, p), 'utf8');
const css = read('frontend/styles/app.css');
const js = read('frontend/src/style-switcher.js');
const html = read('frontend/index.html');
const settings = read('frontend/src/pages-settings.js');
const core = read('frontend/src/core.js');
const sw = read('frontend/sw.js');
const migration = read('database/migrations/0038_appearance_preferences.sql');
const compatibilityMigration = read('database/migrations/0039_appearance_contract_compatibility.sql');

// Dependency-free CSS structure guard; full PostCSS parsing is also run in the audit command.
let depth = 0, quote = '', comment = false, escape = false;
for (let i = 0; i < css.length; i++) {
  const c = css[i], n = css[i + 1];
  if (comment) { if (c === '*' && n === '/') { comment = false; i++; } continue; }
  if (quote) { if (escape) { escape = false; continue; } if (c === '\\') { escape = true; continue; } if (c === quote) quote = ''; continue; }
  if (c === '/' && n === '*') { comment = true; i++; continue; }
  if (c === '\"' || c === "'") { quote = c; continue; }
  if (c === '{') depth++;
  if (c === '}') { depth--; assert.ok(depth >= 0, 'CSS contains an unmatched closing brace'); }
}
assert.equal(depth, 0, 'CSS contains unclosed rule blocks');
assert.equal(comment, false, 'CSS contains an unclosed comment');
assert.equal(quote, '', 'CSS contains an unclosed string');
assert.match(html, /src\/style-switcher\.js/);
assert.match(settings, /#\/settings\/appearance/);
assert.match(settings, /CHL\.StyleSwitcher\.render/);
assert.equal((settings.match(/CHL\.route\('\/settings\/appearance'/g) || []).length, 1, 'Appearance route must be registered exactly once');
assert.doesNotMatch(settings, /CHLStyleSystem/, 'Legacy style-system route must not conflict with the new switcher');
assert.match(core, /CHL\.StyleSwitcher\.onAuthChanged/);
assert.match(sw, /src\/style-switcher\.js/);
assert.match(sw, /chl-web-v3-3-4/);
assert.match(migration, /add column if not exists appearance jsonb/i);
assert.match(migration, /NULL means the account has not saved an appearance yet/i);
assert.match(compatibilityMigration, /drop constraint if exists user_settings_appearance_contract/i);
assert.match(compatibilityMigration, /check \(jsonb_typeof\(appearance\) = 'object'\)/i);
assert.doesNotMatch(compatibilityMigration, /set appearance = null/i);
assert.match(js, /outdated appearance contract/i);
assert.match(js, /Your choice remains saved on this device/i);

const themeIds = [...js.matchAll(/^\s{4}(night|ocean|violet|emerald|rose|light):\s+\{/gm)].map(m => m[1]);
assert.deepEqual(themeIds, ['night', 'ocean', 'violet', 'emerald', 'rose', 'light']);
for (const family of ['typography', 'surfaces', 'density', 'motion', 'contrast']) {
  assert.match(js, new RegExp('\\b' + family + ':\\s*\\{'));
}
for (const theme of themeIds) assert.match(css, new RegExp('data-chl-theme="' + theme + '"'));
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
    assert.ok(contrast(txt,bg)>=4.5 && contrast(txt,card)>=4.5 && contrast(mut,bg)>=4.5 && contrast(mut,card)>=4.5, `Text contrast failure in ${id}/${typography}/${surfaces}/${density}/${motion}/${contrastMode}`);
    assert.ok(contrast('#ffffff',t.brand)>=4.5 && contrast('#ffffff',t.brand2)>=4.5, `Primary-button text contrast failure in ${id}`);
  }
}
assert.equal(comboCount, 432, 'Unexpected number of style-family combinations checked');
assert.match(js, /Run style relay tests/);
assert.match(js, /user_settings/);
assert.match(js, /localStorage/);
assert.match(js, /Preview selection/);
assert.match(js, /Apply & save/);

const androidRoot = 'android/app/src/main/assets/web';
for (const rel of ['index.html', 'src/core.js', 'src/pages-settings.js', 'src/style-switcher.js', 'src/ui.js', 'styles/app.css', 'sw.js']) {
  assert.equal(read(path.join('frontend', rel)), read(path.join(androidRoot, rel)), `Android WebView copy differs: ${rel}`);
}
console.log('PASS — Style Switcher contract, CSS block structure, theme registry, 432 contrast combinations, persistence hooks, migration, and Android parity verified.');
