import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
const ROOT=path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const SOURCE=path.join(ROOT,'frontend');
const TARGET=path.join(ROOT,'android','app','src','main','assets','web');
const apply=process.argv.includes('--apply');
if(!fs.existsSync(SOURCE)||!fs.statSync(SOURCE).isDirectory()) { console.error(`Missing frontend source: ${SOURCE}`); process.exit(1); }
const hash=f=>crypto.createHash('sha256').update(fs.readFileSync(f)).digest('hex');
const changed=[],same=[],stale=[];
function scan(src,dst,rel=''){
  if(apply) fs.mkdirSync(dst,{recursive:true});
  const srcNames=new Set(fs.readdirSync(src));
  if(fs.existsSync(dst)) for(const name of fs.readdirSync(dst)) if(!srcNames.has(name)) stale.push(path.posix.join(rel,name));
  for(const ent of fs.readdirSync(src,{withFileTypes:true})){
    const a=path.join(src,ent.name), b=path.join(dst,ent.name), r=path.posix.join(rel,ent.name);
    if(ent.isDirectory()) scan(a,b,r);
    else if(ent.isFile()) {
      const different=!fs.existsSync(b)||!fs.statSync(b).isFile()||hash(a)!==hash(b);
      if(different){ changed.push(r); if(apply){fs.mkdirSync(path.dirname(b),{recursive:true});fs.copyFileSync(a,b);} }
      else same.push(r);
    }
  }
}
scan(SOURCE,TARGET);
console.log(`Safe Android web-asset sync (${apply?'APPLY':'CHECK ONLY'})`);
console.log(`Files to ${apply?'copy/update':'copy/update if applied'}: ${changed.length}; already equal: ${same.length}; destination-only files preserved: ${stale.length}`);
for(const x of changed) console.log(`${apply?'COPIED/UPDATED':'WOULD COPY/UPDATE'} ${x}`);
for(const x of stale) console.warn(`PRESERVED (not in frontend source): ${x}`);
if(!apply) console.log('No files were changed. Re-run with --apply only after reviewing this report.');
