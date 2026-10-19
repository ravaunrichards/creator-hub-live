# CHL platform-pattern reference

The listed social and live platforms are used as inspiration for product patterns, not as sources to copy proprietary UI, logos, trademarks, or undocumented implementation details.

| Pattern family | CHL implementation questions | Required safeguards |
|---|---|---|
| Short-form feeds and creator discovery | Can users find currently active creators and return to the feed without losing context? | ended streams must not be represented as live; pagination and loading states are explicit |
| Social profiles and communities | Are follow, block, privacy, comments, reposts and profile visibility consistent? | server-side authorization and RLS; no trusting client-supplied identity |
| Messaging and group conversations | Are delivery/read states, attachments, replies, notification settings and block rules understandable? | participant authorization, retention policy, rate limits, safe uploads |
| Live broadcasting | Are host, guest, moderator and viewer roles clear? Can users recover after network loss? | server-authorized tokens, explicit media permissions, reconnection states, abuse/report controls |
| Live interaction | Are polls, Q&A, reactions, chat and guest requests usable without overwhelming the stage? | persisted events only, validation/rate limits, accessible labels and keyboard/touch access |
| Gifts and creator monetization | Is every gift price visible, consistent and confirmed before sending? | server/database-authoritative prices and balances, idempotency, immutable ledger, no fake success |
| Professional/community groups | Can teams, roles, schedules and moderation be managed efficiently on large screens? | least privilege, audit history, responsive list/detail views |
| Cross-device continuity | Can a session survive rotate, background/resume and changing screen size? | safe-area handling, state restoration, reconnect handling and device matrix |

## Integration rule

Adopt proven interaction principles only when they fit CHL's existing schema and route architecture. Do not create duplicate accounts, parallel wallets, fake viewers, synthetic balances, or a second social graph just to resemble another platform. Any third-party integration requires an explicit provider decision, documented permissions, and legal/security review.
