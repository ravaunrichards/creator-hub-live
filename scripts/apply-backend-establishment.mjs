import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '..');
const target = path.join(root, 'backend', 'src', 'server.js');

if (!fs.existsSync(target)) {
  console.error('Cannot find backend/src/server.js. Run this installer from the root of the current Creator Hub Live repository.');
  process.exit(1);
}

let source = fs.readFileSync(target, 'utf8');
const requiredArtifacts = [
  'backend/src/production-hardening.js',
  'backend/src/live-room-experience.js',
  'backend/src/team-leagues.js',
];
for (const relative of requiredArtifacts) {
  if (!fs.existsSync(path.join(root, relative))) {
    console.error(`Required current project file is missing: ${relative}`);
    process.exit(1);
  }
}

const markers = {
  imports: 'import { createRequestGuard, publicErrorPayload, readLimitedBody, sanitizeErrorForLog } from "./production-hardening.js";',
  liveImport: 'import { handleLiveRoomExperience } from "./live-room-experience.js";',
  teamImport: 'import { handleTeamLeagueRoute } from "./team-leagues.js";',
  guard: 'const backendRequestGuard = createRequestGuard();',
  body: 'return readLimitedBody(req);',
  begin: 'backendRequestGuard.begin(req, res, pathname, method);',
  check: 'backendRequestGuard.check(req, { pathname, method })',
  teamRoute: 'await handleTeamLeagueRoute(routeContext)',
  liveRoute: 'await handleLiveRoomExperience(routeContext)',
  timeout: 'server.headersTimeout = 15_000;',
  shutdown: 'process.once("SIGTERM", () => gracefulShutdown("SIGTERM"));',
};

const wasInstalled = Object.values(markers).every(marker => source.includes(marker));
if (wasInstalled) {
  console.log('Backend establishment foundation is already installed; no files changed.');
  process.exit(0);
}
const anyInstalled = Object.values(markers).some(marker => source.includes(marker));
if (anyInstalled) {
  console.error('The backend appears partially updated. No files were changed. Inspect backend/src/server.js before retrying; automatic patching stops to avoid duplicate or misplaced routes.');
  process.exit(2);
}

const original = source;
function replaceOnce(from, to, label) {
  const first = source.indexOf(from);
  if (first < 0) throw new Error(`Could not locate expected source anchor for ${label}. No files were changed.`);
  if (source.indexOf(from, first + from.length) >= 0) throw new Error(`Source anchor for ${label} appears more than once. No files were changed.`);
  source = source.slice(0, first) + to + source.slice(first + from.length);
}
function replaceBlock(start, end, replacement, label) {
  const first = source.indexOf(start);
  if (first < 0) throw new Error(`Could not locate start of ${label}. No files were changed.`);
  const last = source.indexOf(end, first + start.length);
  if (last < 0) throw new Error(`Could not locate end of ${label}. No files were changed.`);
  if (source.indexOf(start, first + start.length) >= 0) throw new Error(`Start marker for ${label} appears more than once. No files were changed.`);
  source = source.slice(0, first) + replacement + source.slice(last);
}

try {
  replaceOnce(
    'import { closeOrphanedLiveRooms } from "./live-room-lifecycle.js";\n',
    'import { closeOrphanedLiveRooms } from "./live-room-lifecycle.js";\n' +
      'import { handleLiveRoomExperience } from "./live-room-experience.js";\n' +
      'import { handleTeamLeagueRoute } from "./team-leagues.js";\n' +
      'import { createRequestGuard, publicErrorPayload, readLimitedBody, sanitizeErrorForLog } from "./production-hardening.js";\n',
    'backend imports',
  );

  replaceBlock(
    'async function readRawBody(req) {',
    '\nasync function readJson(req) {',
    'async function readRawBody(req) {\n  return readLimitedBody(req);\n}\n',
    'request body size guard',
  );

  replaceBlock(
    'function errorResponse(res, error) {',
    '\nfunction allowedOrigin(origin) {',
    'function errorResponse(res, error) {\n' +
      '  const normalized = normalizeExternalError(error);\n' +
      '  const status = Number(error?.status) || Number(error?.statusCode) || 500;\n' +
      '  const code = error?.code || normalized.code || "INTERNAL_ERROR";\n' +
      '  const requestId = res.getHeader?.("X-Request-ID") || undefined;\n' +
      '  console.error("[Creator Hub Backend Error]", JSON.stringify({\n' +
      '    event: "http.request.error", requestId, status, code,\n' +
      '    errorType: normalized.name || "Error", errorMessage: sanitizeErrorForLog(normalized.message),\n' +
      '  }));\n' +
      '  return send(res, status, publicErrorPayload({\n' +
      '    status, code, message: normalized.message, details: normalized.details, hint: normalized.hint,\n' +
      '  }, requestId));\n' +
      '}\n',
    'safe error response and correlation logging',
  );

  replaceOnce(
    'const server = http.createServer(async (req, res) => {',
    'const backendRequestGuard = createRequestGuard();\n\nconst server = http.createServer(async (req, res) => {',
    'request guard creation',
  );

  replaceOnce(
    '  const method = req.method;\n\n  if (method === "OPTIONS") {',
    '  const method = req.method;\n  backendRequestGuard.begin(req, res, pathname, method);\n\n  if (method === "OPTIONS") {',
    'request ID and structured completion logs',
  );

  replaceOnce(
    '  try {\n    // The Teams API implementation already lives in its own module.',
    '  try {\n' +
      '    const rateDecision = backendRequestGuard.check(req, { pathname, method });\n' +
      '    if (!rateDecision.allowed) {\n' +
      '      const requestId = req.__chlRequestId;\n' +
      '      return send(res, 429, {\n' +
      '        ok: false, code: "RATE_LIMITED",\n' +
      '        error: "Too many requests. Please slow down and try again.",\n' +
      '        retryAfter: rateDecision.retryAfter, requestId,\n' +
      '      }, { "Retry-After": String(rateDecision.retryAfter) });\n' +
      '    }\n\n' +
      '    const routeContext = { pathname, method, req, res, url, fail, ok, send, db, requireSupabaseUser, readJson, normalizeExternalError, profileFor };\n' +
      '    const teamLeagueHandled = await handleTeamLeagueRoute(routeContext);\n' +
      '    if (teamLeagueHandled || res.writableEnded) return;\n' +
      '    const liveExperienceHandled = await handleLiveRoomExperience(routeContext);\n' +
      '    if (liveExperienceHandled || res.writableEnded) return;\n\n' +
      '    // The Teams API implementation already lives in its own module.',
    'rate limiting and existing module routing',
  );

  replaceOnce(
    'server.listen(PORT, () => {',
    'server.headersTimeout = 15_000;\n' +
      'server.requestTimeout = 30_000;\n' +
      'server.keepAliveTimeout = 5_000;\n\n' +
      'server.listen(PORT, () => {',
    'HTTP server timeout configuration',
  );

  const finalListen = 'server.listen(PORT, () => {';
  const listenPos = source.lastIndexOf(finalListen);
  if (listenPos < 0) throw new Error('Could not find server startup callback. No files were changed.');
  const close = '  console.log(`[Creator Hub Backend] Running successfully on port ${PORT}`);';
  const closePos = source.indexOf(close, listenPos);
  const closeEnd = source.indexOf('\n});', closePos);
  if (closePos < 0 || closeEnd < 0) throw new Error('Could not safely identify the final server startup block. No files were changed.');
  const currentStartup = source.slice(closePos, closeEnd + '\n});'.length);
  if (currentStartup.includes('reconcileOrphanedLiveRooms')) {
    // Retain the newer existing live-room reconciliation startup from main.
  }
  source += '\n\nlet shuttingDown = false;\n' +
    'function gracefulShutdown(signal) {\n' +
    '  if (shuttingDown) return;\n' +
    '  shuttingDown = true;\n' +
    '  console.info(JSON.stringify({ event: "server.shutdown.start", signal }));\n' +
    '  const forceTimer = setTimeout(() => {\n' +
    '    console.error(JSON.stringify({ event: "server.shutdown.timeout", signal }));\n' +
    '    if (typeof server.closeAllConnections === "function") server.closeAllConnections();\n' +
    '  }, 10_000);\n' +
    '  forceTimer.unref?.();\n' +
    '  server.close((error) => {\n' +
    '    clearTimeout(forceTimer);\n' +
    '    if (error) {\n' +
    '      console.error(JSON.stringify({ event: "server.shutdown.error", signal, message: String(error.message || error).slice(0, 300) }));\n' +
    '      process.exitCode = 1;\n' +
    '    }\n' +
    '  });\n' +
    '}\n' +
    'process.once("SIGTERM", () => gracefulShutdown("SIGTERM"));\n' +
    'process.once("SIGINT", () => gracefulShutdown("SIGINT"));\n';

  // Fail closed on missed or duplicated contract markers before touching disk.
  for (const [name, marker] of Object.entries(markers)) {
    if (!source.includes(marker)) throw new Error(`Post-patch validation failed for ${name}. No files were changed.`);
  }
  const importCounts = [markers.imports, markers.liveImport, markers.teamImport].map(m => source.split(m).length - 1);
  if (importCounts.some(count => count !== 1)) throw new Error('Expected exactly one of each new import. No files were changed.');
  if (source === original) throw new Error('No source changes were necessary, but integration markers were missing. No files were changed.');
  fs.writeFileSync(target, source, 'utf8');
  console.log('Installed: request limits, write-rate guards, request IDs, sanitized server errors, LIVE experience routes, team-league routes, HTTP timeouts and graceful shutdown.');
  console.log('No external services or database objects were modified. Review the resulting diff before deployment.');
} catch (error) {
  console.error(error.message || error);
  process.exit(1);
}
