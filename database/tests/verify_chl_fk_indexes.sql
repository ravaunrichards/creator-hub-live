-- Post-migration verification queries. Read-only; expected result for section 1 is zero rows.

-- A) Expected: zero rows for the 55 foreign-key indexes addressed by the migration.
WITH expected(table_name, column_name) AS (VALUES
  ('audit_log', 'actor_id'),
  ('blocks', 'blocked_id'),
  ('comments', 'author_id'),
  ('comments', 'parent_id'),
  ('conversation_members', 'user_id'),
  ('creator_achievement_unlocks', 'achievement_code'),
  ('creator_achievement_unlocks', 'source_gift_transaction_id'),
  ('creator_mission_claims', 'reviewed_by'),
  ('creator_missions', 'created_by'),
  ('creator_verification_requests', 'reviewed_by'),
  ('diamond_payout_requests', 'reviewed_by'),
  ('diamond_withdrawals', 'processed_by'),
  ('gift_transaction_reversals', 'actor_id'),
  ('gift_transactions', 'gift_id'),
  ('gift_transactions', 'recipient_id'),
  ('gift_transactions', 'sender_id'),
  ('league_events', 'actor_id'),
  ('league_events', 'match_id'),
  ('league_events', 'season_id'),
  ('league_matches', 'away_team_id'),
  ('league_matches', 'division_code'),
  ('league_matches', 'home_team_id'),
  ('league_standings', 'division_code'),
  ('league_standings', 'team_id'),
  ('likes', 'user_id'),
  ('live_chat_messages', 'sender_id'),
  ('live_guests', 'user_id'),
  ('live_interaction_events', 'user_id'),
  ('live_room_moderators', 'granted_by'),
  ('live_room_moderators', 'user_id'),
  ('live_room_poll_votes', 'user_id'),
  ('live_room_polls', 'host_id'),
  ('live_room_questions', 'user_id'),
  ('live_room_reactions', 'user_id'),
  ('live_room_recordings', 'host_id'),
  ('live_sessions', 'host_id'),
  ('live_viewer_presence', 'user_id'),
  ('match_participants', 'user_id'),
  ('matches', 'live_id'),
  ('messages', 'reply_to'),
  ('messages', 'sender_id'),
  ('mutes', 'muted_id'),
  ('notifications', 'actor_id'),
  ('payments', 'package_id'),
  ('referrals', 'referred_id'),
  ('referrals', 'referrer_id'),
  ('reports', 'reporter_id'),
  ('reposts', 'user_id'),
  ('saves', 'user_id'),
  ('sounds', 'author_id'),
  ('subscription_tiers', 'creator_id'),
  ('subscriptions', 'subscriber_id'),
  ('taps', 'match_id'),
  ('taps', 'target_id'),
  ('teams', 'owner_id')
), covered AS (
  SELECT e.table_name, e.column_name,
         EXISTS (
           SELECT 1 FROM pg_index i
           JOIN pg_class t ON t.oid = i.indrelid
           JOIN pg_namespace n ON n.oid = t.relnamespace
           JOIN pg_attribute a ON a.attrelid = t.oid AND a.attname = e.column_name
           WHERE n.nspname = 'public' AND t.relname = e.table_name
             AND i.indisvalid AND i.indisready AND i.indpred IS NULL
             AND EXISTS (SELECT 1 FROM unnest(i.indkey) WITH ORDINALITY AS k(attnum, ord) WHERE k.ord = 1 AND k.attnum = a.attnum)
         ) AS indexed
  FROM expected e
)
SELECT table_name, column_name FROM covered WHERE NOT indexed ORDER BY table_name, column_name;

-- B) RLS tables with no policy are reported for deliberate classification, not auto-opened.
SELECT c.relname AS table_name
FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public' AND c.relkind IN ('r','p') AND c.relrowsecurity
  AND NOT EXISTS (SELECT 1 FROM pg_policy p WHERE p.polrelid = c.oid)
ORDER BY c.relname;
