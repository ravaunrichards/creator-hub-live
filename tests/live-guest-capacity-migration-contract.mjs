import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const migration = fs.readFileSync(path.join(ROOT, 'database/migrations/0039_live_guest_capacity_enforcement.sql'), 'utf8');
const server = fs.readFileSync(path.join(ROOT, 'backend/src/server.js'), 'utf8');
const room = fs.readFileSync(path.join(ROOT, 'frontend/src/pages-room.js'), 'utf8');
const ui = fs.readFileSync(path.join(ROOT, 'frontend/src/ui.js'), 'utf8');
const css = fs.readFileSync(path.join(ROOT, 'frontend/styles/app.css'), 'utf8');

function assert(ok, message) { if (!ok) throw new Error(message); }

assert(migration.includes('SECURITY DEFINER') && migration.includes('SET search_path TO pg_catalog, public'), 'Guest-cap trigger function is missing a controlled search path.');
assert(migration.includes('FOR UPDATE'), 'Guest-cap trigger does not serialize concurrent accepts on the room row.');
assert(migration.includes('DROP TRIGGER IF EXISTS live_guest_cap_enforce') && migration.includes('DROP TRIGGER IF EXISTS trg_guest_cap'), 'Migration does not remove both duplicate guest-cap triggers found in the live database.');
assert(migration.includes("IF NEW.status = 'accepted' THEN"), 'Guest-cap trigger does not limit enforcement to active guest rows.');
assert(migration.includes("settings_live ->> 'guest_layout_enabled'"), 'Guest-cap trigger does not honor the saved guest-layout toggle.');
assert(migration.includes("settings_live ->> 'max_guests'") && migration.includes("'^[0-8]$'"), 'Guest-cap trigger does not validate the saved 0–8 guest limit.');
assert(migration.includes('active_guests >= configured_cap'), 'Guest-cap trigger does not enforce the selected guest capacity.');
assert(migration.includes('generate_series(1, configured_cap)') && migration.includes('NEW.slot := free_slot'), 'Guest-cap migration does not preserve automatic slot allocation.');
assert(migration.includes('BEFORE INSERT OR UPDATE OF status, slot, live_id'), 'Guest-cap trigger revalidates unrelated mic/camera/pinned updates.');
assert(server.includes('guestParts.action === "layout"') && server.includes('GUESTS_STILL_CONNECTED'), 'Backend guest-layout endpoint is missing safe disable validation.');
assert(room.includes('removedFromRoom !== true') && room.includes('guestLayoutOrientation'), 'Frontend does not verify removal and preserve guest orientation.');
assert(ui.includes('event.key !== \'Tab\'') && ui.includes('mobileMenuPanel.contains(document.activeElement)'), 'Mobile navigation does not keep keyboard focus inside the open menu.');
assert(ui.includes("document.body.style.overflow = 'hidden'") && ui.includes("document.body.style.overflow = previousBodyOverflow"), 'Mobile navigation does not lock and restore background scrolling.');
assert(ui.includes("window.addEventListener('resize'") && ui.includes("window.addEventListener('orientationchange'"), 'Mobile navigation does not close safely after a device/layout change.');
assert(css.includes('max-height: calc(100vh -') && css.includes('max-height: calc(100dvh -'), 'Navigation menu has no legacy viewport-height fallback.');

console.log('PASS — atomic database guest-cap enforcement contract');
console.log('PASS — selected guest capacity and disabled-stage enforcement');
console.log('PASS — safe guest removal/layout contracts retained');
console.log('PASS — responsive accessible navigation focus, scroll lock, and orientation handling');
