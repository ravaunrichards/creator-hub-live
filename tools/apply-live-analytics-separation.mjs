#!/usr/bin/env node
/**
 * Guarded CHL source update: LIVE Analytics is aggregate-only, not a list of stream titles.
 * No DB rows are deleted and no LIVE chat/history code is touched.
 */
import fs from 'node:fs';
import path from 'node:path';

const root = process.argv[2] ? path.resolve(process.argv[2]) : process.cwd();
const targets = [
  'frontend/src/pages-creator.js',
  'android/app/src/main/assets/web/src/pages-creator.js'
];
const titleQuery = "query('LIVE sessions',sb.from('live_sessions').select('id,title,status,viewer_count,started_at,ended_at',{count:'exact'}).eq('host_id',uid).order('started_at',{ascending:false}).limit(500))";
const titleFreeQuery = "query('LIVE sessions',sb.from('live_sessions').select('id,status,viewer_count,started_at,ended_at',{count:'exact'}).eq('host_id',uid).order('started_at',{ascending:false}).limit(500))";
const listLine = line => line.includes('if(recentLives.length){var liveList=') && line.includes("No LIVE sessions in this period") && line.includes('row.title||\'Untitled LIVE\'');

const pending = [];
for (const relative of targets) {
  const file = path.join(root, relative);
  if (!fs.existsSync(file)) throw new Error(`Required project file not found: ${relative}. No files were changed.`);
  const original = fs.readFileSync(file, 'utf8');
  const queryCount = original.split(titleQuery).length - 1;
  const queryAlreadyFixed = original.includes(titleFreeQuery);
  if (queryCount !== 1 && !(queryCount === 0 && queryAlreadyFixed)) {
    throw new Error(`Expected exactly one Analytics title query or its corrected form in ${relative}; found ${queryCount}. No files were changed.`);
  }
  const lines = original.split(/\r?\n/);
  const listIndices = lines.map((line, index) => listLine(line) ? index : -1).filter(index => index >= 0);
  const alreadyRemoved = listIndices.length === 0;
  if (listIndices.length !== 1 && !alreadyRemoved) {
    throw new Error(`Expected one LIVE Analytics session-title list line in ${relative}; found ${listIndices.length}. No files were changed.`);
  }
  if (queryCount === 0 && !queryAlreadyFixed) {
    throw new Error(`Could not verify Analytics query in ${relative}. No files were changed.`);
  }
  if (alreadyRemoved && !queryAlreadyFixed) {
    throw new Error(`Session list is absent but query is not corrected in ${relative}; refusing uncertain edit. No files were changed.`);
  }
  let updated = original;
  if (queryCount === 1) updated = updated.replace(titleQuery, titleFreeQuery);
  if (listIndices.length === 1) {
    const updatedLines = updated.split(/\r?\n/);
    const idx = updatedLines.findIndex(listLine);
    if (idx < 0) throw new Error(`Could not re-find session list in ${relative}. No files were changed.`);
    updatedLines.splice(idx, 1);
    updated = updatedLines.join('\n');
  }
  if (updated.includes(titleQuery) || /if\(recentLives\.length\)\{var liveList=/.test(updated)) {
    throw new Error(`Post-edit validation failed in ${relative}. No files were changed.`);
  }
  pending.push({ file, relative, original, updated });
}

// Both platform files have been fully validated before any write occurs.
if (pending[0].updated !== pending[1].updated) {
  throw new Error('Web and Android source changes would differ. No files were changed.');
}
for (const item of pending) if (item.original !== item.updated) fs.writeFileSync(item.file, item.updated, 'utf8');
console.log('PASS — Analytics no longer fetches LIVE titles or displays a per-session title list on web and Android.');
console.log('Aggregate LIVE metrics remain. LIVE session titles and chat history are untouched in their proper features.');
