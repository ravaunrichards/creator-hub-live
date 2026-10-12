// Creator Hub Creator Network — complete website release integrity checks.
// This release is intentionally website/backend/database only; it does not package Android or unrelated learning/tools modules.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';
import vm from 'node:vm';

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const WEB = path.join(ROOT, 'frontend');
let pass = 0, fail = 0;
function check(ok, message) { if (ok) { console.log(`  PASS — ${message}`); pass++; } else { console.error(`  FAIL — ${message}`); fail++; } }
function exists(rel) { return fs.existsSync(path.join(ROOT, rel)); }
function read(rel) { return fs.readFileSync(path.join(ROOT, rel), 'utf8'); }
function listFiles(dir) {
  const result = [];
  for (const e of fs.readdirSync(path.join(ROOT, dir), { withFileTypes: true })) {
    const rel = path.posix.join(dir, e.name); const full = path.join(ROOT, rel);
    if (e.isDirectory()) result.push(...listFiles(rel)); else result.push(rel);
  }
  return result;
}

console.log('=== Website release layout ===');
for (const d of ['frontend', 'frontend/src', 'frontend/assets', 'frontend/styles', 'backend', 'backend/src', 'backend/tests', 'database', 'database/migrations', 'database/diagnostics', 'docs', 'tests'])
  check(exists(d) && fs.statSync(path.join(ROOT, d)).isDirectory(), `${d}/ exists`);
for (const f of [
  'frontend/index.html','frontend/config.js','frontend/config.example.js','frontend/sw.js','frontend/manifest.webmanifest',
  'frontend/src/core.js','frontend/src/ui.js','frontend/src/pages.js','frontend/src/pages-auth.js','frontend/src/pages-admin.js',
  'frontend/src/pages-creator.js','frontend/src/pages-extra.js','frontend/src/pages-room.js','frontend/src/pages-settings.js',
  'frontend/src/pages-wallet.js','frontend/src/pages-teams.js','frontend/src/livekit.js',
  'frontend/src/pages-accessibility.js','frontend/src/pages-account.js','frontend/src/pages-community.js',
  'frontend/styles/app.css','frontend/assets/icon.svg','frontend/assets/logo.svg',
  'backend/src/server.js','backend/src/livekit-token.js','backend/src/teams-routes.js','backend/src/team-leagues.js','backend/src/payout-routes.js',
  'backend/package.json','backend/.env.example','backend/tests/route-check.js',
  ...Array.from({length:24},(_,i)=>`database/migrations/${String(i+1).padStart(4,'0')}_${({1:'identity_social',2:'content_social',3:'wallet_payments',4:'live_social_systems',5:'rls_policies',6:'seed_config',7:'payment_idempotency',8:'server_authoritative_leagues',9:'live_pending_state',10:'rls_hardening',11:'user_settings',12:'live_chat_messages',13:'wallet_package_contracts',14:'creator_league_server',15:'teams_backend_complete',16:'official_division_tiers',17:'team_schema_compatibility_repair',18:'teams_schema_convergence',19:'league_operations_and_payouts',20:'wallet_gift_schema_and_security',21:'social_academy_conversations',22:'creator_media_storage',23:'settings_schedules_analytics',24:'creator_community_account_controls'})[i+1]}.sql`),
  'database/diagnostics/league_schema_preflight.sql','database/diagnostics/full_supabase_inventory_audit.sql','database/diagnostics/teams_backend_restart_preflight.sql',
  'docs/INSTALL.md','docs/API.md','docs/DATABASE.md','docs/SECURITY.md','docs/RELEASE-4.0.0.md','docs/VALIDATION-4.0.0.md','docs/RELEASE-4.0.1.md','docs/VALIDATION-4.0.1.md','docs/TEAMS-BACKEND-RESTART.md','docs/RESTART-AUDIT-2026-10-12.md','docs/KNOWN_LIMITATIONS.md',
  'tests/deployment-payment-check.mjs','tests/community-account-contract.mjs','.gitignore'
]) check(exists(f) && fs.statSync(path.join(ROOT, f)).isFile(), `${f} exists`);

console.log('\n=== Scope and shell integrity ===');
for (const rel of ['android','releases','frontend/src/pages-academy.js','frontend/src/pages-tools.js','frontend/src/pages-games.js','scripts/sync-web-assets.js'])
  check(!exists(rel), `${rel} excluded from website-only package`);
const html = read('frontend/index.html');
const sw = read('frontend/sw.js');
const config = read('frontend/config.js');
const manifest = JSON.parse(read('frontend/manifest.webmanifest'));
check(/Creator Hub Creator Network/.test(html), 'HTML title/branding identifies Creator Hub Creator Network');
check(/"name"\s*:\s*"Creator Hub Creator Network"/.test(read('frontend/manifest.webmanifest')), 'manifest uses the requested product name');
check(/version\s*:\s*'4\.0\.1'/.test(config), 'browser config release is 4.0.1');
try {
  const browserGlobal = { window: {} };
  vm.runInNewContext(config, browserGlobal, { filename: 'frontend/config.js', timeout: 1000 });
  check(!!browserGlobal.window.CreatorHubConfig && browserGlobal.window.CreatorHubConfig.TIKTOK_USERNAME === '', 'browser config executes without optional social settings');
} catch (e) { check(false, `browser config executes without optional social settings (${e.message})`); }
check(/chcn-web-v4-0-1/.test(sw), 'service-worker cache version is 4.0.1');
check(/\?v=4\.0\.1/.test(html), 'HTML assets are cache-busted for release 4.0.1');
check(!/(pages-academy|pages-tools|pages-games|#\/academy|#\/games|#\/maps|#\/tools)/i.test(html + sw + read('frontend/src/ui.js') + read('frontend/src/pages-settings.js')), 'website shell/nav/settings exclude unrelated Academy, games, maps and tools');
const scriptPaths = [...html.matchAll(/<script[^>]+src=["']([^"']+)["']/g)].map(m => m[1]).filter(x => !/^https?:/i.test(x));
for (const src of scriptPaths) check(exists(path.posix.join('frontend', src.split('?')[0])), `script asset exists: ${src}`);
const shellPaths = [...sw.matchAll(/['"]\.\/(?!\.\/)([^?'" ]+)(?:\?v=[^'"]*)?['"]/g)].map(m => m[1]).filter(x=>!x.endsWith('/') && !x.includes('://'));
for (const rel of [...new Set(shellPaths)]) check(exists(path.posix.join('frontend',rel)), `service-worker asset exists: ${rel}`);

console.log('\n=== Frontend routes and navigation ===');
const loadedModules = scriptPaths.map(x=>x.split('?')[0]).filter(x=>x.startsWith('src/') && x.endsWith('.js')).map(x=>path.posix.join('frontend',x));
const routes = new Set(); const duplicates=[]; const srcBodies=[];
for (const file of loadedModules) {
  const body=read(file); srcBodies.push({file,body});
  for (const m of body.matchAll(/CHL\.route\(\s*['"](\/[^'"]*)['"]/g)) { if(routes.has(m[1]))duplicates.push(`${m[1]} (${file})`);routes.add(m[1]); }
  for (const m of body.matchAll(/\blegal\(\s*['"](\/[^'"]*)['"]/g)) { if(routes.has(m[1]))duplicates.push(`${m[1]} (legal helper in ${file})`);routes.add(m[1]); }
  for (const m of body.matchAll(/CHL\.routes\[(['"])(\/[^'"]+)\1\]\s*=/g)) { if(routes.has(m[2]))duplicates.push(`${m[2]} (direct route assignment in ${file})`); routes.add(m[2]); }
}
check(duplicates.length===0, duplicates.length ? `duplicate routes: ${duplicates.join(', ')}` : `no duplicate literal route registrations (${routes.size} source-declared routes including legal helper routes)`);
const links=new Set();
for (const {body} of srcBodies) for (const m of body.matchAll(/#(\/[A-Za-z0-9_.\-/:]+|\/)/g)) links.add(m[1].split('?')[0].replace(/\/$/,'')||'/');
const missing=[];
for (const link of links) {
  const norm=link.startsWith('/')?link:'/'+link;
  let hit=routes.has(norm), cur=norm;
  while(!hit&&cur.lastIndexOf('/')>0){cur=cur.slice(0,cur.lastIndexOf('/'));hit=routes.has(cur);}
  if(!hit && norm!=='/') missing.push(norm);
}
check(missing.length===0, missing.length ? `unresolved internal route links: ${missing.slice(0,30).join(', ')}` : `all internal hash links map to registered routes (${links.size} links checked)`);
for (const route of ['/settings','/settings/profile','/settings/account','/settings/security','/settings/privacy','/settings/blocked','/settings/notifications','/settings/messaging','/settings/language','/settings/appearance','/settings/accessibility','/settings/connected','/settings/verification','/settings/data','/settings/deletion','/settings/legal','/settings/payments','/settings/live','/profile/followers','/profile/following','/about','/help','/battles','/missions','/achievements','/gift-rankings','/hall-of-fame','/teams','/leagues','/rankings','/wallet','/creator/analytics','/creator/live/schedule','/notifications','/messages','/discover','/for-you','/following']) {
  let cur=route, hit=routes.has(cur); while(!hit && cur.lastIndexOf('/')>0){cur=cur.slice(0,cur.lastIndexOf('/'));hit=routes.has(cur);} check(hit, `required route available: ${route}`);
}
for (const label of ['Edit profile','Account information','Password & login','Connected accounts','Followers & following','Blocked accounts','Privacy settings','Messaging settings','Verification','Download your data','Deactivate or delete account','Notification settings','Payment settings','LIVE defaults','Creator statistics','Appearance','Accessibility','Language & region','Terms & privacy','Help & support','About CHL CREATOR HUB']) check(read('frontend/src/pages-settings.js').includes(label), `Settings exposes: ${label}`);

console.log('\n=== JavaScript syntax ===');
const jsFiles=[...listFiles('frontend').filter(x=>/\.js$/.test(x)),...listFiles('backend/src').filter(x=>/\.js$/.test(x)),...listFiles('backend/tests').filter(x=>/\.js$/.test(x)),...listFiles('tests').filter(x=>/\.(js|mjs|cjs)$/.test(x))];
const unique=[...new Set(jsFiles)];
for (const rel of unique) { try { execFileSync('node',['--check',path.join(ROOT,rel)],{stdio:'pipe'}); check(true,`syntax: ${rel}`); } catch(e) { check(false,`syntax: ${rel} (${String(e.stderr||e.message).trim().split('\n').slice(-2).join(' ')})`); } }

console.log('\n=== Frontend secret patterns ===');
const forbidden=[/sb_secret_/i,/service_role/i,/SUPABASE_SERVICE_ROLE_KEY\s*[:=]\s*["'][^"']+/i,/LIVEKIT_API_SECRET/i,/PAYPAL_CLIENT_SECRET/i,/PAYPAL_WEBHOOK_SECRET/i,/JWT_SIGNING_SECRET/i,/-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/i];
const leaks=[];
for (const rel of listFiles('frontend')) if (/\.(js|html|css|json|webmanifest|svg)$/.test(rel)) { const t=read(rel); for(const rx of forbidden) if(rx.test(t))leaks.push(`${rel}: ${rx}`); }
check(leaks.length===0, leaks.length?`forbidden secret patterns: ${leaks.join('; ')}`:'no forbidden server-secret patterns found in browser assets');
check(/SUPABASE_PUBLISHABLE_KEY|SUPABASE_ANON_KEY/.test(config),'browser config only references a browser publishable/anonymous key field');
console.log(`\n=== Summary: ${pass} passed, ${fail} failed ===`);
if(fail)process.exit(1);
