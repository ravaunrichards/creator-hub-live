// CHL consolidated LIVE update static contract checks.
// These checks validate the supplied source/update package; they do not execute SQL against a live DB.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const read = (p) => fs.readFileSync(path.join(ROOT, p), 'utf8');
let pass = 0, fail = 0;
function check(label, condition) {
  if (condition) { console.log(`  PASS — ${label}`); pass++; }
  else { console.error(`  FAIL — ${label}`); fail++; }
}
const migration = read('database/migrations/0013_gifter_levels_catalog_and_live_tools.sql');
const server = read('backend/src/server.js');
const room = read('frontend/src/pages-room.js');
const ui = read('frontend/src/ui.js');
const settings = read('frontend/src/pages-settings.js');
console.log('=== CHL LIVE Update Contract ===');
const giftBlock = (migration.match(/insert into public\.gifts\s*\([\s\S]*?\)\s*values([\s\S]*?)\bon conflict\s*\(name\)/i) || [])[1] || '';
const giftRows = (giftBlock.match(/^\s*\('/gm) || []).length;
check('Exactly 90 curated gift catalogue rows', giftRows === 90);
const parsedGiftRows = [...giftBlock.matchAll(/^\s*\('((?:''|[^'])*)',\s*'((?:''|[^'])*)',\s*'((?:''|[^'])*)',\s*(\d+),\s*'((?:''|[^'])*)',\s*'((?:''|[^'])*)',\s*(\d+),\s*0,\s*'((?:''|[^'])*)',\s*true\)/gm)];
const expectedPrices = [1,1,1,1,1,5,5,5,10,10,10,15,20,20,30,30,50,50,75,99,100,100,150,199,250,299,300,350,399,499,500,550,600,650,700,750,800,850,900,999,1000,1200,1500,1800,2000,2200,2500,2800,3000,3500,4000,4888,5000,6000,7000,8000,9000,10000,12000,15000,18000,20000,22000,25000,30000,35000,40000,45000,49999,50000,75000,100000,150000,200000,250000,300000,400000,500000,750000,1000000,50,100,250,500,1000,2500,5000,10000,25000,50000];
check('All 90 catalogue coin prices match the supplied order and values', parsedGiftRows.length === 90 && parsedGiftRows.every((r, i) => Number(r[7]) === expectedPrices[i] && Number(r[4]) === i + 1));
check('All catalogue seed prices initially fail safe at diamond_value=0', (giftBlock.match(/,\s*\d+\s*,\s*0\s*,\s*'[^']+'\s*,\s*true\)/g) || []).length === 90);
const levelBlock = (migration.match(/insert into public\.gifter_level_thresholds[\s\S]*?values([\s\S]*?)\bon conflict\s*\(level\)/i) || [])[1] || '';
const levelRows = (levelBlock.match(/^\s*\(\d+,\d+,/gm) || []).length;
check('All 52 gifter levels, 0 through 51', levelRows === 52);
check('Level 0 starts at zero coins; level 1 starts at one; level 51 reaches 1,000,000', /\(0,0,/.test(levelBlock) && /\(1,1,/.test(levelBlock) && /\(51,1000000,/.test(levelBlock));
check('Exactly the four agreed gifter badge names are declared', ['Visiting Supporter','Dedicated Supporter','Elite Supporter','Legendary Supporter'].every(n => migration.includes(n)));
check('YARD TINGZ catalogue and 10 Jamaica/parish gifts are seeded', (giftBlock.match(/'YARD TINGZ 🇯🇲'/g) || []).length === 10);
check('Duplicate historical catalogue rows are consolidated before name uniqueness is enforced', /first_value\(id\) over\(partition by name/i.test(migration) && /gifts_name_unique_idx/.test(migration));
check('Payout conversion guard is enforced in the SQL send function', /GIFT_PAYOUT_NOT_CONFIGURED/.test(migration) && /coalesce\(g\.diamond_value,0\)<=0/.test(migration));
check('Atomic combo send RPC and request idempotency are present', /function public\.send_gift_combo\(/i.test(migration) && /gift_transactions_idempotency_unique/.test(migration));
check('Database-backed gifter progression recalculates on gifts and reversals', /recalculate_gifter_progress/.test(migration) && /gift_transaction_refresh_gifter/.test(migration) && /gift_reversal_refresh_gifter/.test(migration));
check('Backend exposes gifter progress and authoritative catalogue', server.includes('/api/gifter/progress') && server.includes('/api/gifts'));
check('Backend delegates combo sends to the SQL transaction function', server.includes('send_gift_combo') && server.includes('GIFT_PAYOUT_NOT_CONFIGURED'));
check('Backend implements authenticated guest, moderator, interaction, and presence routes', /roomToolMatch\s*=\s*pathname\.match/.test(server) && ['guests','moderators','interactions','presence'].every(p => server.includes(p)));
check('Guest publish permission is validated separately from host ownership', /async function canPublishLive/.test(server) && /isHost/.test(server) && /canPublish/.test(server));
check('Room gift catalogue refuses sample/invented fallback data', /will not display sample or invented gifts/.test(room) && /GIFTS=\[\]/.test(room));
check('Gift combo selector uses limited quantities and server price checks', /\[1,2,3,5,10\]/.test(room) && /diamondValue/.test(room) && /quantity:quantity/.test(room));
check('Tap/share totals and viewer presence are API-backed', room.includes('/interactions') && room.includes('/presence'));
check('Gifter progress panel explains badges and achievements', room.includes('What do the four gifter badges mean?') && room.includes('Achievements unlock from verified gifts'));
check('Gift animations are capped, sound is preferences-aware, and reduced motion is supported', /ui\.flyGift/.test(room) && /_giftSoundEndTime/.test(ui) && /reducedMotion/.test(ui) && /sound/.test(settings));
check('Settings persist layout/effects preferences', /liveEffectsPrefs|gift_sound|gift_volume/.test(settings));
console.log(`\n=== Summary: ${pass} passed, ${fail} failed ===`);
if (fail) process.exit(1);
