#!/usr/bin/env node
/**
 * Align existing static checks with this repository's actual numbered migration
 * history. This never touches product source, migration SQL, or environment files.
 * Run from the repository root after extracting the update ZIP.
 */
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const pending = new Map();

function load(relativePath) {
  if (!pending.has(relativePath)) {
    const absolute = path.join(root, relativePath);
    if (!fs.existsSync(absolute)) {
      throw new Error(`Required file not found: ${relativePath}. Run this script from the repository root.`);
    }
    pending.set(relativePath, fs.readFileSync(absolute, 'utf8'));
  }
  return pending.get(relativePath);
}

function saveText(relativePath, value) {
  pending.set(relativePath, value);
}

function replaceExactlyOnce(text, from, to, relativePath) {
  const count = text.split(from).length - 1;
  if (count !== 1) {
    throw new Error(`${relativePath}: expected one occurrence of a migration-contract marker, found ${count}. No files have been changed.`);
  }
  return text.replace(from, to);
}

// The repository already has migrations 0025 (gift pricing) and 0026 (LIVE rooms).
// Keep them, then append appearance preferences as 0027.
const integrationPath = 'tests/integration-check.js';
let integration = load(integrationPath);
const startMarker = '  ...Array.from({length:25}';
const start = integration.indexOf(startMarker);
const endMarker = "\n  'database/diagnostics/league_schema_preflight.sql'";
const end = start === -1 ? -1 : integration.indexOf(endMarker, start);
if (start === -1 || end === -1 || integration.indexOf(startMarker, start + 1) !== -1) {
  throw new Error(`${integrationPath}: could not uniquely locate the numbered migration list. No files have been changed.`);
}
const migrations = [
  'identity_social',
  'content_social',
  'wallet_payments',
  'live_social_systems',
  'rls_policies',
  'seed_config',
  'payment_idempotency',
  'server_authoritative_leagues',
  'live_pending_state',
  'rls_hardening',
  'user_settings',
  'live_chat_messages',
  'wallet_package_contracts',
  'creator_league_server',
  'teams_backend_complete',
  'official_division_tiers',
  'team_schema_compatibility_repair',
  'teams_schema_convergence',
  'league_operations_and_payouts',
  'wallet_gift_schema_and_security',
  'social_academy_conversations',
  'creator_media_storage',
  'settings_schedules_analytics',
  'creator_community_account_controls',
  'chl_gift_catalogue_pricing',
  'live_room_experience',
  'appearance_preferences'
];
const migrationList = `  ...[\n${migrations.map(name => `    '${name}'`).join(',\n')}\n  ].map((name, i) => \`database/migrations/\${String(i + 1).padStart(4, '0')}_\${name}.sql\`),`;
integration = integration.slice(0, start) + migrationList + integration.slice(end);
saveText(integrationPath, integration);

// Static migration validator: expect all 27 unique, sequential SQL migrations.
const staticPath = 'tests/migration-static-check.mjs';
let staticCheck = load(staticPath);
staticCheck = replaceExactlyOnce(
  staticCheck,
  'assert.equal(files.length, 25, `Expected 25 ordered migrations, found ${files.length}`);',
  'assert.equal(files.length, 27, `Expected 27 ordered migrations, found ${files.length}`);',
  staticPath
);
staticCheck = replaceExactlyOnce(staticCheck, "'0025_appearance_preferences.sql'", "'0027_appearance_preferences.sql'", staticPath);
staticCheck = staticCheck.replaceAll('0025 is transaction-wrapped', '0027 is transaction-wrapped')
  .replaceAll('0025 validates supported layout and theme values', '0027 validates supported layout and theme values')
  .replaceAll('0025 reloads PostgREST schema cache and commits', '0027 reloads PostgREST schema cache and commits');
saveText(staticPath, staticCheck);

// Appearance contract test reads the new, non-conflicting migration number.
const appearancePath = 'tests/appearance-verification-update-check.mjs';
let appearanceCheck = load(appearancePath);
appearanceCheck = replaceExactlyOnce(appearanceCheck, "'../database/migrations/0025_appearance_preferences.sql'", "'../database/migrations/0027_appearance_preferences.sql'", appearancePath);
saveText(appearancePath, appearanceCheck);

// Payment/deployment contract test also points at appearance migration 0027.
const paymentPath = 'tests/deployment-payment-check.mjs';
let paymentCheck = load(paymentPath);
paymentCheck = replaceExactlyOnce(paymentCheck, "const migration25=read('database/migrations/0025_appearance_preferences.sql');", "const migrationAppearance=read('database/migrations/0027_appearance_preferences.sql');", paymentPath);
if (!paymentCheck.includes('migration25')) {
  throw new Error(`${paymentPath}: expected legacy migration25 assertions were not found. No files have been changed.`);
}
paymentCheck = paymentCheck.replaceAll('migration25', 'migrationAppearance');
saveText(paymentPath, paymentCheck);

// Validate every planned change before writing any file.
for (const [relativePath, content] of pending) {
  if (!content || !content.trim()) throw new Error(`${relativePath}: refusing to write empty content.`);
}
for (const [relativePath, content] of pending) {
  fs.writeFileSync(path.join(root, relativePath), content, 'utf8');
}
console.log('Updated migration contract checks:');
for (const relativePath of pending.keys()) console.log(`  ${relativePath}`);
console.log('No product source or SQL migration was executed. Review with git diff --check and npm run check.');
