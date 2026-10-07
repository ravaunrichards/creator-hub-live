// Creator Hub Live — headless route and security regression check.
// Run: cd backend && npm run check
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const WEB = path.join(ROOT, '..', 'frontend');
const SERVER = path.join(ROOT, 'src', 'server.js');

function node(){ return { style:{}, children:[], classList:{add(){},remove(){},toggle(){},contains(){return false;}}, appendChild(c){this.children.push(c);return c;}, setAttribute(){}, getAttribute(){return null;}, addEventListener(){}, querySelector(){return null;}, querySelectorAll(){return [];}, remove(){}, parentNode:null, innerHTML:'', textContent:'' }; }
globalThis.document={createElement:()=>node(),createTextNode:()=>node(),querySelector(){return null;},querySelectorAll(){return [];},body:node(),addEventListener(){}};
globalThis.window={addEventListener(){},scrollTo(){},location:{hash:'#/',protocol:'http:'},innerWidth:1200,CreatorHubConfig:{supabase:{url:'https://example.supabase.co',publishableKey:'test'},api:{baseUrl:''},app:{name:'Creator Hub Live'}}};
globalThis.location=globalThis.window.location;
Object.defineProperty(globalThis,'navigator',{value:{serviceWorker:{register(){return Promise.resolve();}}},configurable:true});
if(!globalThis.crypto) Object.defineProperty(globalThis,'crypto',{value:{randomUUID(){return '00000000-0000-4000-8000-000000000000';}},configurable:true});
globalThis.window.CHL_CONFIG={SUPABASE_URL:'https://example.supabase.co',SUPABASE_ANON_KEY:'test',API_BASE:''};
globalThis.window.supabase = { createClient() {
  const chain = { eq() { return this; }, maybeSingle() { return Promise.resolve({data:null,error:null}); }, select() { return this; }, then(resolve) { return Promise.resolve({data:null,error:null,count:0}).then(resolve); } };
  return { auth: { getSession(){return Promise.resolve({data:{session:null}});}, getUser(){return Promise.resolve({data:{user:null}});}, onAuthStateChange(){return {data:{subscription:{unsubscribe(){}}}};}, signOut(){return Promise.resolve({});} }, from(){return chain;}, rpc(){return Promise.resolve({data:null,error:null});} };
} };

const files=['src/core.js','src/ui.js','src/pages-auth.js','src/pages.js','src/pages-admin.js','src/pages-creator.js','src/pages-extra.js','src/pages-room.js','src/pages-settings.js','src/pages-wallet.js','src/livekit.js'];
for(const f of files) globalThis.eval(fs.readFileSync(path.join(WEB,f),'utf8'));

const CHL=globalThis.window.CHL;

const registry=['/','/discover','/for-you','/following','/live','/live/123','/match/9','/search','/hashtag/music','/sound/5','/profile/someuser','/post/42','/messages','/messages/7','/notifications','/wallet','/wallet/recharge','/wallet/history','/gifts','/subscriptions','/creator','/creator/analytics','/creator/live','/creator/live/history','/creator/live/schedule','/creator/earnings','/creator/subscriptions','/creator/gifts','/teams','/teams/3','/leagues','/leagues/A1','/rankings','/login','/signup','/verify','/forgot-password','/reset-password','/oauth/callback','/settings','/settings/profile','/settings/security','/settings/privacy','/settings/notifications','/settings/payments','/settings/live','/help','/report','/terms','/privacy','/community-guidelines','/admin','/admin/users','/admin/content','/admin/live','/admin/payments','/admin/gifts','/admin/coins','/admin/diamonds','/admin/subscriptions','/admin/payouts','/admin/teams','/admin/leagues','/admin/rankings','/admin/moderation','/admin/reports','/admin/verification','/admin/settings','/admin/audit'];

function resolve(p){const parts=p.split('/').filter(Boolean);for(let n=parts.length;n>=0;n--){const c='/'+parts.slice(0,n).join('/');if(c==='/'&&n>0)continue;if(CHL.routes.hasOwnProperty(c))return c;}return null;}

const broken=registry.filter(r=>!(resolve(r)||resolve(r.replace(/\/+[^/]+$/,''))));
if(broken.length){console.error('BROKEN routes:',broken);process.exit(1);}

const publicFiles=[]; function walk(d){if(!fs.existsSync(d))return;for(const e of fs.readdirSync(d,{withFileTypes:true})){const p=path.join(d,e.name);if(e.isDirectory())walk(p);else publicFiles.push(p);}} walk(WEB);

const forbidden=[/sb_secret_/i,/service_role/i,/LIVEKIT_API_SECRET/i,/PAYPAL_CLIENT_SECRET/i,/PAYPAL_WEBHOOK_SECRET/i,/JWT_SIGNING_SECRET/i,/-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/i];
const leaks=[]; for(const f of publicFiles){const ext=path.extname(f).toLowerCase();if(!['.js','.html','.css','.json','.webmanifest','.map','.txt'].includes(ext))continue;const t=fs.readFileSync(f,'utf8');for(const rx of forbidden)if(rx.test(t))leaks.push(path.relative(ROOT,f)+': '+rx);}
if(leaks.length){console.error('PUBLIC SECRET SCAN FAILED:',leaks);process.exit(1);}

const requiredRoutes=['/api/health','/api/livekit/health','/api/livekit/token','/api/live/rooms','/api/payments/create-order','/api/payments/capture-order','/api/payments/webhook','/api/payments/refund','/api/wallet/balance','/api/wallet/transactions','/api/wallet/deposit','/api/wallet/withdraw','/api/wallet/purchase','/api/wallet/gift','/api/leagues','/api/leagues/standings'];
const server=fs.readFileSync(SERVER,'utf8');
const missing=requiredRoutes.filter(x=>!server.includes(`'${x}'`)&&!server.includes(`"${x}"`));
if(missing.length){console.error('BACKEND ROUTE REGRESSION:',missing);process.exit(1);}

console.log(`PASS — ${Object.keys(CHL.routes).length} browser routes registered; ${registry.length} routes checked.`);
console.log(`PASS — ${publicFiles.length} frontend files scanned; no forbidden private credential patterns found.`);
console.log(`PASS — ${requiredRoutes.length} canonical backend endpoint strings verified in server.js.`);