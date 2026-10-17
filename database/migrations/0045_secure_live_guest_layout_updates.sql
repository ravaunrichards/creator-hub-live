-- Creator Hub Live — keep guest-stage preferences server-authoritative.
-- Locks the room in the same order used by enforce_guest_cap() so a host cannot
-- disable/reduce the stage while accepted guests are still attached, nor race a
-- concurrent guest acceptance into a newly closed stage.
CREATE OR REPLACE FUNCTION public.chcn_update_live_guest_layout(
  p_live_id uuid,
  p_actor_id uuid,
  p_enabled boolean,
  p_max_guests integer,
  p_orientation text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO pg_catalog, public
AS $$
DECLARE
  v_room public.live_sessions%ROWTYPE;
  v_live jsonb := '{}'::jsonb;
  v_enabled boolean := true;
  v_max_guests integer := 8;
  v_orientation text := 'horizontal';
  v_active_guests integer := 0;
BEGIN
  IF p_actor_id IS NULL THEN
    RAISE EXCEPTION USING ERRCODE = '42501', MESSAGE = 'LIVE_HOST_REQUIRED';
  END IF;

  -- Serialize preferences for a creator that may have multiple sessions. The
  -- room-row lock below is also used by enforce_guest_cap() before accepts.
  PERFORM pg_advisory_xact_lock(hashtext(p_actor_id::text));
  SELECT * INTO v_room
    FROM public.live_sessions
   WHERE id = p_live_id
   FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION USING ERRCODE = 'P0002', MESSAGE = 'LIVE_ROOM_NOT_FOUND';
  END IF;
  IF v_room.host_id <> p_actor_id THEN
    RAISE EXCEPTION USING ERRCODE = '42501', MESSAGE = 'LIVE_HOST_REQUIRED';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.profiles p
     WHERE p.id = p_actor_id AND p.account_status = 'active'
  ) THEN
    RAISE EXCEPTION USING ERRCODE = '42501', MESSAGE = 'LIVE_HOST_REQUIRED';
  END IF;

  SELECT COALESCE(us.live, '{}'::jsonb) INTO v_live
    FROM public.user_settings us
   WHERE us.user_id = p_actor_id
   FOR UPDATE;
  v_live := COALESCE(v_live, '{}'::jsonb);

  IF v_live ? 'guest_layout_enabled' THEN
    v_enabled := lower(COALESCE(v_live ->> 'guest_layout_enabled', 'true')) NOT IN ('false', '0', 'off', 'no');
  END IF;
  IF v_live ? 'max_guests' AND COALESCE(v_live ->> 'max_guests', '') ~ '^[0-8]$' THEN
    v_max_guests := (v_live ->> 'max_guests')::integer;
  END IF;
  IF v_live ->> 'guest_layout_orientation' IN ('horizontal', 'vertical') THEN
    v_orientation := v_live ->> 'guest_layout_orientation';
  END IF;

  IF p_enabled IS NOT NULL THEN v_enabled := p_enabled; END IF;
  IF p_max_guests IS NOT NULL THEN v_max_guests := p_max_guests; END IF;
  IF p_orientation IS NOT NULL THEN v_orientation := p_orientation; END IF;

  IF v_max_guests < 0 OR v_max_guests > 8 THEN
    RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'INVALID_GUEST_LAYOUT';
  END IF;
  IF v_orientation NOT IN ('horizontal', 'vertical') THEN
    RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'INVALID_GUEST_LAYOUT';
  END IF;

  SELECT count(*)::integer INTO v_active_guests
    FROM public.live_guests g
   WHERE g.live_id = p_live_id AND g.status = 'accepted';

  IF v_active_guests > 0 AND (NOT v_enabled OR v_max_guests = 0 OR v_active_guests > v_max_guests) THEN
    RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'GUESTS_STILL_CONNECTED';
  END IF;
  IF EXISTS (
    SELECT 1 FROM public.live_guests g
     WHERE g.live_id = p_live_id AND g.status = 'accepted'
       AND (g.slot IS NULL OR g.slot < 1 OR g.slot > v_max_guests)
  ) THEN
    RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'GUESTS_STILL_CONNECTED';
  END IF;

  v_live := jsonb_set(v_live, '{guest_layout_enabled}', to_jsonb(v_enabled), true);
  v_live := jsonb_set(v_live, '{max_guests}', to_jsonb(v_max_guests), true);
  v_live := jsonb_set(v_live, '{guest_layout_orientation}', to_jsonb(v_orientation), true);

  INSERT INTO public.user_settings (user_id, live)
  VALUES (p_actor_id, v_live)
  ON CONFLICT (user_id) DO UPDATE SET live = EXCLUDED.live, updated_at = now();

  RETURN jsonb_build_object(
    'guestLayoutEnabled', v_enabled,
    'maxGuests', v_max_guests,
    'guestLayoutOrientation', v_orientation,
    'acceptedGuests', v_active_guests
  );
END;
$$;

REVOKE ALL ON FUNCTION public.chcn_update_live_guest_layout(uuid, uuid, boolean, integer, text)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.chcn_update_live_guest_layout(uuid, uuid, boolean, integer, text)
  TO service_role;
