// Creator Hub Live — Root integration check
// Verifies the merged project structure is complete and consistent.
// Run: node tests/integration-check.js
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { execSync } from 'node:child_process';

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));

const requiredDirs = [
  'frontend', 'frontend/src', 'frontend/assets', 'frontend/styles',
  'backend', 'backend/src', 'backend/tests',
  'database', 'database/migrations',
  'android', 'android/app', 'android/app/src/main/assets/web',
  'docs', 'releases', 'backups', 'tests'
];

const requiredFiles = [
  // Frontend (v3.2.0)
  'frontend/index.html',
  'frontend/config.js',
  'frontend/config.example.js',
  'frontend/sw.js',
  'frontend/manifest.webmanifest',
  'frontend/src/core.js',
  'frontend/src/ui.js',
  'frontend/src/pages.js',
  'frontend/src/pages-auth.js',
  'frontend/src/pages-creator.js',
  'frontend/src/pages-extra.js',
  'frontend/src/pages-room.js',
  'frontend/src/pages-settings.js',
  'frontend/src/pages-wallet.js',
  'frontend/src/pages-admin.js',
  'frontend/src/livekit.js',
  'frontend/styles/app.css',
  'frontend/assets/icon.svg',
  'frontend/assets/logo.svg',
  // Backend
  'backend/src/server.js',
  'backend/src/livekit-token.js',
  'backend/package.json',
  'backend/.env.example',
  'backend/tests/route-check.js',
  // Database
  'database/migrations/0001_identity_social.sql',
  'database/migrations/0002_content_social.sql',
  'database/migrations/0003_wallet_payments.sql',
  'database/migrations/0004_live_social_systems.sql',
  'database/migrations/0005_rls_policies.sql',
  'database/migrations/0006_seed_config.sql',
  'database/migrations/0007_payment_idempotency.sql',
  'database/migrations/0008_server_authoritative_leagues.sql',
  // Android
  'android/app/src/main/AndroidManifest.xml',
  'android/app/src/main/java/com/creatorhub/app/MainActivity.java',
  'android/app/src/main/assets/web/index.html',
  // Docs
  'docs/SETUP.md', 'docs/API.md', 'docs/DEPLOYMENT.md', 'docs/SECURITY.md',
  'docs/RELEASES.md', 'docs/BUILD-VALIDATION.md',
  // Root
  '.gitignore'
];

let pass = 0, fail = 0;

// Directory checks
console.log('=== Directory Structure ===');
for (const d of requiredDirs) {
  const full = path.join(ROOT, d);
  if (fs.existsSync(full) && fs.statSync(full).isDirectory()) {
    console.log(`  PASS — ${d}/`);
    pass++;
  } else {
    console.error(`  FAIL — ${d}/ (missing)`);
    fail++;
  }
}

// File checks
console.log('\n=== Required Files ===');
for (const f of requiredFiles) {
  const full = path.join(ROOT, f);
  if (fs.existsSync(full) && fs.statSync(full).isFile()) {
    console.log(`  PASS — ${f}`);
    pass++;
  } else {
    console.error(`  FAIL — ${f} (missing)`);
    fail++;
  }
}

// Frontend ↔ Android web sync check
console.log('\n=== Frontend ↔ Android Web Sync ===');
const frontendSrc = path.join(ROOT, 'frontend', 'src');
const androidWebSrc = path.join(ROOT, 'android', 'app', 'src', 'main', 'assets', 'web', 'src');
const jsFiles = fs.readdirSync(frontendSrc).filter(f => f.endsWith('.js'));
for (const f of jsFiles) {
  const fA = path.join(frontendSrc, f);
  const fB = path.join(androidWebSrc, f);
  if (!fs.existsSync(fB)) {
    console.error(`  FAIL — ${f} missing from Android web assets`);
    fail++;
    continue;
  }
  const a = fs.readFileSync(fA, 'utf8');
  const b = fs.readFileSync(fB, 'utf8');
  if (a === b) {
    console.log(`  PASS — ${f} (identical)`);
    pass++;
  } else {
    console.error(`  FAIL — ${f} (differs between frontend and Android)`);
    fail++;
  }
}
// Also check index.html, config.js, sw.js
for (const f of ['index.html', 'config.js', 'sw.js', 'manifest.webmanifest']) {
  const fA = path.join(ROOT, 'frontend', f);
  const fB = path.join(ROOT, 'android', 'app', 'src', 'main', 'assets', 'web', f);
  if (!fs.existsSync(fB)) continue;
  const a = fs.readFileSync(fA, 'utf8');
  const b = fs.readFileSync(fB, 'utf8');
  if (a === b) { console.log(`  PASS — ${f} (identical)`); pass++; }
  else { console.error(`  FAIL — ${f} (differs)`); fail++; }
}

// Backend syntax check
console.log('\n=== Backend Syntax ===');
const backendFiles = fs.readdirSync(path.join(ROOT, 'backend', 'src')).filter(f => f.endsWith('.js'));
for (const f of backendFiles) {
  try {
    execSync(`node --check "${path.join(ROOT, 'backend', 'src', f)}"`, { stdio: 'pipe' });
    console.log(`  PASS — ${f} (syntax valid)`);
    pass++;
  } catch {
    console.error(`  FAIL — ${f} (syntax error)`);
    fail++;
  }
}

// Secret leak scan on frontend
console.log('\n=== Frontend Secret Scan ===');
const forbidden = [/sb_secret_/i, /service_role/i, /LIVEKIT_API_SECRET/i, /PAYPAL_CLIENT_SECRET/i, /PAYPAL_WEBHOOK_SECRET/i, /JWT_SIGNING_SECRET/i, /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/i];
const webDir = path.join(ROOT, 'frontend');
const leaks = [];
function walk(d) { for (const e of fs.readdirSync(d, { withFileTypes: true })) { const p = path.join(d, e.name); if (e.isDirectory()) walk(p); else if (['.js','.html','.css','.json','.webmanifest'].includes(path.extname(p).toLowerCase())) { const t = fs.readFileSync(p, 'utf8'); for (const rx of forbidden) if (rx.test(t)) leaks.push(path.relative(ROOT, p) + ': ' + rx); } } }
walk(webDir);
if (leaks.length) { console.error(`  FAIL — ${leaks.length} secret pattern(s) found in frontend:`); for (const l of leaks) console.error('    ' + l); fail += leaks.length; }
else { console.log('  PASS — no forbidden secret patterns in frontend files'); pass++; }

// Version check
console.log('\n=== Version ===');
const config = fs.readFileSync(path.join(ROOT, 'frontend', 'config.js'), 'utf8');
const vMatch = config.match(/version['"]*\s*[:=]\s*['"]([^'"]+)['"]/i);
if (vMatch) { console.log(`  Frontend version: ${vMatch[1]}`); pass++; }
else { console.error('  FAIL — cannot detect frontend version'); fail++; }

// Summary
console.log(`\n=== Summary: ${pass} passed, ${fail} failed ===`);
if (fail > 0) process.exit(1);