# Manual install — CHL Gift Catalogue Pricing Update

## What changes

The update corrects the coin price and category of each of the 90 named gifts in the supplied CHL catalogue. The revised Mythical & Ultimate tier is 50,000 to 100,000 coins, with **Creator Hub Ultimate Universe = 100,000 coins**. The live gift list is sorted by price ascending and gift name ascending for ties.

## Safety behavior

The SQL migration checks that each of the 90 official names maps to exactly one existing row before updating. If a name is missing or duplicated, the migration raises an exception and rolls back rather than partially updating the catalogue. Resolve the reported names against the actual database first.

Only `coin_price` and `category` are changed. The migration preserves `diamond_value`, gift IDs, activity status, graphic/animation URLs, and all transaction history. It does not seed fake activity or fabricate image assets.

## Manual installation

1. Back up the current deployed frontend/backend and the Supabase database.
2. Confirm the target project and inspect the current `public.gifts` rows. Do not run this against a different project by mistake.
3. Review and execute `database/migrations/0025_chl_gift_catalogue_pricing.sql` in Supabase SQL Editor.
4. Deploy the source changes. The full replacement files are from the supplied 4.0.0 source archive. If production contains later changes, merge only these lines into the current files:
   - backend `GET /api/gifts`: order by `coin_price ASC`, then `name ASC`.
   - frontend `loadGiftCatalog`: sort active gifts by numeric coin price ascending, then name.
5. Run the backend checks (`cd backend && npm test`) and website checks available in the current project before deploying.
6. Verify `/api/gifts`, the visible LIVE gift panel, low-to-high order, and an actual test send. Check that the sender loses exactly the displayed coin price. Confirm diamond credit still uses the pre-existing `diamond_value`.

## Rollback

Restore the database backup and previous deployed files if validation fails. Do not guess prior coin prices or attempt a reverse update based on this catalogue; the backup is the authoritative rollback source.

## Scope and status

This ZIP is a manual update package only. No live service, GitHub repository, or Supabase database has been changed by preparing it. The SQL and source syntax can be statically checked here, but production behavior must be validated in the user's target environment.
