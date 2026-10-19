-- Serialize saved capacity/layout changes with accepted guest changes. The guest
-- acceptance trigger locks live_sessions rows before reading user_settings; this
-- trigger follows the same room-lock order before checking accepted guests.
-- Merge updates so older settings forms do not erase newer guest-layout keys.
CREATE OR REPLACE FUNCTION public.chcn_guard_live_guest_capacity_settings()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO pg_catalog, public
AS $$
DECLARE
  v_enabled boolean := true;
  v_max_guests integer := 8;
  v_room record;
  v_accepted_count integer := 0;
BEGIN
  IF TG_OP = 'UPDATE' THEN
    NEW.live := COALESCE(OLD.live, '{}'::jsonb) || COALESCE(NEW.live, '{}'::jsonb);
  END IF;
  IF NEW.live IS NULL OR jsonb_typeof(NEW.live) <> 'object' THEN
    RETURN NEW;
  END IF;
  IF NEW.live ? 'guest_layout_enabled' THEN
    v_enabled := lower(COALESCE(NEW.live ->> 'guest_layout_enabled', 'true')) NOT IN ('false', '0', 'off', 'no');
  END IF;
  IF NEW.live ? 'max_guests' AND COALESCE(NEW.live ->> 'max_guests', '') ~ '^[0-8]$' THEN
    v_max_guests := (NEW.live ->> 'max_guests')::integer;
  END IF;

  -- The room row is the serialization point used by public.enforce_guest_cap().
  FOR v_room IN
    SELECT s.id
      FROM public.live_sessions s
     WHERE s.host_id = NEW.user_id AND s.status = 'live' AND s.ended_at IS NULL
     ORDER BY s.id
     FOR UPDATE
  LOOP
    SELECT count(*)::integer INTO v_accepted_count
      FROM public.live_guests g
     WHERE g.live_id = v_room.id AND g.status = 'accepted';
    IF v_accepted_count > 0 AND
       (NOT v_enabled OR v_max_guests = 0 OR v_accepted_count > v_max_guests) THEN
      RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'GUESTS_STILL_CONNECTED';
    END IF;
    IF EXISTS (
      SELECT 1 FROM public.live_guests g
       WHERE g.live_id = v_room.id AND g.status = 'accepted'
         AND (g.slot IS NULL OR g.slot < 1 OR g.slot > v_max_guests)
    ) THEN
      RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'GUESTS_STILL_CONNECTED';
    END IF;
  END LOOP;
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.chcn_guard_live_guest_capacity_settings()
  FROM PUBLIC, anon, authenticated;
DROP TRIGGER IF EXISTS chcn_guard_live_guest_capacity_settings ON public.user_settings;
CREATE TRIGGER chcn_guard_live_guest_capacity_settings
  BEFORE INSERT OR UPDATE OF live ON public.user_settings
  FOR EACH ROW EXECUTE FUNCTION public.chcn_guard_live_guest_capacity_settings();
