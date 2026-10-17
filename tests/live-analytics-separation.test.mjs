import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import assert from 'node:assert/strict';

const root = fs.mkdtempSync(path.join(os.tmpdir(), 'chl-analytics-separation-'));
const files = [
  'frontend/src/pages-creator.js',
  'android/app/src/main/assets/web/src/pages-creator.js'
];
const titleQuery = "query('LIVE sessions',sb.from('live_sessions').select('id,title,status,viewer_count,started_at,ended_at',{count:'exact'}).eq('host_id',uid).order('started_at',{ascending:false}).limit(500))";
const titleFreeQuery = "query('LIVE sessions',sb.from('live_sessions').select('id,status,viewer_count,started_at,ended_at',{count:'exact'}).eq('host_id',uid).order('started_at',{ascending:false}).limit(500))";
const listLine = "      if(recentLives.length){var liveList=el('div',{style:'margin-top:12px'});recentLives.slice(0,8).forEach(function(row){liveList.appendChild(el('div',{class:'row wrap',style:'justify-content:space-between;gap:8px;padding:9px 0;border-bottom:1px solid var(--line,#353747)'},[el('span',{style:'min-width:0;overflow-wrap:anywhere',text:row.title||'Untitled LIVE'}),el('span',{class:'sub',text:(row.started_at?new Date(row.started_at).toLocaleDateString():'Date unavailable')+' · '+(row.status||'status unavailable')})]));});live.appendChild(liveList);}else live.appendChild(ui.empty('🎙️','No LIVE sessions in this period','Recorded LIVE sessions will appear here after you go live.'));";
const fixture = [titleQuery, listLine, "// LIVE title is used by proper LIVE features elsewhere", "sb.from('live_sessions').select('id,title').limit(30);", "// LIVE chat table is not touched by Analytics", "sb.from('live_chat_messages').select('body');"].join('\n');
try {
  for (const relative of files) {
    const file = path.join(root, relative);
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, fixture);
  }
  const script = path.resolve('tools/apply-live-analytics-separation.mjs');
  const run = spawnSync(process.execPath, [script, root], { encoding: 'utf8' });
  assert.equal(run.status, 0, run.stderr || run.stdout);
  const outputs = files.map(relative => fs.readFileSync(path.join(root, relative), 'utf8'));
  for (const output of outputs) {
    assert.ok(output.includes(titleFreeQuery), 'Analytics query must not fetch title');
    assert.ok(!output.includes(titleQuery), 'Old title query must be gone');
    assert.ok(!output.includes('if(recentLives.length){var liveList='), 'Entire title list must be removed');
    assert.ok(output.includes("sb.from('live_sessions').select('id,title').limit(30);"), 'Title remains available to other LIVE features');
    assert.ok(output.includes("sb.from('live_chat_messages').select('body');"), 'Chat feature remains untouched');
  }
  assert.equal(outputs[0], outputs[1], 'Web and Android source outputs must match');

  // Guarded fail: drift in one source must prevent writes to the other.
  fs.writeFileSync(path.join(root, files[1]), 'unexpected source version');
  const beforeWeb = fs.readFileSync(path.join(root, files[0]), 'utf8');
  const failed = spawnSync(process.execPath, [script, root], { encoding: 'utf8' });
  assert.notEqual(failed.status, 0);
  assert.equal(fs.readFileSync(path.join(root, files[0]), 'utf8'), beforeWeb);
  console.log('PASS — removes title query and whole list; preserves other LIVE title/chat features; keeps web/Android parity; refuses source drift safely.');
} finally {
  fs.rmSync(root, { recursive: true, force: true });
}
