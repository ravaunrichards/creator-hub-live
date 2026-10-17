import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const read = (file) => fs.readFileSync(path.join(ROOT, file), 'utf8');
const migration45 = read('database/migrations/0045_secure_live_guest_layout_updates.sql').toLowerCase();
const migration46 = read('database/migrations/0046_guard_live_guest_capacity_settings.sql').toLowerCase();
const migration47 = read('database/migrations/0047_atomic_live_guest_capacity_preferences.sql').toLowerCase();
const contract = [];
function check(name, fn) { fn(); contract.push(name); }

check('internal guest-layout RPC is server-role-only', () => {
  assert.ok(migration45.includes('create or replace function public.chcn_update_live_guest_layout'));
  assert.ok(migration45.includes('revoke all on function public.chcn_update_live_guest_layout'));
  assert.ok(migration45.includes('from public, anon, authenticated'));
  assert.ok(migration45.includes('to service_role'));
});
check('saved capacity guard trigger is attached to user_settings', () => {
  assert.ok(migration46.includes('create or replace function public.chcn_guard_live_guest_capacity_settings'));
  assert.ok(migration46.includes('before insert or update of live on public.user_settings'));
  assert.ok(migration46.includes('guests_still_connected'));
});
check('race-hardening function uses a controlled security-definer search path', () => {
  assert.ok(migration47.includes('security definer'));
  assert.ok(migration47.includes('set search_path to pg_catalog, public'));
  assert.ok(migration47.includes('revoke all on function public.chcn_guard_live_guest_capacity_settings()'));
});
check('partial settings saves preserve existing guest-layout keys', () => {
  assert.ok(migration47.includes("coalesce(old.live, '{}'::jsonb) || coalesce(new.live, '{}'::jsonb)"));
});
check('capacity changes lock live-session rows before rechecking accepted guests', () => {
  assert.ok(/order by s\.id\s+for update/i.test(migration47));
  assert.ok(/from public\.live_guests g\s+where g\.live_id = v_room\.id and g\.status = 'accepted'/i.test(migration47));
  assert.ok(migration47.includes('v_accepted_count > v_max_guests'));
});
check('stage cannot be disabled or reduced below connected guest count', () => {
  assert.ok(migration47.includes('not v_enabled or v_max_guests = 0 or v_accepted_count > v_max_guests'));
  assert.ok(migration47.includes('guests_still_connected'));
  assert.ok(migration47.includes('g.slot is null or g.slot < 1 or g.slot > v_max_guests'));
});
check('trigger remains attached after hardening migration', () => {
  assert.ok(migration47.includes('create trigger chcn_guard_live_guest_capacity_settings'));
  assert.ok(migration47.includes('before insert or update of live on public.user_settings'));
});

console.log(`Live guest layout guard contract passed: ${contract.length} checks.`);
for (const item of contract) console.log(`  PASS ${item}`);
