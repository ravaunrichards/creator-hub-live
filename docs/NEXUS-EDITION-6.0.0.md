# Creator Hub Creator Network — Nexus Edition 6.0.0

## Direction
Nexus is a distinct, futuristic creator command centre—not a copy of the previous layout. It uses a spatial network-core hero, high-contrast dark surfaces, cyan/violet signal colors, responsive launchpad actions, and a live network feed. The existing route modules and backend integrations remain the functional foundation.

## Honest data policy
The interface does not generate creator identities, LIVE rooms, audience totals, wallet balances, gifts, or analytics. LIVE cards are loaded from the existing API; empty and error states remain visible when the service has no data or is unavailable.

## Included
- Futuristic home experience and new responsive visual system.
- Existing route shell and route modules retained.
- Existing account, search, LIVE, wallet, community, teams/leagues and settings routes retained.
- Main website and iPhone entry load the same Nexus styles/runtime.
- Android web assets synchronized from the website source.
- Service worker cache namespace bumped so old visual assets are not reused.
- Reduced-motion, keyboard focus, and small-screen layout support.

## Build and verify
Run `npm run check`, then `npm run studio:sync-android` (script name retained for compatibility), then run `npm run check` again. Deploy only after reviewing `frontend/config.js`, environment configuration, Supabase schema/API, LiveKit, and PayPal settings for the target environment.

## Release limitations
This source package is not itself a live deployment. Real end-to-end service checks require the deployment's credentials and data. No new APK is claimed by this release; build/sign the Android wrapper using your own secure release keystore and verify it on the target device before distribution.
