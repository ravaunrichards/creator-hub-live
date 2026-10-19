CREATOR HUB LIVE — LIVE MEDIA MODE FIXES (MANUAL INSTALL)
Date: 2026-10-18

CONTENTS
This package contains five complete source files at their original repository paths. It is a focused source update, not a full project backup and not a deployment.

CHANGES
- Video LIVE start verification requires camera + microphone.
- Audio-only LIVE start verification requires microphone only.
- Screen-Sharing LIVE start verification requires an actual screen-share video publication.
- LiveKit token grants are mode-specific: video [camera, microphone], audio [microphone], screen [screen-share video, screen-share audio] for the host; screen-mode non-hosts cannot publish.
- Browser media controls reject camera operations outside Video LIVE, microphone operations in Screen-Sharing LIVE, and screen sharing in Audio-only LIVE.
- Room page passes its selected media mode into the LiveKit client and filters incompatible remote tracks.
- Contract checks cover the mode-specific grants and start requirements.

MANUAL INSTALLATION
1. Make a backup of the five existing files listed below before replacing anything.
2. Open the ZIP and copy each file into the matching path in your existing Creator Hub Live repository. Preserve all other files.
3. Run `node backend/tests/livekit-contract.js` from the repository root.
4. Run syntax checks: `node --check backend/src/livekit-token.js`, `node --check backend/src/livekit-verification.js`, `node --check frontend/src/livekit.js`, `node --check frontend/src/pages-room.js`, and `node --check backend/tests/livekit-contract.js`.
5. Before deploying, test each mode on real devices/browser sessions and confirm LiveKit permissions and screen-share behavior. Do not deploy until your own full project test suite passes.

FILES TO REPLACE (ONLY THESE FIVE)
- backend/src/livekit-token.js
- backend/src/livekit-verification.js
- backend/tests/livekit-contract.js
- frontend/src/livekit.js
- frontend/src/pages-room.js

VALIDATION STATUS
The included LiveKit contract test passed and all five changed JavaScript files passed `node --check`. The backend's full test suite and real LiveKit/device integration were not run here (project dependencies were not installed and no live media session was available). This package has not been deployed or applied to GitHub, Supabase, or Render.
