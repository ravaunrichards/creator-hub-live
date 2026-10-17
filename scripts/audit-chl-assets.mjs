import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const problems = [];
const warnings = [];
const seenHashes = new Map();
const walk = (dir, ext, out=[]) => {
  if (!fs.existsSync(dir)) return out;
  for (const ent of fs.readdirSync(dir, {withFileTypes:true})) {
    const f=path.join(dir,ent.name);
    if(ent.isDirectory()) walk(f,ext,out); else if(ent.isFile() && ent.name.toLowerCase().endsWith(ext)) out.push(f);
  }
  return out;
};
const icons = [...walk(path.join(ROOT,'icons'),'.svg'), ...walk(path.join(ROOT,'frontend','assets','chl-icons'),'.svg')];
for (const file of icons) {
  const text=fs.readFileSync(file,'utf8');
  const rel=path.relative(ROOT,file);
  if (!/<svg\b/i.test(text) || !/viewBox\s*=\s*["'][^"']+["']/i.test(text)) problems.push(`${rel}: missing SVG root or viewBox`);
  if (!/(aria-label\s*=|<title\b)/i.test(text)) problems.push(`${rel}: missing accessible title/label`);
  if (/<script\b|<foreignObject\b|\son[a-z]+\s*=|javascript:/i.test(text)) problems.push(`${rel}: active or unsafe SVG content detected`);
  if (!/currentColor/i.test(text)) warnings.push(`${rel}: does not use currentColor; verify theme/contrast variants`);
  if (Buffer.byteLength(text) > 30_000) warnings.push(`${rel}: unusually large SVG (${Buffer.byteLength(text)} bytes)`);
}
const models = walk(path.join(ROOT,'models'),'.glb');
for (const file of models) {
  const rel=path.relative(ROOT,file); const b=fs.readFileSync(file);
  const sha=crypto.createHash('sha256').update(b).digest('hex');
  if(seenHashes.has(sha)) warnings.push(`${rel}: byte-identical to ${seenHashes.get(sha)}; verify the model is not duplicated`); else seenHashes.set(sha,rel);
  if(b.length < 20) { problems.push(`${rel}: too small to be a valid GLB`); continue; }
  if(b.toString('ascii',0,4)!=='glTF') { problems.push(`${rel}: missing GLB magic header`); continue; }
  const version=b.readUInt32LE(4), declared=b.readUInt32LE(8);
  if(version!==2) problems.push(`${rel}: expected GLB 2.0, got version ${version}`);
  if(declared!==b.length) problems.push(`${rel}: declared length ${declared} differs from file length ${b.length}`);
  if(b.length<20) continue;
  const jsonLen=b.readUInt32LE(12), jsonType=b.readUInt32LE(16);
  if(jsonType!==0x4E4F534A || jsonLen<2 || 20+jsonLen>b.length) { problems.push(`${rel}: invalid/missing JSON chunk`); continue; }
  let gltf;
  try { gltf=JSON.parse(b.toString('utf8',20,20+jsonLen).replace(/[\u0000\u0020]+$/g,'')); }
  catch { problems.push(`${rel}: JSON chunk is not parseable`); continue; }
  if(gltf?.asset?.version!=='2.0') problems.push(`${rel}: glTF asset.version must be 2.0`);
  if(!Array.isArray(gltf.meshes) || !gltf.meshes.length) warnings.push(`${rel}: no meshes found; visually inspect before release`);
  else if(!gltf.meshes.some(m=>Array.isArray(m.primitives)&&m.primitives.some(p=>p.attributes && Object.keys(p.attributes).length))) warnings.push(`${rel}: mesh primitives have no vertex attributes; inspect geometry`);
  if(!Array.isArray(gltf.nodes) || !gltf.nodes.length) warnings.push(`${rel}: no nodes found; verify scene graph`);
  if(b.length<1024) warnings.push(`${rel}: model is under 1 KiB; confirm this is intentional and not a placeholder`);
  const binOffset=20+jsonLen;
  if(binOffset<b.length) {
    if(binOffset+8>b.length) problems.push(`${rel}: truncated next chunk header`);
    else { const chunkLen=b.readUInt32LE(binOffset), chunkType=b.readUInt32LE(binOffset+4); if(binOffset+8+chunkLen>b.length) problems.push(`${rel}: truncated binary chunk`); if(chunkType!==0x004E4942) warnings.push(`${rel}: first non-JSON chunk is not BIN; verify external buffers are embedded/resolved`); }
  }
}
console.log(`CHL asset audit: ${icons.length} SVG icon(s), ${models.length} GLB model(s)`);
for(const w of warnings) console.warn(`WARN ${w}`);
for(const p of problems) console.error(`FAIL ${p}`);
console.log(`Summary: ${problems.length} failure(s), ${warnings.length} warning(s)`);
if(problems.length) process.exitCode=1;
