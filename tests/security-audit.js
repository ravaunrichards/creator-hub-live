// Repository source hygiene check; skips generated/binary/dependency directories.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const ignored = new Set(['.git','node_modules','.gradle','build','dist']);
const textExt = new Set(['.js','.mjs','.cjs','.json','.md','.sql','.gradle','.properties','.html','.css','.yml','.yaml','.txt','.xml']);
const forbidden = [
  {name:'private key block', re:/-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/},
  {name:'PayPal client secret assignment', re:/\bPAYPAL_CLIENT_SECRET\s*[:=]\s*["'][^"']{8,}["']/i},
  {name:'Supabase service role assignment', re:/\bSUPABASE_SERVICE_ROLE_KEY\s*[:=]\s*["'][^"']{12,}["']/i},
  {name:'LiveKit API secret assignment', re:/\bLIVEKIT_API_SECRET\s*[:=]\s*["'][^"']{8,}["']/i}
];
let checked=0, failures=0;
function walk(dir){
 for(const ent of fs.readdirSync(dir,{withFileTypes:true})){
  if(ent.name.startsWith('.') && ent.name !== '.env.example' && ent.name !== '.gitignore') continue;
  if(ignored.has(ent.name)) continue;
  const full=path.join(dir,ent.name);
  if(ent.isDirectory()){walk(full);continue;}
  if(!textExt.has(path.extname(ent.name).toLowerCase())) continue;
  let text; try{text=fs.readFileSync(full,'utf8')}catch{continue;}
  checked++;
  for(const rule of forbidden){if(rule.re.test(text)){console.error(`FAIL — ${rule.name}: ${path.relative(ROOT,full)}`);failures++;}}
 }
}
walk(ROOT);
if(failures){console.error(`SECURITY SOURCE CHECK: ${checked} files scanned, ${failures} finding(s).`);process.exitCode=1;}
else console.log(`PASS — ${checked} source/config files scanned; no matching private credential patterns found.`);
