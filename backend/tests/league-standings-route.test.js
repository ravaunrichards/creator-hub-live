import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const source = fs.readFileSync(path.join(root, 'src', 'server.js'), 'utf8');
const route = 'if (pathname === "/api/leagues/standings" && method === "GET")';
const routeAt = source.indexOf(route);
const fallbackAt = source.indexOf('// 404 Fallback');
assert.notEqual(routeAt, -1, 'GET /api/leagues/standings route must exist');
assert.ok(fallbackAt > routeAt, 'league standings route must be checked before the generic 404 fallback');
const body = source.slice(routeAt, fallbackAt);
for (const required of [
  'await requireSupabaseUser(req)',
  '.from("league_seasons")',
  '.eq("status", "active")',
  'if (!activeSeason) return ok(res, { activeSeason: null, standings: [] })',
  '.from("league_standings")',
  '.eq("season_id", activeSeason.id)',
  'return ok(res, { activeSeason, standings: standings || [] })',
  'LEAGUE_SEASON_LOOKUP_FAILED',
  'LEAGUE_STANDINGS_LOOKUP_FAILED',
]) assert.ok(body.includes(required), `missing required league route behavior: ${required}`);
console.log('PASS — authenticated GET /api/leagues/standings is registered before the 404 fallback.');
console.log('PASS — active-season lookup, empty-season response, standings query, and explicit error codes are present.');
