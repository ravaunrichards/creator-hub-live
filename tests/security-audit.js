// Repository-wide source hygiene check. Does not inspect generated binaries.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const ignoredDirs = new Set(['.git', 'node_modules', '.gradle', 'build']);
const textExt = new Set(['.js','.mjs','.cjs','.json','.md','.sql','.gradle','.properties','.xml','.html','.css','.yml','.yaml','.txt','.example']);
const files = [];
function walk(dir) {
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    if (ent.isDirectory()) {
      if (!ignoredDirs.has(ent.name)) walk(path.join(dir, ent.name));
    } else if (textExt.has(path.extname(ent.name).toLowerCase()) || ent.name === '.env.example') {
      files.push(path.join(dir, ent.name));
    }
  }
}
walk(ROOT);
const errors = [];
const privateAssignment = /^\s*(SUPABASE_SERVICE_ROLE_KEY|LIVEKIT_API_SECRET|PAYPAL_CLIENT_SECRET|PAYPAL_WEBHOOK_SECRET|JWT_SIGNING_SECRET|RELEASE_STORE_PASSWORD|RELEASE_KEY_PASSWORD)\s*=\s*(.*?)\s*$/i;
const placeholder = /^(?:|YOUR_[A-Z0-9_]+|CHANGE_ME|REPLACE_ME|<[^>]+>)$/i;
const jwtLike = /\beyJ[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{10,}\b/;
const privateKey = /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/;
for (const file of files) {
  const rel = path.relative(ROOT, file);
  const content = fs.readFileSync(file, 'utf8');
  if (jwtLike.test(content)) errors.push(`${rel}: JWT-like token found`);
  if (privateKey.test(content)) errors.push(`${rel}: private-key block found`);
  for (const [i, line] of content.split(/\r?\n/).entries()) {
    const m = line.match(privateAssignment);
    if (m && !placeholder.test(m[2])) errors.push(`${rel}:${i + 1}: non-placeholder private credential assignment`);
  }
}
if (errors.length) {
  console.error('FAIL — repository secret hygiene');
  for (const error of errors) console.error(`  ${error}`);
  process.exit(1);
}
console.log(`PASS — repository secret hygiene (${files.length} text files scanned; generated binaries excluded)`);
