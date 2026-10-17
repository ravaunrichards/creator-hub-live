-- Prevent preference edits outside the live-room API (including Settings -> LIVE)
-- from putting an active room above its configured capacity or disabling its stage
-- while accepted guests are still connected.
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
BEGIN
  IF NEW.live IS NULL OR jsonb_typeof(NEW.live) <> 'object' THEN
    RETURN NEW;
  END IF;
  IF NEW.live ? 'guest_layout_enabled' THEN
    v_enabled := lower(COALESCE(NEW.live ->> 'guest_layout_enabled', 'true')) NOT IN ('false', '0', 'off', 'no');
  END IF;
  IF NEW.live ? 'max_guests' AND COALESCE(NEW.live ->> 'max_guests', '') ~ '^[0-8]$' THEN
    v_max_guests := (NEW.live ->> 'max_guests')::integer;
  END IF;

  FOR v_room IN
    SELECT s.id, count(g.id)::integer AS accepted_count
      FROM public.live_sessions s
      JOIN public.live_guests g ON g.live_id = s.id AND g.status = 'accepted'
     WHERE s.host_id = NEW.user_id AND s.status = 'live' AND s.ended_at IS NULL
     GROUP BY s.id
  LOOP
    IF v_room.accepted_count > 0 AND
       (NOT v_enabled OR v_max_guests = 0 OR v_room.accepted_count > v_max_guests) THEN
      RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'GUESTS_STILL_CONNECTED';
    END IF;
  END LOOP;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.chcn_guard_live_guest_capacity_settings() FROM PUBLIC, anon, authenticated;
DROP TRIGGER IF EXISTS chcn_guard_live_guest_capacity_settings ON public.user_settings;
CREATE TRIGGER chcn_guard_live_guest_capacity_settings
  BEFORE INSERT OR UPDATE OF live ON public.user_settings
  FOR EACH ROW EXECUTE FUNCTION public.chcn_guard_live_guest_capacity_settings();
