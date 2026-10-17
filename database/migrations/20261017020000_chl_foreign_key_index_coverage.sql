-- Creator Hub Live: add covering indexes for confirmed unindexed foreign keys.
-- Generated from the read-only Supabase Performance Advisor audit on 2026-10-17.
-- Additive only: no rows, balances, grants, policies, or existing indexes are removed.
-- Review table size/lock impact and run during a low-traffic window before production rollout.

CREATE INDEX IF NOT EXISTS chl_fk_audit_log_actor_id_593b51
  ON public.audit_log (actor_id);

CREATE INDEX IF NOT EXISTS chl_fk_blocks_blocked_id_3c445f
  ON public.blocks (blocked_id);

CREATE INDEX IF NOT EXISTS chl_fk_comments_author_id_e99827
  ON public.comments (author_id);

CREATE INDEX IF NOT EXISTS chl_fk_comments_parent_id_3a86d1
  ON public.comments (parent_id);

CREATE INDEX IF NOT EXISTS chl_fk_conversation_members_user_id_4dd131
  ON public.conversation_members (user_id);

CREATE INDEX IF NOT EXISTS chl_fk_creator_achievement_unlo_achievement_code_a173c2
  ON public.creator_achievement_unlocks (achievement_code);

CREATE INDEX IF NOT EXISTS chl_fk_creator_achievement_unlo_source_gift_transactio_6cf6c3
  ON public.creator_achievement_unlocks (source_gift_transaction_id);

CREATE INDEX IF NOT EXISTS chl_fk_creator_mission_claims_reviewed_by_34ef26
  ON public.creator_mission_claims (reviewed_by);

CREATE INDEX IF NOT EXISTS chl_fk_creator_missions_created_by_e2444e
  ON public.creator_missions (created_by);

CREATE INDEX IF NOT EXISTS chl_fk_creator_verification_req_reviewed_by_fc1178
  ON public.creator_verification_requests (reviewed_by);

CREATE INDEX IF NOT EXISTS chl_fk_diamond_payout_requests_reviewed_by_863619
  ON public.diamond_payout_requests (reviewed_by);

CREATE INDEX IF NOT EXISTS chl_fk_diamond_withdrawals_processed_by_079cc6
  ON public.diamond_withdrawals (processed_by);

CREATE INDEX IF NOT EXISTS chl_fk_gift_transaction_reversa_actor_id_769073
  ON public.gift_transaction_reversals (actor_id);

CREATE INDEX IF NOT EXISTS chl_fk_gift_transactions_gift_id_52e2d5
  ON public.gift_transactions (gift_id);

CREATE INDEX IF NOT EXISTS chl_fk_gift_transactions_recipient_id_6c5d0f
  ON public.gift_transactions (recipient_id);

CREATE INDEX IF NOT EXISTS chl_fk_gift_transactions_sender_id_843fe3
  ON public.gift_transactions (sender_id);

CREATE INDEX IF NOT EXISTS chl_fk_league_events_actor_id_86ad9a
  ON public.league_events (actor_id);

CREATE INDEX IF NOT EXISTS chl_fk_league_events_match_id_c941be
  ON public.league_events (match_id);

CREATE INDEX IF NOT EXISTS chl_fk_league_events_season_id_eedc00
  ON public.league_events (season_id);

CREATE INDEX IF NOT EXISTS chl_fk_league_matches_away_team_id_198a9b
  ON public.league_matches (away_team_id);

CREATE INDEX IF NOT EXISTS chl_fk_league_matches_division_code_5361da
  ON public.league_matches (division_code);

CREATE INDEX IF NOT EXISTS chl_fk_league_matches_home_team_id_b4d12f
  ON public.league_matches (home_team_id);

CREATE INDEX IF NOT EXISTS chl_fk_league_standings_division_code_9fbc5d
  ON public.league_standings (division_code);

CREATE INDEX IF NOT EXISTS chl_fk_league_standings_team_id_ca24bc
  ON public.league_standings (team_id);

CREATE INDEX IF NOT EXISTS chl_fk_likes_user_id_d8222b
  ON public.likes (user_id);

CREATE INDEX IF NOT EXISTS chl_fk_live_chat_messages_sender_id_e280c9
  ON public.live_chat_messages (sender_id);

CREATE INDEX IF NOT EXISTS chl_fk_live_guests_user_id_58462b
  ON public.live_guests (user_id);

CREATE INDEX IF NOT EXISTS chl_fk_live_interaction_events_user_id_98329d
  ON public.live_interaction_events (user_id);

CREATE INDEX IF NOT EXISTS chl_fk_live_room_moderators_granted_by_77ccab
  ON public.live_room_moderators (granted_by);

CREATE INDEX IF NOT EXISTS chl_fk_live_room_moderators_user_id_24459f
  ON public.live_room_moderators (user_id);

CREATE INDEX IF NOT EXISTS chl_fk_live_room_poll_votes_user_id_5835c7
  ON public.live_room_poll_votes (user_id);

CREATE INDEX IF NOT EXISTS chl_fk_live_room_polls_host_id_afd409
  ON public.live_room_polls (host_id);

CREATE INDEX IF NOT EXISTS chl_fk_live_room_questions_user_id_019034
  ON public.live_room_questions (user_id);

CREATE INDEX IF NOT EXISTS chl_fk_live_room_reactions_user_id_47878a
  ON public.live_room_reactions (user_id);

CREATE INDEX IF NOT EXISTS chl_fk_live_room_recordings_host_id_7a98f3
  ON public.live_room_recordings (host_id);

CREATE INDEX IF NOT EXISTS chl_fk_live_sessions_host_id_f8130c
  ON public.live_sessions (host_id);

CREATE INDEX IF NOT EXISTS chl_fk_live_viewer_presence_user_id_b75894
  ON public.live_viewer_presence (user_id);

CREATE INDEX IF NOT EXISTS chl_fk_match_participants_user_id_599e0f
  ON public.match_participants (user_id);

CREATE INDEX IF NOT EXISTS chl_fk_matches_live_id_505a46
  ON public.matches (live_id);

CREATE INDEX IF NOT EXISTS chl_fk_messages_reply_to_abb06d
  ON public.messages (reply_to);

CREATE INDEX IF NOT EXISTS chl_fk_messages_sender_id_b1afd0
  ON public.messages (sender_id);

CREATE INDEX IF NOT EXISTS chl_fk_mutes_muted_id_0064bd
  ON public.mutes (muted_id);

CREATE INDEX IF NOT EXISTS chl_fk_notifications_actor_id_6f518b
  ON public.notifications (actor_id);

CREATE INDEX IF NOT EXISTS chl_fk_payments_package_id_d85569
  ON public.payments (package_id);

CREATE INDEX IF NOT EXISTS chl_fk_referrals_referred_id_5a5131
  ON public.referrals (referred_id);

CREATE INDEX IF NOT EXISTS chl_fk_referrals_referrer_id_ed2003
  ON public.referrals (referrer_id);

CREATE INDEX IF NOT EXISTS chl_fk_reports_reporter_id_d82c02
  ON public.reports (reporter_id);

CREATE INDEX IF NOT EXISTS chl_fk_reposts_user_id_e31466
  ON public.reposts (user_id);

CREATE INDEX IF NOT EXISTS chl_fk_saves_user_id_b8bdb4
  ON public.saves (user_id);

CREATE INDEX IF NOT EXISTS chl_fk_sounds_author_id_cf9d32
  ON public.sounds (author_id);

CREATE INDEX IF NOT EXISTS chl_fk_subscription_tiers_creator_id_a2b03b
  ON public.subscription_tiers (creator_id);

CREATE INDEX IF NOT EXISTS chl_fk_subscriptions_subscriber_id_8aea77
  ON public.subscriptions (subscriber_id);

CREATE INDEX IF NOT EXISTS chl_fk_taps_match_id_9fee0d
  ON public.taps (match_id);

CREATE INDEX IF NOT EXISTS chl_fk_taps_target_id_376e36
  ON public.taps (target_id);

CREATE INDEX IF NOT EXISTS chl_fk_teams_owner_id_e3b116
  ON public.teams (owner_id);

