import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (p) => fs.readFileSync(path.join(root, p), 'utf8');
const checks = [];
function check(name, fn) { fn(); checks.push(name); }

const webIndex = read('frontend/index.html');
const androidIndex = read('android/app/src/main/assets/web/index.html');
const webJs = read('frontend/src/pages-platform-tools.js');
const androidJs = read('android/app/src/main/assets/web/src/pages-platform-tools.js');
const webCss = read('frontend/styles/platform-tools.css');
const androidCss = read('android/app/src/main/assets/web/styles/platform-tools.css');
const webSw = read('frontend/sw.js');
const androidSw = read('android/app/src/main/assets/web/sw.js');
const migration41 = read('database/migrations/0041_creator_missions_battles_achievement_workflows.sql');
const migration42 = read('database/migrations/0042_secure_my_gift_history.sql');
const migration43 = read('database/migrations/0043_creator_achievement_read_grant.sql');
const migration44 = read('database/migrations/0044_accurate_profile_likes_and_net_gift_rankings.sql');

check('web and Android entry points are byte-identical', () => assert.equal(webIndex, androidIndex));
check('web and Android platform tool script are byte-identical', () => assert.equal(webJs, androidJs));
check('web and Android platform styles are byte-identical', () => assert.equal(webCss, androidCss));
check('web and Android service workers are byte-identical', () => assert.equal(webSw, androidSw));
check('service-worker cache version and shell include the new platform code', () => {
  assert.match(webSw, /chl-web-v3-3-5/);
  assert.match(webSw, /src\/pages-platform-tools\.js\?v=6\.0\.8/);
  assert.match(webSw, /styles\/platform-tools\.css\?v=6\.0\.8/);
  assert.match(webIndex, /register\('sw\.js\?v=6\.0\.8'\)/);
});
check('platform script loads after swipe-feed and before CHL.start()', () => {
  assert.ok(webIndex.indexOf('src/swipe-feed.js') < webIndex.indexOf('src/pages-platform-tools.js'));
  assert.ok(webIndex.indexOf('src/pages-platform-tools.js') < webIndex.indexOf('window.CHL && window.CHL.start()'));
});
check('profile extension preserves the existing profile implementation and uses a real likes RPC', () => {
  assert.match(webJs, /var priorProfileRoute=CHL\.routes&&CHL\.routes\['\/profile'\]/);
  assert.match(webJs, /chl_total_profile_likes/);
  assert.match(webJs, /followers/);
  assert.match(webJs, /following/);
  assert.match(webJs, /reposts/);
  assert.match(webJs, /favorites/);
});
check('private drafts have edit, publish, delete and owner-scoped database filters', () => {
  assert.match(webJs, /Save draft/);
  assert.match(webJs, /Edit draft/);
  assert.match(webJs, /Permanently delete this draft/);
  assert.match(webJs, /eq\('author_id',CHL\.user\.id\).*eq\('is_draft',true\)/);
});
check('Find Creators is real profile search and is wired to the current navigation path', () => {
  assert.match(webJs, /CHL\.route\('\/find-creators'/);
  assert.match(webJs, /CHL\.routes\['\/search'\]=CHL\.routes\['\/find-creators'\]/);
  assert.match(webJs, /from\('profiles'\)/);
  assert.match(webJs, /\/api\/social\/follows/);
});
check('For You and Following use the existing swipe-feed engine', () => {
  assert.match(webJs, /CHL\.renderSwipeFeed\(outlet,'foryou'\)/);
  assert.match(webJs, /CHL\.renderSwipeFeed\(outlet,'following'\)/);
});
check('Explore LIVE is filtered to actual non-ended live sessions', () => {
  assert.match(webJs, /from\('live_sessions'\)\.select\('id,host_id,title,category,status,viewer_count,started_at,ended_at,audience,cover_image_url,media_mode'\)\.eq\('status','live'\)\.is\('ended_at',null\)/);
  assert.match(webJs, /CHL\.routes\['\/discover'\]=renderExploreLive/);
});
check('missions use database-verifiable progress and secure claim RPC', () => {
  assert.match(webJs, /chl_list_creator_missions/);
  assert.match(webJs, /chl_claim_creator_mission/);
  assert.match(migration41, /create or replace function public\.chl_claim_creator_mission/);
  assert.match(migration41, /revoke all on function public\.chl_claim_creator_mission\(uuid\) from public, anon/);
});
check('battles use authenticated invitation, response and cancellation RPCs', () => {
  for (const name of ['chl_create_creator_battle','chl_respond_creator_battle','chl_cancel_creator_battle']) {
    assert.ok(webJs.includes(name));
    assert.ok(migration41.includes('function public.' + name));
  }
});
check('gift history is account-scoped and excludes reversed transactions', () => {
  assert.match(webJs, /chl_list_my_gift_history/);
  assert.match(migration42, /g\.sender_id = v_uid or g\.recipient_id = v_uid/);
  assert.match(migration42, /r\.transaction_id is null/);
  assert.match(migration42, /grant execute on function public\.chl_list_my_gift_history\(integer\) to authenticated/);
});
check('creator achievements have RLS and a persistent gift-transaction trigger', () => {
  assert.match(migration41, /create table if not exists public\.creator_achievement_unlocks/);
  assert.match(migration41, /enable row level security/);
  assert.match(migration41, /create trigger chl_record_gifter_achievements_after_gift/);
  assert.match(migration43, /grant select on table public\.creator_achievement_unlocks to authenticated/);
});
check('profile likes and creator/gift rankings use net, non-reversed transactions', () => {
  assert.match(migration44, /security invoker/);
  assert.match(migration44, /public\.likes l\s+join public\.posts p/);
  assert.match(migration44, /create or replace function public\.get_public_creator_rankings/);
  assert.match(migration44, /create or replace function public\.get_public_gift_rankings/);
  assert.ok((migration44.match(/not exists\(select 1 from public\.gift_transaction_reversals/g) || []).length >= 5);
});
check('extension does not implement wallet/payment or Teams route replacements', () => {
  assert.doesNotMatch(webJs, /CHL\.route\('\/teams'/);
  assert.doesNotMatch(webJs, /Create-team form.*connect backend/i);
  assert.doesNotMatch(webJs, /\$0\.00/);
  assert.match(webIndex, /src\/pages-wallet\.js/);
  assert.match(webIndex, /src\/pages-teams\.js/);
});

console.log(`Platform tools contract passed: ${checks.length} checks.`);
for (const item of checks) console.log(`  PASS ${item}`);
