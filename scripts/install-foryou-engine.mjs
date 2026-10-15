import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import assert from 'node:assert/strict';

const here = path.dirname(fileURLToPath(import.meta.url));
const sourceRoot = path.resolve(here, '..');
if (!process.argv[2]) {
  console.error('Usage: node scripts/install-foryou-engine.mjs /absolute/path/to/creator-hub-live');
  process.exit(2);
}
const targetRoot = path.resolve(process.argv[2]);
const read = (rel) => fs.readFileSync(path.join(targetRoot, rel), 'utf8');
const required = [
  'package.json', 'frontend/index.html', 'frontend/src/pages-extra.js', 'frontend/sw.js',
  'android/app/src/main/assets/web/index.html', 'android/app/src/main/assets/web/sw.js',
  'frontend/config.js', 'android/app/src/main/assets/web/config.js',
  'tests/ui-ux-contract.mjs', 'tests/gift-asset-contract.mjs'
];
for (const rel of required) {
  assert.ok(fs.existsSync(path.join(targetRoot, rel)), `Not a complete CHL project or missing ${rel}`);
}
const html = read('frontend/index.html');
const androidHtml = read('android/app/src/main/assets/web/index.html');
const routes = read('frontend/src/pages-extra.js');
assert.match(html, /src\/swipe-feed\.js/, 'Website HTML does not load src/swipe-feed.js; no files changed.');
assert.match(androidHtml, /src\/swipe-feed\.js/, 'Android HTML does not load src/swipe-feed.js; no files changed.');
assert.match(routes, /CHL\.renderSwipeFeed\(o, 'foryou'\)/, 'For You route is not connected; no files changed.');
assert.match(routes, /CHL\.renderSwipeFeed\(o, 'following'\)/, 'Following route is not connected; no files changed.');
for (const rel of ['frontend/sw.js', 'android/app/src/main/assets/web/sw.js']) {
  assert.match(read(rel), /SHELL\s*=\s*\[/, `${rel} has no shell asset list; no files changed.`);
}

const relativeFiles = [
  'frontend/src/swipe-feed.js',
  'frontend/styles/platform-responsive.css',
  'android/app/src/main/assets/web/src/swipe-feed.js',
  'android/app/src/main/assets/web/styles/platform-responsive.css',
  'tests/for-you-engine-contract.mjs',
  'scripts/verify-project-integration.mjs'
];
const timestamp = new Date().toISOString().replace(/[-:.TZ]/g, '').slice(0, 14);
const backupRoot = path.join(targetRoot, `.chl-foryou-engine-backup-${timestamp}`);
const backupFiles = [
  ...relativeFiles,
  'frontend/index.html', 'android/app/src/main/assets/web/index.html',
  'frontend/sw.js', 'android/app/src/main/assets/web/sw.js',
  'frontend/config.js', 'android/app/src/main/assets/web/config.js',
  'tests/ui-ux-contract.mjs', 'tests/gift-asset-contract.mjs', 'package.json'
];
fs.mkdirSync(backupRoot, { recursive: false });
for (const rel of backupFiles) {
  const dest = path.join(targetRoot, rel);
  if (!fs.existsSync(dest)) continue;
  const backup = path.join(backupRoot, rel);
  fs.mkdirSync(path.dirname(backup), { recursive: true });
  fs.copyFileSync(dest, backup);
}
for (const rel of relativeFiles) {
  const from = path.join(sourceRoot, rel);
  const to = path.join(targetRoot, rel);
  fs.mkdirSync(path.dirname(to), { recursive: true });
  fs.copyFileSync(from, to);
}

function bumpHtml(rel) {
  const full = path.join(targetRoot, rel);
  let text = fs.readFileSync(full, 'utf8');
  for (const assetPattern of [
    /(styles\/platform-responsive\.css\?v=)[^"'\s]+/g,
    /(src\/style-system\.js\?v=)[^"'\s]+/g,
    /(src\/swipe-feed\.js\?v=)[^"'\s]+/g
  ]) {
    text = text.replace(assetPattern, (_match, prefix) => prefix + '6.0.3');
  }
  fs.writeFileSync(full, text);
}
bumpHtml('frontend/index.html');
bumpHtml('android/app/src/main/assets/web/index.html');

function bumpRuntimeConfig(rel) {
  const full = path.join(targetRoot, rel);
  let text = fs.readFileSync(full, 'utf8');
  let found = false;
  text = text.replace(/(version\s*:\s*['\"])[^'\"]+(['\"])/, (_match, prefix, suffix) => {
    found = true;
    return prefix + '6.0.3' + suffix;
  });
  assert.ok(found, `Could not find a runtime config version in ${rel}; original saved in ${path.basename(backupRoot)}.`);
  fs.writeFileSync(full, text);
}
bumpRuntimeConfig('frontend/config.js');
bumpRuntimeConfig('android/app/src/main/assets/web/config.js');

function bumpServiceWorker(rel) {
  const full = path.join(targetRoot, rel);
  let text = fs.readFileSync(full, 'utf8');
  text = text.replace(/(var|let|const)\s+(VERSION|CACHE_NAME)\s*=\s*(['"])[^'"]*\3\s*;/,
    (_match, declaration, name) => `${declaration} ${name} = 'chcn-web-nexus-v6-0-3';`);
  text = text.replace(/chcn-web-nexus-v6-0-2/g, 'chcn-web-nexus-v6-0-3')
    .replace(/chl-shell-v3\.3\.0/g, 'chcn-web-nexus-v6-0-3')
    .replace(/chl-web-v3-3-[01]/g, 'chcn-web-nexus-v6-0-3');
  const shell = text.match(/((?:var|let|const)\s+SHELL\s*=\s*\[)([\s\S]*?)(\];)/);
  assert.ok(shell, `${rel} shell parsing failed. Original file is preserved in ${path.basename(backupRoot)}.`);
  let body = shell[2]
    .replace(/(['"])[^'"]*src\/swipe-feed\.js[^'"]*\1\s*,?/g, '')
    .replace(/(['"])[^'"]*styles\/platform-responsive\.css[^'"]*\1\s*,?/g, '')
    .replace(/(['"])[^'"]*src\/style-system\.js[^'"]*\1\s*,?/g, '')
    .trim();
  if (body && !body.endsWith(',')) body += ',';
  body += "'./src/swipe-feed.js?v=6.0.3','./styles/platform-responsive.css?v=6.0.3','./src/style-system.js?v=6.0.3'";
  text = text.slice(0, shell.index) + shell[1] + body + shell[3] + text.slice(shell.index + shell[0].length);
  fs.writeFileSync(full, text);
}
bumpServiceWorker('frontend/sw.js');
bumpServiceWorker('android/app/src/main/assets/web/sw.js');

// Align the existing UI contract with this coordinated version bump, regardless of its previous version.
const uiContractPath = path.join(targetRoot, 'tests/ui-ux-contract.mjs');
let uiContract = fs.readFileSync(uiContractPath, 'utf8');
uiContract = uiContract.replaceAll('6\\.0\\.2', '6\\.0\\.3')
  .replaceAll('6.0.2', '6.0.3')
  .replaceAll('3\\.3\\.0', '6\\.0\\.3')
  .replaceAll('3.3.0', '6.0.3')
  .replaceAll('chl-shell-v3\\.3\\.0', 'chcn-web-nexus-v6-0-3')
  .replaceAll('chl-web-v3-3-0', 'chcn-web-nexus-v6-0-3')
  .replaceAll('chl-shell-v3.3.0', 'chcn-web-nexus-v6-0-3')
  .replaceAll('chcn-web-nexus-v6-0-2', 'chcn-web-nexus-v6-0-3');
fs.writeFileSync(uiContractPath, uiContract);
const giftContractPath = path.join(targetRoot, 'tests/gift-asset-contract.mjs');
let giftContract = fs.readFileSync(giftContractPath, 'utf8');
giftContract = giftContract.replaceAll('chl-web-v3-3-0', 'chcn-web-nexus-v6-0-3').replaceAll('chl-web-v3-3-1', 'chcn-web-nexus-v6-0-3');
fs.writeFileSync(giftContractPath, giftContract);

const pkgPath = path.join(targetRoot, 'package.json');
const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
pkg.version = '6.0.3';
pkg.scripts ||= {};
const contractCommand = 'node tests/for-you-engine-contract.mjs && node scripts/verify-project-integration.mjs .';
if (!String(pkg.scripts.check || '').includes('tests/for-you-engine-contract.mjs')) {
  pkg.scripts.check = pkg.scripts.check ? `${pkg.scripts.check} && ${contractCommand}` : contractCommand;
}
fs.writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + '\n');
console.log(`Installed For You Engine 6.0.3 to ${targetRoot}`);
console.log(`Backup folder: ${backupRoot}`);
console.log('Backups include web and Android index/config files, service workers, the UI/gift contract tests, and package manifest.');
console.log('Next: run npm run check, then test #/for-you and #/following using real published posts.');
