import fs from 'node:fs';
import assert from 'node:assert/strict';
const sql = fs.readFileSync(new URL('../database/migrations/0016_official_division_tiers.sql', import.meta.url), 'utf8');
const ui = fs.readFileSync(new URL('../frontend/src/pages-creator.js', import.meta.url), 'utf8');
const expected = ['D5','D4','D3','D2','D1','C5','C4','C3','C2','C1','B5','B4','B3','B2','B1','A3','A2','A1'];
for (const code of expected) { assert.match(sql, new RegExp("\\('"+code+"'"), `missing ${code} in migration`); assert.match(ui, new RegExp("\\b"+code+"\\s*:"), `missing ${code} in UI tier map`); }
assert.match(sql, /Legacy \(not a competitive division\)/);
assert.match(ui, /Grandmaster/);
console.log('PASS — official 18-division hierarchy exists in migration and league UI mapping.');
