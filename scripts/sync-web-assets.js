import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const SOURCE = path.join(ROOT, 'frontend');
const TARGET = path.join(ROOT, 'android', 'app', 'src', 'main', 'assets', 'web');

function removeExtraneous(src, dst) {
  if (!fs.existsSync(dst)) return;
  for (const entry of fs.readdirSync(dst, { withFileTypes: true })) {
    const target = path.join(dst, entry.name);
    const source = path.join(src, entry.name);
    if (!fs.existsSync(source)) {
      fs.rmSync(target, { recursive: true, force: true });
    } else if (entry.isDirectory()) {
      removeExtraneous(source, target);
    }
  }
}

function copyTree(src, dst) {
  fs.mkdirSync(dst, { recursive: true });
  for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
    const from = path.join(src, entry.name);
    const to = path.join(dst, entry.name);
    if (entry.isDirectory()) copyTree(from, to);
    else fs.copyFileSync(from, to);
  }
}

removeExtraneous(SOURCE, TARGET);
copyTree(SOURCE, TARGET);
console.log(`PASS — synchronized ${SOURCE} -> ${TARGET}`);
