# Creator Hub LIVE room entertainment update — test package

This source update is a manual-review ZIP. It does not upload to GitHub, change a deployed website, or modify a Supabase project.

## Included behavior

- Local microphone playback is not attached to the page, preventing the previous local self-echo path. `Echo Monitor` is separately OFF by default and, when enabled, creates a local-only audio monitor from a cloned microphone track. It does not publish a second microphone track. Headphones are recommended to avoid acoustic feedback.
- Camera flip cycles the enumerated video inputs using LiveKit's active-device switch, without leaving/rejoining the room. Zoom buttons apply actual track zoom constraints when the current camera exposes hardware zoom; unsupported zoom buttons are disabled.
- Host and accepted guest media render in participant-specific tiles; each tile has local spotlight controls; remote audio has an individual local-volume slider, active speakers receive a highlight, and the host has server-authorized per-guest track mute/video stop and removal controls.
- Reactions, host sound cues, simple Yes/No polls, and 60-second audience challenges are sent as ephemeral LiveKit data messages. These are entertainment signals, not persistent records or authoritative financial scores.
- Successful gift sends still use the existing authenticated wallet API and database catalogue. A successful sender client broadcasts a visual celebration to room participants; the visual event itself never charges coins or changes balances.
- Guest request/accept/reject/remove endpoints use the existing `live_guests` table and LiveKit server permissions. Accepted guests can leave the stage while remaining connected as viewers. The UI caps the stage at one host plus eight guests.

## Required database migration

Apply `database/migrations/0013_live_guest_requests_and_stage_controls.sql` in Supabase after reviewing the target database's current schema. It adds the `requested` status and timestamps/index used by the guest request queue. Do not apply this migration blindly to a database whose migration history differs from this archive.

## Validation and limits

Run at project root:

```sh
npm run check
npm run backend:test
npm run repair:contracts
```

Then sync the Android embedded web source with `npm run sync:android-web` (already done in the packaged ZIP). Camera switching, zoom, local echo monitoring, real guest publishing permissions, and remote audio still require a real device/two-account staging test with valid Supabase and LiveKit credentials. Browser camera zoom is hardware/browser-dependent. Data-channel polls and reactions are temporary; they are not durable or tamper-proof. No battle ranking, supporter leaderboard, or gift-based score is claimed as authoritative in this package.
