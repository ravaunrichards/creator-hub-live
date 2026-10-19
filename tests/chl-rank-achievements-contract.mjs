import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';

const root = new URL('../', import.meta.url);
const read = (path) => readFile(new URL(path, root), 'utf8');
const source = await read('frontend/src/chl-rank-achievements.js');
const index = await read('frontend/index.html');
const sw = await read('frontend/sw.js');
const androidIndex = await read('android/app/src/main/assets/web/index.html');
const androidSw = await read('android/app/src/main/assets/web/sw.js');
const androidJs = await read('android/app/src/main/assets/web/src/chl-rank-achievements.js');
const css = await read('frontend/styles/creator-ranks.css');
const androidCss = await read('android/app/src/main/assets/web/styles/creator-ranks.css');

const rankNames = ['Bronze', 'Silver', 'Gold', 'Platinum', 'Diamond', 'Heroic', 'Master', 'Grandmaster'];
const seasonNames = ['Opening Season', 'Rising Stars', 'Champions League', 'All-Star Season'];
const divisionCodes = ['A1', 'A2', 'A3', 'B1', 'B2', 'B3', 'B4', 'B5', 'C1', 'C2', 'C3', 'C4', 'C5', 'D1', 'D2', 'D3', 'D4', 'D5'];

let lastRank = -1;
for (const name of rankNames) {
  const idx = source.indexOf("name: '" + name + "'");
  assert.ok(idx > lastRank, `${name} must appear in lowest-to-highest tier order`);
  lastRank = idx;
}
for (const name of seasonNames) assert.ok(source.includes("name: '" + name + "'"), `Missing official season: ${name}`);
assert.ok(source.includes("divisions: ['I', 'II', 'III']"), 'Bronze/Silver must use divisions I–III');
assert.ok(source.includes("divisions: ['I', 'II', 'III', 'IV']"), 'Gold/Platinum/Diamond must use divisions I–IV');
assert.ok(!/Variety Starter|\bStarter\b|Free Fire/i.test(source), 'Old generic achievement naming and external brand references must not appear in the CHL UI module');
for (const code of divisionCodes) assert.ok(source.includes("'" + code + "'"), `Missing division code: ${code}`);
for (const required of [
  'Top 100–1,000',
  "CHL.routes['/creator/achievements'] = renderAchievements",
  "CHL.routes['/achievements'] = renderAchievements",
  "'/api/leagues/standings'",
  "'/api/creator/tasks'",
  'A tier is only official when CHL has a verified ranked result and an assigned rank.',
  'Creator Activity Missions'
]) assert.ok(source.includes(required), `Required rank/achievement contract missing: ${required}`);

assert.ok(index.includes('styles/creator-ranks.css?v=6.0.11'), 'Web stylesheet must be linked');
assert.ok(index.includes('src/chl-rank-achievements.js?v=6.0.11'), 'Web rank module must load');
assert.ok(index.indexOf('src/chl-rank-achievements.js') < index.indexOf('window.CHL && window.CHL.start()'), 'Rank route must register before app startup');
assert.ok(sw.includes("'./styles/creator-ranks.css'"), 'Service worker must include rank CSS');
assert.ok(sw.includes("'./src/chl-rank-achievements.js'"), 'Service worker must include rank module');
assert.ok(sw.includes("var VERSION = 'chl-web-v3-3-7'"), 'Service worker cache version must advance');
assert.equal(androidIndex, index, 'Web and Android index files must stay identical');
assert.equal(androidSw, sw, 'Web and Android service workers must stay identical');
assert.equal(androidJs, source, 'Web and Android rank modules must stay identical');
assert.equal(androidCss, css, 'Web and Android rank CSS must stay identical');

// Lightweight runtime smoke test of the route and visible rank/season content.
function fakeElement(tag, attrs = {}, children = []) {
  const node = { tag, attrs, children: [], text: attrs.text == null ? '' : String(attrs.text), disabled: false, listeners: {}, style: {} };
  node.appendChild = (child) => { if (child) node.children.push(child); return child; };
  node.addEventListener = (event, fn) => { node.listeners[event] = fn; };
  Object.defineProperty(node, 'innerHTML', {
    get() { return ''; },
    set(value) { node.children = []; node.htmlAssigned = value; }
  });
  if (Array.isArray(children)) children.forEach((child) => node.appendChild(child));
  else if (children && typeof children === 'object') node.appendChild(children);
  return node;
}
const mockCHL = {
  routes: { '/creator/achievements': () => 'old', '/achievements': () => 'old' },
  el: fakeElement,
  ui: {
    pageHead: (title, sub) => fakeElement('header', { text: title + ' ' + sub }),
    setupNotice: () => fakeElement('div', { text: 'Setup needed' }),
    spinner: () => fakeElement('div', { text: 'Loading' }),
    empty: (icon, title, sub, action) => fakeElement('div', { text: [icon, title, sub].filter(Boolean).join(' ') }, action ? [action] : [])
  },
  sb: { from() { return { select() { return this; }, eq() { return Promise.resolve({ data: [] }); } }; } },
  authenticatedApiRequest(path) {
    if (path === '/api/leagues/standings') return Promise.resolve({ standings: [] });
    if (path === '/api/creator/tasks') return Promise.resolve({ activeTask: { cycleNo: 1, title: 'Go LIVE for 15 minutes', description: 'Host a real session', progress: 0, target: 15 }, history: [] });
    return Promise.reject(new Error('Unexpected endpoint: ' + path));
  },
  configured: true,
  user: { id: 'creator-test' },
  current: { path: '/creator/achievements' },
  fmt: (value) => String(value),
  ago: () => 'just now'
};
const originalAchievementRoute = mockCHL.routes['/creator/achievements'];
const fakeWindow = { CHL: mockCHL };
vm.runInNewContext(source, { window: fakeWindow, Promise, Set, Math, Number, String, Array });
assert.notEqual(mockCHL.routes['/creator/achievements'], originalAchievementRoute, 'Achievement route must be replaced');
const outlet = fakeElement('main');
mockCHL.routes['/creator/achievements'](outlet);
await new Promise((resolve) => setTimeout(resolve, 0));
const collectText = (node) => [node.text || '', ...(node.children || []).map(collectText)].join(' ');
const rendered = collectText(outlet);
for (const name of [...rankNames, ...seasonNames, ...divisionCodes]) assert.ok(rendered.includes(name), `Rendered page missing ${name}`);
for (let i = 0; i < seasonNames.length; i++) assert.ok(rendered.includes('Season ' + (i + 1) + ' — ' + seasonNames[i]), `Rendered page missing exact official season ${i + 1}`);
assert.ok(rendered.includes('Team League Divisions'), 'Division system must be separately visible');
assert.ok(rendered.includes('Creator Activity Missions'), 'Creator missions must stay separate from competitive ranks');

console.log('PASS: approved rank tier order, 18 divisions, four CHL seasons, route replacement, web/Android parity, service-worker assets, and rendered content.');
