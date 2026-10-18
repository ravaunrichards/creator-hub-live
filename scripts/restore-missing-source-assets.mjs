/**
 * Restore source files missing from the recovered archive without overwriting
 * any existing local file. Each remote source is pinned to its Git blob SHA.
 * Run from the repository root: node scripts/restore-missing-source-assets.mjs
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import { createHash } from 'node:crypto';

const ROOT = process.cwd();
const REPO = 'ravaunrichards/creator-hub-live';
const REF = 'main';
const FILES = [
  ['frontend/src/pages-teams.js','1fb9cae3c314354a8872b8c599308f4dd6951bf7'],
  ['frontend/src/pages-accessibility.js','71e4570856cbfdb08f377cc51193845f9ff29117'],
  ['frontend/src/pages-account.js','03a03ca395934b5d7265be1963ac21395c5c3244'],
  ['frontend/src/pages-community.js','190a746cd26e450a74f3322296e261c904753d44'],
  ['frontend/src/pages-profile.js','d1e149e66113dc5636c352d042b2e50db44d23c5'],
  ['frontend/src/studio-edition.js','fbc4dc6e62ed6c71a4163a8f20f1563445c0303c'],
  ['frontend/src/pages-platform-tools.js','bbf73ec2e9655a26302cafd8df3ecc74929f0333'],
  ['frontend/styles/studio-edition.css','cbf5be0ace1783817a6ad2f5afd5e0a1003eb549'],
  ['frontend/styles/nexus-edition.css','db62bee44ae24779986b22f2a9dfb624f38bbd47'],
  ['frontend/styles/chl-style-system.css','6e826462390991b1e31557430fd880a220d687bf'],
  ['android/app/src/main/assets/web/src/pages-teams.js','1fb9cae3c314354a8872b8c599308f4dd6951bf7'],
  ['android/app/src/main/assets/web/src/pages-accessibility.js','71e4570856cbfdb08f377cc51193845f9ff29117'],
  ['android/app/src/main/assets/web/src/pages-account.js','03a03ca395934b5d7265be1963ac21395c5c3244'],
  ['android/app/src/main/assets/web/src/pages-community.js','190a746cd26e450a74f3322296e261c904753d44'],
  ['android/app/src/main/assets/web/src/pages-profile.js','d1e149e66113dc5636c352d042b2e50db44d23c5'],
  ['android/app/src/main/assets/web/src/studio-edition.js','fbc4dc6e62ed6c71a4163a8f20f1563445c0303c'],
  ['android/app/src/main/assets/web/src/pages-platform-tools.js','bbf73ec2e9655a26302cafd8df3ecc74929f0333'],
  ['android/app/src/main/assets/web/styles/studio-edition.css','cbf5be0ace1783817a6ad2f5afd5e0a1003eb549'],
  ['android/app/src/main/assets/web/styles/nexus-edition.css','db62bee44ae24779986b22f2a9dfb624f38bbd47'],
  ['android/app/src/main/assets/web/styles/chl-style-system.css','6e826462390991b1e31557430fd880a220d687bf'],
  ['backend/src/live-room-lifecycle.js','ce87009b792af18b949dec23349b57a907e0af83'],
  ['backend/src/live-room-experience.js','97b8a6295f14c2e8848207c5ff3b1b98b0966390'],
  ['backend/src/team-leagues.js','7689f6605d50617d435ebf39f1eeb0d9196f0e8a'],
  ['backend/tests/live-room-lifecycle.test.js','89779d18a7c220b54330a945c4de62662f1e9006'],
  ['backend/tests/team-leagues.test.js','ede363479f3eac822ee656c6f51261c6ea528070'],
  ['backend/tests/team-season-admin.test.js','299e5fc8463def2dba3ff0c24c8c25a94bf91cf9'],
  ['backend/tests/team-league-operations.test.js','67d78992da468f9fb4a355066a6a4f80af1698e9'],
  ['backend/tests/backend-establishment-contract.test.js','bf6e25ef15f1979b91f3a21995c7cbac66b82f8e'],
];

function gitBlobSha(buffer) {
  const header = Buffer.from(`blob ${buffer.length}\0`);
  return createHash('sha1').update(Buffer.concat([header, buffer])).digest('hex');
}

let restored = 0, preserved = 0, failed = 0;
for (const [relative, expectedSha] of FILES) {
  const target = path.join(ROOT, relative);
  try {
    await fs.access(target);
    console.log(`PRESERVED existing file: ${relative}`);
    preserved++;
    continue;
  } catch { /* Missing: retrieve pinned source below. */ }
  const url = `https://raw.githubusercontent.com/${REPO}/${REF}/${relative}`;
  try {
    const response = await fetch(url, { redirect: 'follow' });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const content = Buffer.from(await response.arrayBuffer());
    const actualSha = gitBlobSha(content);
    if (actualSha !== expectedSha) throw new Error(`source SHA mismatch (expected ${expectedSha}, received ${actualSha})`);
    await fs.mkdir(path.dirname(target), { recursive: true });
    // wx is deliberately exclusive: never replace a file created during the fetch.
    const handle = await fs.open(target, 'wx');
    try { await handle.writeFile(content); } finally { await handle.close(); }
    console.log(`RESTORED ${relative} (${content.length} bytes, SHA verified)`);
    restored++;
  } catch (error) {
    console.error(`FAILED ${relative}: ${error.message}`);
    failed++;
  }
}
console.log(`\nRecovery summary: ${restored} restored, ${preserved} preserved, ${failed} failed.`);
if (failed) process.exitCode = 1;
