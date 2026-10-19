// Creator Hub Live — backend syntax validation
// Run: cd backend && npm run test
import { execSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const SRC = path.join(ROOT, 'src');

const jsFiles = fs.readdirSync(SRC).filter(f => f.endsWith('.js'));
let pass = 0, fail = 0;
for (const f of jsFiles) {
  const fp = path.join(SRC, f);
  try {
    execSync(`node --check "${fp}"`, { stdio: 'pipe' });
    console.log(`  PASS — ${f} (syntax valid)`);
    pass++;
  } catch (e) {
    console.error(`  FAIL — ${f} (syntax error)`);
    fail++;
  }
}

if (fail > 0) {
  console.error(`\nBACKEND SYNTAX: ${pass} passed, ${fail} failed`);
  process.exit(1);
}
console.log(`\nBACKEND SYNTAX: ${pass}/${pass} passed`);