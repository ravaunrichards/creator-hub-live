# Creator Hub Live — coordinated video/photo + mobile black-video repair

This is an edited-files-only patch for the existing Creator Hub Live project. It is not a replacement repository and it does not deploy or connect to GitHub, Supabase, or Render.

## What is included

- Correct video source selection on profile posts; the cover image is only the poster.
- For You video framing uses `object-fit: contain` and native playback controls.
- Owner-only post delete controls on profile posts and For You cards, scoped to the signed-in author.
- Published video counts on own/public profile headers.
- Profile-photo and cover-photo crop/zoom/reposition upload controls.
- Mobile playback diagnostics for inline video: explicit inline attributes, media state tracking, detection of missing decoded video frames, and a visible explanation on errors.
- The same feed/style changes are included for the website and Android WebView asset copy.

## Root-cause limitation

Audio playing while the picture remains black on phones can indicate a mobile decoder/codec problem, but code alone cannot prove the codec of the affected upload. This patch makes the browser's state visible and improves inline playback behavior; it does **not** transcode uploaded media. If the video element reports zero video dimensions or the device cannot decode the video track, the actual long-term fix is to serve a compatible rendition (commonly MP4 with H.264/AVC video and AAC audio) from a verified media-processing pipeline. Preserve the original uploads during diagnosis.

## Safe installation

1. Back up the current repository and inspect this patch before copying files.
2. Merge the files in this archive into the exact matching repository paths. Do not replace the project root with this patch.
3. Review `database/migrations/0039_creator_media_crop_uploads.sql`. Apply it only to the intended database after review; it creates/uses the `creator-media` bucket for profile crop uploads. This ZIP has not applied the migration to any database.
4. Run `npm run check` and `node tests/black-video-playback-contract.mjs` from the project root.
5. Test the same affected post on desktop and a physical phone. Also test a known MP4 encoded with H.264/AVC video and AAC audio. Confirm profile playback, full-frame rendering, crop controls, video counts, and owner-only delete behavior.
6. Do not deploy until the device test confirms the picture is visible and your usual release checks pass.

## Validation boundary

Automated source-level checks can confirm code contracts, not actual media decoding, Storage permissions, or device rendering. No live website, database, repository, or deployment was modified by preparing this patch.
