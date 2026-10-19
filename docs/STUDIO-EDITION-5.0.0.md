# Creator Hub Creator Network — Nexus Edition 6.0.0

## Design direction

Nexus Edition is a new visual and navigation system for the existing Creator Hub Creator Network product. It does not replace the backend with a demo and does not seed creators, balances, viewers, rankings, messages or LIVE sessions. Existing route handlers, authentication, Supabase access, the LIVE/LiveKit module, wallet routes, team/league routes, messaging, settings and account controls remain the underlying application.

The experience uses an editorial forest-green / warm-neutral design, a creator-first homepage, clearer navigation groups, real backend-backed LIVE discovery, a searchable global header, a persistent mobile tab bar, and a mobile “More” sheet so secondary routes remain reachable on small devices. The same new CSS/runtime layer is included in the standard site, iPhone entry point and Android embedded web assets.

## Main source additions

- `frontend/styles/nexus-edition.css` — responsive Nexus Edition design system and shared styling overrides.
- `frontend/src/studio-edition.js` — responsive navigation shell, global search handoff and creator-first homepage. Existing route functions are preserved, except the homepage presentation is replaced without adding a duplicate route.
- `frontend/index.iphone.html` — now runs the same app startup and Nexus Edition layer.
- `tests/studio-edition-contract.mjs` — static regression tests for the new layer.

## Install / deploy

1. Back up the deployed website and source repository.
2. Extract this complete ZIP into a separate review directory first; do not overwrite production directly.
3. Inspect `frontend/config.js`. The Supabase publishable/anonymous key is browser-visible by design; never place service-role, PayPal secret, or LiveKit API secret credentials in the frontend.
4. Install backend dependencies in `backend/` using your hosting environment's supported Node version.
5. Run `npm run check` from the project root.
6. Deploy the frontend folder using the existing frontend hosting configuration. Keep the current backend deployment and database schema unless the staging test shows a separate required issue; this design release introduces no database migration.
7. Test sign-in/sign-up, search, profile, posts, messages, notifications, LIVE host/viewer, gift flow, wallet, teams/leagues, creator dashboard and settings on desktop and real mobile devices.
8. For the Android source, `npm run studio:sync-android` synchronizes `frontend/` to `android/app/src/main/assets/web/`. Rebuild the app with the installed Android/Gradle toolchain and an authorized signing key supplied through environment variables or Gradle properties.

## Build and credential safety

A private release keystore is intentionally not included in this ZIP. Existing historical APK files, where present, are not rebuilt Nexus Edition APKs and must not be represented as a new signed build. Release signing credentials must be supplied securely outside the repository.

The backend remains on its existing API compatibility release marker. Nexus Edition `6.0.0` is the website/UX release, not a claim that the external Supabase, LiveKit, PayPal or hosting environment has been upgraded.

## Validation boundary

`npm run check` runs the inherited codebase contracts and the new Nexus Edition contract test. These tests validate source structure, route/link contracts, cache entries and syntax. They do not prove that production API credentials are valid, every database migration is applied, PayPal settles a transaction, LiveKit camera/microphone works on a specific handset, or every route has passed end-to-end QA. Those checks require staging credentials and real devices.
