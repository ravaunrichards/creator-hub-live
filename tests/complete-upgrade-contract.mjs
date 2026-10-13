import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
const root=process.cwd();
const must=(p,s)=>{const t=fs.readFileSync(path.join(root,p),'utf8');assert.ok(t.includes(s),`${p} missing contract: ${s}`);return t;};
const gifts=JSON.parse(fs.readFileSync(path.join(root,'docs/approved-gift-catalogue.json'),'utf8'));
assert.equal(gifts.length,90,'approved gift catalogue must have 90 unique entries');
assert.equal(new Set(gifts.map(x=>x.name)).size,90,'gift names must be unique');
assert.equal(new Set(gifts.map(x=>x.assetKey)).size,90,'gift asset keys must be unique');
for(const g of gifts){assert.ok(fs.existsSync(path.join(root,'frontend/assets/gifts/art',g.assetKey+'.svg')),`art missing: ${g.name}`);assert.ok(fs.existsSync(path.join(root,'frontend/assets/gifts/animations',g.assetKey+'.svg')),`animation missing: ${g.name}`);assert.ok(fs.existsSync(path.join(root,'frontend/assets/gifts/sounds',g.assetKey+'.wav')),`sound missing: ${g.name}`);}
const live=must('backend/src/live-room-experience.js','guest-requests');must('backend/src/live-room-experience.js','gift-events');must('backend/src/live-room-experience.js','live_room_guest_requests');
const server=must('backend/src/server.js','assetKey');assert.ok(server.includes('soundUrl'),'gift API must return sound URLs');
const room=must('frontend/src/pages-room.js','data-gift-category');assert.ok(room.includes('CHCNLiveEffects'),'sender gift effect hook missing');
const community=must('frontend/src/pages-extra.js','Share');assert.ok(community.includes('message_hidden_for'),'message hide-for-me contract missing');
const migration=must('database/migrations/0029_complete_social_live_gifting.sql','chcn_guard_message_edits');assert.ok(migration.includes('expected exactly one existing row for all 90 approved gifts'));assert.ok(migration.includes('grant update(body,unsent,edited_at)'));
const index=must('frontend/index.html','pages-project-upgrade.js?v=4.1.2');must('frontend/styles/app.css','.chcn-more-panel');must('frontend/styles/app.css','.ch-live .gift-grid[hidden]');must('frontend/sw.js','chcn-web-v4-1-2');const upgrade=must('frontend/src/pages-project-upgrade.js','chcn-multiguest-button');assert.ok(upgrade.includes("text:'🎁 Gifts'"),'gift gallery must have an actual button');assert.ok(upgrade.includes("src:'/assets/gifts/multi-guest.svg'"),'Multi-Guest button must display the requested custom icon');
console.log('Complete upgrade static contracts passed: 90 distinct gift illustrations, animation SVGs and WAV chimes; API/UI hooks and additive migration present. This is not a live-service end-to-end test.');
