import fs from 'node:fs';
import assert from 'node:assert/strict';
const read = (p) => fs.readFileSync(p, 'utf8');
for (const p of ['frontend/src/pages-extra.js','android/app/src/main/assets/web/src/pages-extra.js']) {
  const s = read(p);
  assert(s.includes("text:'Delete comment'"), `${p}: missing delete-comment control`);
  assert(s.includes(".delete().eq('id',c.id)"), `${p}: delete action missing`);
  assert(s.includes('String(post.author_id)===String(CHL.user.id)'), `${p}: post owner cannot remove comments on their own post`);
  assert(s.includes("commentStat.textContent=CHL.fmt(post.comment_count)+' comments'"), `${p}: comment count does not update after mutations`);
}
for (const p of ['frontend/src/pages-creator.js','android/app/src/main/assets/web/src/pages-creator.js']) {
  const s = read(p);
  assert(s.includes("CHL.authenticatedApiRequest('/api/social/follows'"), `${p}: follow/unfollow API missing`);
  assert(s.includes("CHL.authenticatedApiRequest('/api/messages/conversations'"), `${p}: profile message action missing`);
  assert(s.includes('Unblock this account before following or messaging it.'), `${p}: blocked-state explanation missing`);
  assert(!s.includes('disabled:blockedByMe||blockedMe'), `${p}: follow control still uses a disabled no-entry state`);
}
console.log('Social actions repair contract: passed');

const migration = read('database/migrations/0038_comments_author_and_post_owner_delete.sql');
assert(migration.includes('author_id = auth.uid()') && migration.includes('p.author_id = auth.uid()'), 'RLS must allow the comment author and post owner only');
console.log('Comment delete RLS contract: passed');
