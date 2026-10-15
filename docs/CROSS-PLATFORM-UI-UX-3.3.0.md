# Creator Hub Live — Cross-platform UI/UX and Swipe Feed (3.3.0)

## Included

- Shared responsive visual foundation in `frontend/styles/platform-responsive.css`.
- Persisted dark, light, and aurora appearance choices in `frontend/src/style-system.js`.
- Full-height swipe feed controller in `frontend/src/swipe-feed.js`, connected to the existing `/for-you` and `/following` routes.
- Vertical scroll snapping and touch handling; keyboard navigation; active-video playback control; muted-by-default media; lazy media loading; cursor pagination and item deduplication.
- Real database-backed post reads, accepted follow relationships, likes, comments, saves, follow/unfollow, and native share/clipboard fallback. The feed does not fabricate posts or claim gift transactions succeeded.
- Compact mobile navigation, safe-area and thumb target rules, tablet/desktop sizing, and reduced-motion support.
- Updated service-worker cache shell and Android WebView asset mirror.
- `tests/ui-ux-contract.mjs` included in the default `npm run check` command.

## Existing schema and behavior

The feed uses existing `posts`, `profiles`, `follows`, `likes`, `comments`, and `saves` records. Post visibility continues to be constrained by audience filters and database row-level security. The `For You` feed reads public posts; `Following` uses accepted follow relationships and public/follower audience posts. Likes, comments, saves and follows are submitted to the existing Supabase schema. Gift sending remains in the existing LIVE-room flow and its server-authoritative API; the feed does not implement a pretend gift action.

## Manual verification still required

Before production rollout, test on a real Android handset, a mobile browser, tablet-width viewport, and desktop browser using the production environment. Verify signed-in and signed-out behavior, RLS policies, video playback/autoplay behavior on the device, actual media URLs, comment insertion, like counts, follow privacy rules, offline handling, and service-worker update behavior. Static contract checks do not prove that external services or production policies are healthy.

## Release note

This package was assembled from the available full Creator Hub Live restored-assets source archive and extends that local source. It is not a verified export of the latest GitHub `main` tree. Do not treat it as a drop-in replacement for a newer checkout without reconciling it with that checkout first.
