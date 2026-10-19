# Creator Hub Live — restored full source package

This ZIP contains the original CHL source tree plus restored gift artwork, animations, sounds, Android WebView copies, accessible database-priced gift buttons, and a restoration report.

## Before installing
1. Keep a backup of the current `main` repository.
2. Compare this source with the latest repository before replacing files; this package started from the available older CHL archive.
3. Keep production secrets and the Android release keystore out of GitHub. Set server secrets only in private deployment settings.
4. Copy the restored `frontend/` and `android/` source folders only after reviewing the report.

## Tests
Run `npm run check` and `npm run backend:test` from the project root when dependencies are installed. The source archive does not include `node_modules`. Build/sign the Android APK separately using your private signing key.
