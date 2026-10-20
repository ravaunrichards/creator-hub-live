# Creator Hub Live — For You Page black-video diagnostic patch

## What this patch changes
- Adds explicit inline-playback attributes for Android WebView.
- Loads metadata and initial video data sooner for the first two feed items.
- Tracks video loading, decoded frames, playback, and media errors.
- Displays a readable in-feed message when audio exists but the browser reports no video frames, or when playback errors occur.
- Keeps the video picture in `object-fit: contain` mode and includes the same changes in the Android WebView asset copy.

## Important limitation
This patch improves inline playback and exposes the failure state; it cannot transcode an incompatible uploaded file. If the audio plays while `videoWidth` and `videoHeight` remain zero, inspect the original uploaded file's codecs. For broad Android/WebView compatibility, serve MP4 using H.264/AVC video with AAC audio, or generate a compatible rendition server-side. Do not delete or overwrite original media during diagnosis.

## Install safely
1. Back up the current files.
2. Merge the four source/style files at the exact paths in this archive into the existing project.
3. Keep the frontend and Android copies in sync.
4. Run `node --check frontend/src/swipe-feed.js` and `node tests/black-video-playback-contract.mjs`.
5. Test a known H.264/AAC MP4 and the affected upload on a physical Android device and desktop browser before deployment.

No production deployment, GitHub push, Supabase change, media deletion, or video conversion is performed by this patch.
