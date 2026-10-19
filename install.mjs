import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const packageRoot = path.dirname(fileURLToPath(import.meta.url));
const args = process.argv.slice(2);
let targetRoot = process.cwd();
for (let i = 0; i < args.length; i += 1) {
  if (args[i] === '--target' && args[i + 1]) {
    targetRoot = path.resolve(args[i + 1]);
    i += 1;
  }
}

const serverPath = path.join(targetRoot, 'backend', 'src', 'server.js');
const packagePath = path.join(targetRoot, 'backend', 'package.json');
if (!fs.existsSync(serverPath) || !fs.existsSync(packagePath)) {
  console.error('INSTALL FAILED: target must be the root of the existing Creator Hub Live repository.');
  console.error('Run: node /path/to/extracted-fix/install.mjs --target /path/to/creator-hub-live');
  process.exit(1);
}

const serverOriginal = fs.readFileSync(serverPath, 'utf8');
const packageOriginal = fs.readFileSync(packagePath, 'utf8');
let server = serverOriginal;
let pkg;
try { pkg = JSON.parse(packageOriginal); }
catch { console.error('INSTALL FAILED: backend/package.json is not valid JSON. No files changed.'); process.exit(1); }

const oldHelperStart = '/*\n * Reconcile stale database LIVE rows against LiveKit before advertising them.';
const helperStart = server.indexOf(oldHelperStart);
const helperEnd = server.indexOf('function validateLiveRoomName', helperStart);
const hasNewImport = server.includes("from './live-room-lifecycle.js'") || server.includes('from "./live-room-lifecycle.js"');
const alreadyIntegrated = hasNewImport && server.includes('await closeOrphanedLiveRooms({') && server.includes('await closeLiveKitRoom(room.room_name');
if (alreadyIntegrated) {
  console.log('No server integration changes needed; lifecycle module import is already present. Checking required files and tests.');
} else {
  if (helperStart >= 0 && helperEnd >= 0) {
    // Remove the old helper that incorrectly selects the nonexistent created_at column.
    server = server.slice(0, helperStart) + server.slice(helperEnd);
    // RoomServiceClient was only used by the old inline helper.
    server = server.replace(/^import \{ RoomServiceClient \} from "livekit-server-sdk";\r?\n/m, '');
  } else if (server.includes('function closeOrphanedLiveRooms')) {
    console.error('INSTALL FAILED: partial/unknown LIVE cleanup helper found. No files changed.');
    process.exit(1);
  }

  const tokenImport = '} from "./livekit-token.js";';
  if (!server.includes(tokenImport)) {
    console.error('INSTALL FAILED: expected LiveKit token import anchor not found. No files changed.');
    process.exit(1);
  }
  if (!hasNewImport) {
    server = server.replace(tokenImport, `${tokenImport}\nimport { closeOrphanedLiveRooms, closeLiveKitRoom } from './live-room-lifecycle.js';`);
  }

  const oldListCall = /^\s*await closeOrphanedLiveRooms\(client\);$/m;
  if (oldListCall.test(server)) {
    server = server.replace(oldListCall, `      try {\n        await closeOrphanedLiveRooms({\n          client,\n          livekitUrl: LIVEKIT_URL,\n          apiKey: process.env.LIVEKIT_API_KEY,\n          apiSecret: process.env.LIVEKIT_API_SECRET,\n        });\n      } catch (cleanupError) {\n        console.warn('[LIVE cleanup] Reconciliation failed safely:', cleanupError?.message || cleanupError);\n      }`);
  } else if (!server.includes('await closeOrphanedLiveRooms({')) {
    const listAnchor = '    // LIVE Rooms - List\n    if (pathname === \"/api/live/rooms\" && method === \"GET\") {\n      const client = db();';
    if (!server.includes(listAnchor)) {
      console.error('INSTALL FAILED: LIVE rooms list reconciliation anchor was not found. No files changed.');
      process.exit(1);
    }
    server = server.replace(listAnchor, `${listAnchor}\n      try {\n        await closeOrphanedLiveRooms({\n          client,\n          livekitUrl: LIVEKIT_URL,\n          apiKey: process.env.LIVEKIT_API_KEY,\n          apiSecret: process.env.LIVEKIT_API_SECRET,\n        });\n      } catch (cleanupError) {\n        console.warn('[LIVE cleanup] Reconciliation failed safely:', cleanupError?.message || cleanupError);\n      }`);
  }

  const endStart = server.indexOf('if (liveParts.action === "end" && method === "POST") {');
  const leaveStart = server.indexOf('if (liveParts.action === "leave" && method === "POST") {', endStart);
  if (endStart < 0 || leaveStart < 0) {
    console.error('INSTALL FAILED: expected LIVE end/leave handlers were not found. No files changed.');
    process.exit(1);
  }
  let endBlock = server.slice(endStart, leaveStart);
  if (!endBlock.includes('viewer_count: 0')) {
    const endUpdateAnchor = '            updated_at: new Date().toISOString(),';
    if (endBlock.includes(endUpdateAnchor)) {
      endBlock = endBlock.replace(endUpdateAnchor, `${endUpdateAnchor}\n            viewer_count: 0,`);
    }
  }
  const returnText = '        return ok(res, data);';
  if (!endBlock.includes('await closeLiveKitRoom(room.room_name')) {
    const returnIndex = endBlock.lastIndexOf(returnText);
    if (returnIndex < 0) {
      console.error('INSTALL FAILED: successful LIVE end response anchor was not found. No files changed.');
      process.exit(1);
    }
    const closeCall = `        await closeLiveKitRoom(room.room_name, {\n          livekitUrl: LIVEKIT_URL,\n          apiKey: process.env.LIVEKIT_API_KEY,\n          apiSecret: process.env.LIVEKIT_API_SECRET,\n        });\n`;
    const newBlock = endBlock.slice(0, returnIndex) + closeCall + endBlock.slice(returnIndex);
    server = server.slice(0, endStart) + newBlock + server.slice(leaveStart);
  }
}

pkg.scripts ||= {};
pkg.scripts['test:live-room-lifecycle'] = 'node tests/live-room-lifecycle.test.js';
const baseTest = String(pkg.scripts.test || 'node tests/route-check.js && node tests/backend-syntax.js && node tests/livekit-contract.js');
if (!baseTest.includes('tests/live-room-lifecycle.test.js')) {
  pkg.scripts.test = `${baseTest} && node tests/live-room-lifecycle.test.js`;
}
const packageUpdated = JSON.stringify(pkg, null, 2) + '\n';

const requiredSources = [
  ['backend/src/live-room-lifecycle.js', path.join(packageRoot, 'backend', 'src', 'live-room-lifecycle.js')],
  ['backend/src/cleanup-live-rooms.js', path.join(packageRoot, 'backend', 'src', 'cleanup-live-rooms.js')],
  ['backend/tests/live-room-lifecycle.test.js', path.join(packageRoot, 'backend', 'tests', 'live-room-lifecycle.test.js')],
];
for (const [relative, source] of requiredSources) {
  if (!fs.existsSync(source)) {
    console.error(`INSTALL FAILED: package file missing: ${relative}. No repository files changed.`);
    process.exit(1);
  }
}

// All validation is complete before writing. Preserve originals in a dated backup folder.
const stamp = new Date().toISOString().replace(/[:.]/g, '-');
const backupDir = path.join(targetRoot, `.chl-live-room-backup-${stamp}`);
fs.mkdirSync(backupDir, { recursive: true });
fs.writeFileSync(path.join(backupDir, 'server.js'), serverOriginal);
fs.writeFileSync(path.join(backupDir, 'package.json'), packageOriginal);

try {
  if (server !== serverOriginal) fs.writeFileSync(serverPath, server);
  fs.writeFileSync(packagePath, packageUpdated);
  for (const [relative, source] of requiredSources) {
    const destination = path.join(targetRoot, relative);
    fs.mkdirSync(path.dirname(destination), { recursive: true });
    if (fs.existsSync(destination)) {
      const backup = path.join(backupDir, relative.replaceAll('/', '__'));
      fs.copyFileSync(destination, backup);
    }
    fs.copyFileSync(source, destination);
  }
} catch (error) {
  // Restore the two primary integration files if any copy/write failed.
  fs.writeFileSync(serverPath, serverOriginal);
  fs.writeFileSync(packagePath, packageOriginal);
  console.error('INSTALL FAILED; server.js and package.json were restored:', error?.message || error);
  process.exit(1);
}

console.log('INSTALL COMPLETE — LIVE room lifecycle files installed.');
console.log(`Backup saved at: ${backupDir}`);
console.log('Next: cd backend && node --check src/server.js && node --check src/live-room-lifecycle.js && node --check src/cleanup-live-rooms.js && npm run test:live-room-lifecycle && npm test');
console.log('This installer does not deploy, push code, change cloud settings, or write to Supabase.');
