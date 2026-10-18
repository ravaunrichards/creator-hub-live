#!/usr/bin/env node
// Safe, minimal CHL server route registration fix.
// Run from the root of the existing creator-hub-live repository:
//   node chl-league-standing-fix/apply-server-route-fix.mjs
import { readFile, writeFile, copyFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';

const target = resolve('backend/src/server.js');
if (!existsSync(target)) {
  console.error('STOP: backend/src/server.js was not found. Run this script from the repository root.');
  process.exit(2);
}
const before = await readFile(target, 'utf8');
const oldLine = 'if (pathname === "/api/teams" || pathname.startsWith("/api/teams/")) {';
const newLine = 'if (pathname === "/api/teams" || pathname.startsWith("/api/teams/") || pathname.startsWith("/api/leagues/")) {';
if (before.includes(newLine)) {
  console.log('Already fixed: Teams and League routes are both dispatched to handleTeamsRoute. No changes made.');
  process.exit(0);
}
const count = before.split(oldLine).length - 1;
if (count !== 1) {
  console.error(`STOP: expected exactly one known route-dispatch line, found ${count}. No changes made. Inspect backend/src/server.js manually; do not overwrite it.`);
  process.exit(3);
}
const backup = `${target}.before-chl-league-route-fix.bak`;
if (existsSync(backup)) {
  console.error(`STOP: backup already exists at ${backup}. No files changed; inspect the backup before retrying.`);
  process.exit(4);
}
await copyFile(target, backup);
await writeFile(target, before.replace(oldLine, newLine), 'utf8');
console.log('Fixed backend/src/server.js route dispatch.');
console.log(`Backup saved to ${backup}`);
