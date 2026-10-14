# LIVE room repair 4.1.2

This is a targeted repair to the existing Creator Hub Creator Network repository, not a new project.

## Fixes in this package
- Replaces the non-interactive LIVE Gifts heading with one real button that opens and closes the gift gallery.
- Explicitly hides the gift grid while closed despite the existing `display:grid` rule.
- Shows the requested blue-left/red-right Multi-Guest icon on a real button in the LIVE controls. The button opens the existing Guests panel.
- Updates frontend cache-busting references and service-worker cache version so the new UI script is not stuck behind the previous cache.
- Updates the previously installed v4.1.0 upgrade module in place, with a backup, instead of refusing to update its own file.

## Important limits
This repair fixes confirmed frontend wiring/display defects. It does not prove the deployed Go Live flow, camera/microphone permissions, LiveKit publishing, backend configuration, Supabase policies, or guest invitations work in production. Those require the updated files to be installed, tests to run, and the deployed service/device to be checked. Do not claim the live service is fixed until those tests pass. No APK is included.
