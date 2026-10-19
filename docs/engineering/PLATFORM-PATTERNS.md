# Platform-pattern catalog for CHL

## Purpose and guardrails

The listed social networks, messaging products, creator networks, and livestream services are a source of **product-pattern questions**, not a request to reproduce their brand, interface, private APIs, algorithms, or proprietary implementation. Their capabilities change; before choosing a pattern or integration, confirm current first-party documentation, permissions, regional availability, API terms, moderation obligations, and cost. Listing a platform here does not mean CHL has an integration with it.

No new platform-inspired feature is approved until it has a CHL use case, user story, risk assessment, acceptance criteria, source-of-truth decision, and measurable success/guardrail metrics.

## Pattern families to evaluate

| Family | Platforms supplied as reference | Patterns worth evaluating for CHL | Required CHL design checks |
|---|---|---|---|
| Social identity, profiles and discovery | Facebook, YouTube, Instagram, TikTok, Snapchat, Reddit, X, Pinterest, LinkedIn, Threads, Tumblr, Bluesky, Mastodon, Sina Weibo, VKontakte (VK), Kuaishou, Douyin | Creator identity; follows/subscriptions; searchable discovery; feed relevance; saved content; identity verification where justified | Privacy defaults, block/mute behavior, transparent recommendation signals, pagination, abuse resistance, accessible controls |
| Messaging and lightweight sharing | WhatsApp, WeChat, Telegram, QQ, LINE, KakaoTalk, Snapchat | Conversation membership, delivery/read states, attachments, group controls, notifications, user-controlled privacy | Sender/recipient authorization, block restrictions, media limits, retention/deletion rules, rate limiting, failure/retry behavior |
| Community and creator spaces | Discord, Reddit, Facebook Groups, LinkedIn communities, VK communities | Channels or topic spaces, role-based moderation, membership rules, pinned guidance, community reporting | Explicit roles, least privilege, auditable moderation, no hidden privileges, safe defaults for private spaces |
| Creator livestreaming | Twitch, YouTube Live, TikTok Live, Facebook Live, Instagram Live, Kick, LinkedIn Live, Bigo Live, Trovo Live, YouNow, Tango Live, Vimeo Livestream, Clubhouse, Zoom | Clear room lifecycle, host/guest controls, chat, reactions, polls and Q&A, scheduling, stream quality states, clips/recording where appropriate | Server-authoritative room state; mic/camera permissions; host self-audio behavior; guest consent; reconnect handling; moderation; recording consent/storage; active-only discovery |
| Programming and event discovery | YouTube TV, YouTube Live, Vimeo Livestream, Zoom | Schedules, event cards, reminders, playback/live status, audience segmentation and replay discovery | Accurate timezone, stale-event cleanup, entitlement checks, clear live-vs-replay labels, no false “live” status |

The reference set is intentionally grouped by capability. A product may appear in more than one family; Twitch was listed twice in the request and is counted once here.

## Translation into CHL system requirements

### Identity and social graph

Document stable user IDs separately from handles and display names. Follow, block, mute, privacy, and subscription semantics must be distinct and consistently enforced in feed, search, comments, messaging, notifications, and LIVE invitations. A renamed handle must not break foreign-key relationships.

### Feeds and discovery

Separate eligibility from ranking: a candidate item must first be permitted (for example, not ended, blocked, private, or removed), then may be ranked. Record the reasons an item was excluded when useful for debugging without leaking private content. Do not use client-rendered placeholders as evidence that a creator is active.

### LIVE and real-time experiences

Model room lifecycle and participant authorization explicitly. Disconnects, reconnects, stale presence, host end, guest removal, moderation action, and failed media connection need separate states and recovery paths. Do not keep ended rooms discoverable. Store event timestamps in a consistent timezone (UTC internally; render user-facing times in the user's chosen/local context).

### Creator monetization

Keep entitlement, prices, wallet entries, gift transactions, reversals, and payout status auditable and server-authoritative. Use idempotency for retries. Do not infer successful payment from a browser redirect. Never build a gifter rank, coin balance, gift count, or payout from mock values.

### Moderation, safety and trust

Provide reporting, blocks/mutes, room moderation, transparent restrictions, safe rate limits, audit trails for privileged actions, and appeal/review paths where appropriate. Moderation cannot depend only on hiding UI controls; APIs and database policies must enforce authorization.

## Platform evaluation record

When evaluating a platform-inspired idea, capture:

1. User problem and CHL outcome.
2. Reference pattern and current first-party source checked/date.
3. Whether the idea is a native CHL capability, an external integration, or both.
4. Data and authorization changes.
5. Privacy, moderation, accessibility, reliability, monetization, and operational cost impacts.
6. Minimal experiment and guardrail metrics.
7. Build/hold/reject decision, owner, and follow-up date.

Use the feature-request and technical-design templates. Do not create an integration just because a platform is named in this catalog.
