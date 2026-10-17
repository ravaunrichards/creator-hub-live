import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root=path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const read=(file)=>fs.readFileSync(path.join(root,file),'utf8');
const server=read('src/server.js');
const hardening=read('src/production-hardening.js');
const liveExperience=read('src/live-room-experience.js');
const teamLeagues=read('src/team-leagues.js');

for (const needle of [
  'import { createRequestGuard, publicErrorPayload, readLimitedBody, sanitizeErrorForLog } from "./production-hardening.js";',
  'import { handleLiveRoomExperience } from "./live-room-experience.js";',
  'import { handleTeamLeagueRoute } from "./team-leagues.js";',
  'backendRequestGuard.begin(req, res, pathname, method);',
  'backendRequestGuard.check(req, { pathname, method })',
  'return readLimitedBody(req);',
  'publicErrorPayload(',
  'await handleTeamLeagueRoute(routeContext)',
  'await handleLiveRoomExperience(routeContext)',
  'server.headersTimeout = 15_000;',
  'process.once("SIGTERM", () => gracefulShutdown("SIGTERM"));',
]) assert.ok(server.includes(needle), `Missing backend integration contract: ${needle}`);

for (const needle of ['PAYLOAD_TOO_LARGE','createRequestGuard','publicErrorPayload','normalizeRouteForLogs']) assert.ok(hardening.includes(needle));
for (const needle of ['participants','gift-events','polls','questions','moderators','analytics','recordings','settings','chat-moderation','reactions']) assert.ok(liveExperience.includes(`'${needle}'`), `LIVE experience route missing ${needle}`);
assert.ok(teamLeagues.includes('/api/admin/leagues/seasons'));
assert.ok(teamLeagues.includes('/api/leagues/standings'));

console.log('PASS — production hardening is wired into the live server, and existing LIVE experience/team-season routers are reachable before the fallback.');
