# Creator Hub Live — Video & Photo Repair (edited files only)

This is a coordinated patch for the existing Creator Hub Live source. It does not contain a full replacement repository and does not deploy anything.

## Included repairs

- Profile video playback uses the actual media URL; a cover image is used only as the video poster.
- For You videos preserve their full frame with `object-fit: contain` and expose native playback controls.
- Post owners receive a Delete control on profile posts and their For You cards. Deletes are scoped to the signed-in owner and rely on the existing posts RLS policy.
- Own and public profile headers display a Videos count calculated from published post records.
- Profile settings include crop/zoom/reposition controls for avatar and cover images and upload the rendered crop to Supabase Storage.
- Website and Android WebView assets are synchronized; cache versions are advanced.

## Installation

1. Back up the current source and extract this ZIP to a review folder.
2. Copy the included files into the matching paths in your existing repository. Do not replace the whole repository with this patch.
3. Review `database/migrations/0039_creator_media_crop_uploads.sql`, then apply it to the intended Supabase database before testing the new crop upload controls. It creates the public-readable `creator-media` bucket and restricts writes/updates/deletes to the authenticated owner folder. The migration has **not** been applied to any database by this patch.
4. Run `npm run check` from the repository root.
5. Test with a staging account: open a video from your profile, play/pause it, confirm the whole video frame appears on For You, delete an owned test post, verify the profile video count before/after publishing/deleting, and upload/crop/zoom an avatar and cover photo.
6. Test on Android WebView and desktop browser before manually installing/deploying. Do not deploy directly from this ZIP without your normal review and release process.

## Validation boundary

The source-level checks passed when this patch was prepared. They do not prove that the migration has been applied, that the target Supabase project's Storage permissions are configured, or that real video URLs and media permissions work on a physical device. No GitHub, Supabase, Render, or live deployment was modified.
