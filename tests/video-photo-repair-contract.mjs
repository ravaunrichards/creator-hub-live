import fs from 'node:fs';
import assert from 'node:assert/strict';
const read = (p) => fs.readFileSync(p, 'utf8');
// Live public profile is rendered by pages-profile.js (pages-creator.js is a
// dead/legacy module no longer wired into the router). Repointed per the
// duplicate-/profile-route reconciliation (P3); assertion intent is preserved.
const profile = read('frontend/src/pages-profile.js');
const ownProfile = read('frontend/src/pages-wallet.js');
const feed = read('frontend/src/swipe-feed.js');
const settings = read('frontend/src/pages-settings.js');
const css = read('frontend/styles/platform-responsive.css');
const migration = read('database/migrations/0039_creator_media_crop_uploads.sql');
assert(profile.includes('isVideoPost(post) && media && media.url') && profile.includes("el('video', { src: media.url"), 'Profile video player must use the actual video URL, not its poster/cover URL.');
assert(profile.includes("'Delete'") && profile.includes(".delete().eq('id', post.id).eq('author_id', CHL.user.id)"), 'Post owner must have an owner-scoped delete control on profile posts.');
assert(feed.includes("text: 'Delete'"), 'Post owner must have a delete control in the For You feed.');
assert(feed.includes(".eq('author_id', CHL.user.id).select('id').maybeSingle()"), 'Feed deletion must scope to the signed-in owner and verify the deleted row.');
assert(css.includes('.chl-feed-media.chl-feed-video { object-fit: contain;'), 'For You videos must fit the full frame without forced cropping.');
assert(ownProfile.includes("el('span',{text:'Videos'})") && profile.includes("stat(0, 'Videos'") && profile.includes('refreshVideosCount'), 'Own and public profiles must show video counts.');
assert(settings.includes('function makeCropEditor') && settings.includes("storage.from('creator-media').upload"), 'Profile settings must include a crop/zoom/upload flow.');
assert(migration.includes("values ('creator-media', 'creator-media', true") && migration.includes("storage.foldername(name))[1] = auth.uid()::text"), 'Media bucket must be public-readable and owner-write restricted.');
console.log('Video/photo repair contract: passed');
