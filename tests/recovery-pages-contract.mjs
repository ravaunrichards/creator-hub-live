import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const required = [
  'frontend/src/pages-teams.js', 'frontend/src/pages-accessibility.js',
  'frontend/src/pages-account.js', 'frontend/src/pages-community.js',
  'frontend/src/pages-profile.js', 'frontend/src/pages-platform-tools.js',
  'frontend/src/studio-edition.js', 'frontend/styles/studio-edition.css',
  'frontend/styles/nexus-edition.css', 'frontend/styles/chl-style-system.css',
];
for (const rel of required) {
  const p = path.join(root, rel);
  if (!fs.existsSync(p) || !fs.statSync(p).size) throw new Error(`Recovered page asset is missing or empty: ${rel}`);
}
const index = fs.readFileSync(path.join(root, 'frontend/index.html'), 'utf8');
for (const rel of required.filter(x => x.startsWith('frontend/src/')).map(x => x.slice('frontend/'.length))) {
  if (!index.includes(rel)) throw new Error(`HTML shell does not load ${rel}`);
}
const room = fs.readFileSync(path.join(root, 'frontend/src/pages-room.js'), 'utf8');
if (!room.includes("text: 'Stop screen-share LIVE'")) throw new Error('Dedicated screen-share LIVE stop control is missing.');

const creator = fs.readFileSync(path.join(root, 'frontend/src/pages-creator.js'), 'utf8');
const ranks = fs.readFileSync(path.join(root, 'frontend/src/chl-rank-achievements.js'), 'utf8');
if (creator.includes('Create-team form') || creator.includes('Join request sent')) throw new Error('Teams page still contains a fake create/join success action.');
if (!creator.includes("href:'#/teams/create'") || !creator.includes("'/api/teams/'+encodeURIComponent(id)+'/join'")) throw new Error('Teams page does not use the real team create/join flows.');
for (const tier of ['Bronze', 'Silver', 'Gold', 'Platinum', 'Diamond', 'Heroic', 'Master', 'Grandmaster']) if (!ranks.includes("name: '" + tier + "'")) throw new Error(`Official rank tier missing: ${tier}`);
for (const season of ['Opening Season', 'Rising Stars', 'Champions League', 'All-Star Season']) if (!ranks.includes("name: '" + season + "'")) throw new Error(`Official CHL season missing: ${season}`);
const divisions = ['A1', 'A2', 'A3', 'B1', 'B2', 'B3', 'B4', 'B5', 'C1', 'C2', 'C3', 'C4', 'C5', 'D1', 'D2', 'D3', 'D4', 'D5'];
for (const division of divisions) if (!ranks.includes("'" + division + "'")) throw new Error(`Official team division missing: ${division}`);

const sw = fs.readFileSync(path.join(root, 'frontend/sw.js'), 'utf8');
if (!sw.includes('chl-web-v3-3-11')) throw new Error('Service-worker cache was not invalidated after restoring page assets.');
for (const rel of ['index.html', 'sw.js']) {
  const web = fs.readFileSync(path.join(root, 'frontend', rel));
  const android = fs.readFileSync(path.join(root, 'android/app/src/main/assets/web', rel));
  if (!web.equals(android)) throw new Error(`Android shell drift detected: ${rel}`);
}
for (const rel of required) {
  const p = path.join(root, rel);
  const relative = rel.replace(/^frontend\//, '');
  const mirror = relative.startsWith('src/')
    ? path.join(root, 'android/app/src/main/assets/web', relative)
    : path.join(root, 'android/app/src/main/assets/web', relative);
  if (!fs.existsSync(mirror) || !fs.readFileSync(p).equals(fs.readFileSync(mirror))) throw new Error(`Android WebView asset drift detected: ${relative}`);
}
console.log(`PASS — ${required.length} missing page/style assets reconstructed and present`);
console.log('PASS — app shell loads restored page modules');
console.log('PASS — screen-share LIVE has a dedicated end control');
console.log('PASS — service-worker cache version invalidated');
console.log('PASS — team create/join buttons use real routes; official ranks, divisions and seasons are present');
console.log('PASS — Android WebView copies match restored web assets');
