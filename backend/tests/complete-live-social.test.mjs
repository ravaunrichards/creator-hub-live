import assert from 'node:assert/strict';
import fs from 'node:fs';
const s=fs.readFileSync(new URL('../src/live-room-experience.js',import.meta.url),'utf8');
for(const token of ['guest-requests','gift-events','routeGuestRequests','routeGiftEvents','GUEST_REQUEST_NOT_FOUND','GUEST_CAP_REACHED','LIVE_NOT_ACTIVE']) assert.ok(s.includes(token),`missing LIVE route contract ${token}`);
const sql=fs.readFileSync(new URL('../../database/migrations/0029_complete_social_live_gifting.sql',import.meta.url),'utf8');
for(const token of ['live_room_guest_requests','message_hidden_for','conversation_user_settings','chcn_guard_message_edits','grant update(body,unsent,edited_at)']) assert.ok(sql.includes(token),`missing migration contract ${token}`);
console.log('Complete live/social backend static contract checks passed.');
