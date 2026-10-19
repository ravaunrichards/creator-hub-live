# Creator Hub Live — Appearance Account Sync Fix (Corrected Package)

## Live status

The active Creator Hub Live Supabase project has been updated successfully. The `user_settings_appearance_contract` constraint now accepts any JSON object, which supports the current Style Switcher payload (`mode`, `theme`, `typography`, `surfaces`, `density`, `motion`, and `contrast`). Verification confirmed the constraint is validated and a current Style Switcher-shaped payload satisfies the contract. Existing `user_settings` rows were preserved.

The Creator Hub Live frontend and backend Render services were already reporting their latest deployments as **live** on the same current GitHub commit. The deployed frontend service worker is `chl-web-v3-3-4`. No additional Render deploy was triggered because no new code commit was made.

## What changed

- The database migration drops the restrictive legacy appearance check and replaces it with `CHECK (jsonb_typeof(appearance) = 'object')`.
- It does not set `appearance` to NULL because the live column is `NOT NULL`.
- Web and Android Style Switcher files remain byte-for-byte matched.
- The service-worker version remains `chl-web-v3-3-4`.

## Manual installation / source tracking

1. Preserve unrelated project files.
2. Add the files in this package at their matching paths in your repository.
3. The live Creator Hub Live Supabase project already has migration `0039_appearance_contract_compatibility` applied; **do not run it again there**. For a separate environment that still has the old constraint, back up that database and apply the SQL migration once.
4. The GitHub integration did not grant write permission during this session, so the migration source file could not be committed to GitHub automatically. Upload it manually if you want the SQL source tracked in the repository.
5. The frontend and backend Render services were already live on the latest commit; a new deployment requires a source change/commit.

## Verification

- Live constraint definition: `CHECK (jsonb_typeof(appearance) = 'object')`, validated.
- Style Switcher-shaped JSON payload: passes the compatibility expression.
- Existing settings rows: preserved (one row observed in the live table at verification time).
- Render frontend and backend: latest deploys report `live`.
- GitHub source writes: blocked by integration permission; no claim that a commit was created.

To complete an end-to-end user-level confirmation, sign in to CHL, open **Settings → Appearance**, change a style, choose **Apply & save**, then reload and confirm it persists. The database contract is fixed, but an authenticated browser save could not be performed from this session.
