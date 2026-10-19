# Creator Hub Live — Recovery Package

This is a manual-install source package. It does not modify GitHub, Supabase, Render, or the deployed website.

## Before installing
1. Back up your current project folder.
2. Extract this ZIP to a separate folder and review the diff before copying anything into your working repository.
3. Preserve your existing wallet and LIVE-room files unless you have compared them with this package.

## Restore source files missing from the saved archive
The saved archives did not contain several files referenced by the app shell and backend test scripts. On a computer with Node.js 22+ and internet access, run from the extracted project root:

```sh
node scripts/restore-missing-source-assets.mjs
```

The script retrieves only missing files from the public `ravaunrichards/creator-hub-live` `main` branch, verifies each against a pinned Git blob SHA, and never overwrites an existing file. It does not push changes to GitHub. If a hash differs or network access fails, it stops on that file and reports the failure.

## Verify locally

```sh
npm run check
npm run backend:check
npm run backend:test
```

The frontend/static contract checks passed in the recovery environment. Backend checks could not be completed here because the missing backend source/test files were not available locally and outbound network access was unavailable. Run the restoration step first, then run the backend checks again.

Do not deploy this package until the backend checks pass and you have verified Supabase, LiveKit, PayPal, and Android build/device behaviour in your own environment.
