import fs from 'node:fs';
import assert from 'node:assert/strict';
const read = p => fs.readFileSync(new URL(p, import.meta.url), 'utf8');
const routes = read('../backend/src/teams-routes.js');
const ui = read('../frontend/src/pages-teams.js');
const sql = read('../database/migrations/0015_teams_backend_complete.sql');
const serverPatch = read('../docs/server-integration.patch.txt');
const frontPatch = read('../docs/frontend-integration.patch.txt');
for (const endpoint of [
  '"/api/teams"', '"join"', '"leave"', '"PATCH"', '"DELETE"',
  'create_team_for_user', 'join_team_for_user', 'update_team_for_user', 'requireSupabaseUser',
  'TEAM_OWNER_REQUIRED', 'OWNER_CANNOT_LEAVE', 'TEAM_FULL'
]) assert.ok(routes.includes(endpoint), `Missing backend contract: ${endpoint}`);
for (const feature of ['renderCreateForm', 'renderEditForm', 'renderDetail', 'Team members', 'division_code', 'recruiting', 'max_members'])
  assert.ok(ui.includes(feature), `Missing UI feature: ${feature}`);
for (const rule of ['create_team_for_user', 'join_team_for_user', 'update_team_for_user', 'security definer', 'pg_advisory_xact_lock', "'D5'", 'team_members'])
  assert.ok(sql.toLowerCase().includes(rule.toLowerCase()), `Missing SQL rule: ${rule}`);
assert.ok(serverPatch.includes('PATCH, DELETE'), 'CORS must allow PATCH and DELETE');
assert.ok(frontPatch.includes('src/pages-teams.js'), 'Frontend integration instruction missing');
console.log('PASS — Teams update package static contract checks.');
