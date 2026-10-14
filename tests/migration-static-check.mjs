import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';

const dir = 'database/migrations';
const files = fs.readdirSync(dir).filter((f) => /^\d{4}_.+\.sql$/.test(f)).sort();
assert.equal(files.length, 29, `Expected 29 ordered migrations, found ${files.length}`);
files.forEach((f, i) => assert.equal(Number(f.slice(0, 4)), i + 1, `Migration sequence gap before ${f}`));

function validateSql(text, label, allowDollar = true) {
  const stack = [];
  let i = 0;
  while (i < text.length) {
    const c = text[i], n = text[i + 1];
    if (c === '-' && n === '-') {
      i += 2; while (i < text.length && text[i] !== '\n') i++;
      continue;
    }
    if (c === '/' && n === '*') {
      i += 2; let depth = 1;
      while (i < text.length && depth) {
        if (text[i] === '/' && text[i + 1] === '*') { depth++; i += 2; }
        else if (text[i] === '*' && text[i + 1] === '/') { depth--; i += 2; }
        else i++;
      }
      assert.equal(depth, 0, `${label}: unclosed block comment`);
      continue;
    }
    if (c === "'") {
      i++; let closed = false;
      while (i < text.length) {
        if (text[i] === "'" && text[i + 1] === "'") { i += 2; continue; }
        if (text[i] === "'") { i++; closed = true; break; }
        // Backslash escapes are handled for the E'...' form used by PostgreSQL.
        if (text[i] === '\\' && /(?:^|[^A-Za-z0-9_])E$/i.test(text.slice(Math.max(0, i - 2), i))) { i += 2; continue; }
        i++;
      }
      assert.ok(closed, `${label}: unclosed single-quoted literal`);
      continue;
    }
    if (c === '"') {
      i++; let closed = false;
      while (i < text.length) {
        if (text[i] === '"' && text[i + 1] === '"') { i += 2; continue; }
        if (text[i] === '"') { i++; closed = true; break; }
        i++;
      }
      assert.ok(closed, `${label}: unclosed quoted identifier`);
      continue;
    }
    if (c === '$' && allowDollar) {
      const match = text.slice(i).match(/^\$[A-Za-z_][A-Za-z0-9_]*\$|^\$\$/);
      if (match) {
        const tag = match[0], from = i + tag.length, end = text.indexOf(tag, from);
        assert.ok(end !== -1, `${label}: unclosed dollar-quoted body ${tag}`);
        validateSql(text.slice(from, end), `${label} body ${tag}`, false);
        i = end + tag.length;
        continue;
      }
    }
    if (c === '(') stack.push(i);
    else if (c === ')') {
      assert.ok(stack.length, `${label}: unmatched closing parenthesis at offset ${i}`);
      stack.pop();
    }
    i++;
  }
  assert.equal(stack.length, 0, `${label}: ${stack.length} unclosed parenthesis(es)`);
}

for (const f of files) validateSql(fs.readFileSync(path.join(dir, f), 'utf8'), f);
const release = fs.readFileSync(path.join(dir, '0024_creator_community_account_controls.sql'), 'utf8');
const appearance = fs.readFileSync(path.join(dir, '0026_appearance_preferences.sql'), 'utf8');
assert.match(release, /^\s*(?:--[^\n]*\n\s*)*begin;/i, 'Release migration begins a transaction');
assert.match(release, /notify pgrst\s*,\s*'reload schema'\s*;\s*commit;\s*$/i, 'Release migration refreshes PostgREST schema cache and commits');
assert.match(release, /revoke select on public\.profiles from anon,authenticated/i, 'Profile internal-column exposure is restricted');
assert.match(release, /create or replace function public\.sync_follow_counts\(\)\s*returns trigger language plpgsql security definer set search_path=public,pg_temp/i, 'Follow count trigger permissions are hardened');
assert.match(release, /on conflict\(mission_id,user_id\) do nothing returning \* into v_claim/i, 'Mission claim submission is race-safe/idempotent');
assert.doesNotMatch(release.replace(/--[^\n]*/g, ''), /security definer(?!\s+set search_path=public,pg_temp)/i, 'Every SECURITY DEFINER routine in migration 0024 fixes its search path');
assert.match(appearance, /^\s*(?:--[^\n]*\n\s*)*begin;/i, '0025 is transaction-wrapped');
assert.match(appearance, /check\s*\([\s\S]*spacious[\s\S]*system[\s\S]*\)/i, '0025 validates supported layout and theme values');
assert.match(appearance, /notify pgrst\s*,\s*'reload schema'\s*;\s*commit;\s*$/i, '0025 reloads PostgREST schema cache and commits');
console.log(`PASS — ${files.length} ordered migrations have balanced comments, strings, dollar bodies and parentheses.`);
console.log('PASS — migration 0024 transaction, trusted trigger functions, profile grants and race-safe mission claim contracts verified.');
console.log('PASS — migration 0025 appearance preference contract and schema-cache refresh verified.');
