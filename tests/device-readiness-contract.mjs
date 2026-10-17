import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const ROOT=path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const errors=[];
const requireFile=p=>{if(!fs.existsSync(path.join(ROOT,p)))errors.push(`Missing required file: ${p}`);};
for(const p of ['frontend/index.html','frontend/index.iphone.html','frontend/manifest.webmanifest','frontend/sw.js','android/app/src/main/AndroidManifest.xml','scripts/audit-chl-assets.mjs','scripts/sync-web-assets-safe.mjs','verification/device-release-matrix.md']) requireFile(p);
const iphonePath=path.join(ROOT,'frontend','index.iphone.html');
if(fs.existsSync(iphonePath)){
 const h=fs.readFileSync(iphonePath,'utf8');
 if(!/<meta\s+name="viewport"[^>]*viewport-fit=cover/i.test(h)) errors.push('iPhone entry must declare viewport-fit=cover for safe-area support');
 if(!/<title>Creator Hub Live<\/title>/i.test(h)) errors.push('iPhone entry title must use Creator Hub Live branding');
 if(/Creator Hub Creator Network|CHCN/i.test(h)) errors.push('CHCN branding detected in CHL iPhone entry');
 if(!/serviceWorker\.register\(['"]sw\.js['"]\)/.test(h)) errors.push('iPhone web entry no longer registers the existing service worker');
 if(!/src\/pages-room\.js/.test(h)||!/src\/livekit\.js/.test(h)) errors.push('iPhone entry is missing the existing LIVE module scripts');
}
const manifestPath=path.join(ROOT,'frontend','manifest.webmanifest');
if(fs.existsSync(manifestPath)){
 try{const m=JSON.parse(fs.readFileSync(manifestPath,'utf8')); if(!m.name||!/Creator Hub Live/i.test(m.name))errors.push('PWA manifest name must be Creator Hub Live');if(!Array.isArray(m.icons)||!m.icons.length)errors.push('PWA manifest must declare at least one icon');}
 catch{errors.push('PWA manifest is invalid JSON');}
}
const androidPath=path.join(ROOT,'android','app','src','main','AndroidManifest.xml');
if(fs.existsSync(androidPath)){
 const m=fs.readFileSync(androidPath,'utf8');
 if(!m.includes('android.permission.INTERNET'))errors.push('Android manifest missing INTERNET permission');
 if(!m.includes('android:exported="true"'))errors.push('Android launcher activity must declare exported=true');
 if(!m.includes('android:usesCleartextTraffic="false"'))errors.push('Android manifest should explicitly disallow cleartext traffic');
}
console.log(`Device readiness contract: ${errors.length?errors.length+' failure(s)':'PASS'}`);
for(const e of errors)console.error('FAIL '+e);
if(errors.length)process.exitCode=1;
