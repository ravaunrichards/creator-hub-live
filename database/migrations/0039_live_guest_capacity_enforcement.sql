-- Creator Hub Live: enforce the selected 0–8 guest-stage capacity atomically.
-- The live database has had two guest-cap triggers pointing to the same function;
-- remove both before installing one canonical trigger. Preserve automatic slot assignment.
-- No rows are rewritten and no live sessions are terminated by this migration.

CREATE OR REPLACE FUNCTION public.enforce_guest_cap()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO pg_catalog, public
AS $$
DECLARE
  session_host uuid;
  settings_live jsonb;
  configured_cap integer := 8;
  active_guests integer := 0;
  free_slot integer;
  layout_enabled boolean := true;
BEGIN
  IF NEW.status = 'accepted' THEN
    -- Lock the room row before counting accepted guests. Concurrent accepts for
    -- the same room serialize so they cannot both claim the final guest slot.
    SELECT host_id
      INTO session_host
      FROM public.live_sessions
     WHERE id = NEW.live_id
     FOR UPDATE;

    IF session_host IS NULL THEN
      RAISE EXCEPTION 'LIVE_ROOM_NOT_FOUND';
    END IF;

    SELECT live
      INTO settings_live
      FROM public.user_settings
     WHERE user_id = session_host;

    IF settings_live ? 'guest_layout_enabled' THEN
      layout_enabled := lower(COALESCE(settings_live ->> 'guest_layout_enabled', 'true')) NOT IN ('false', '0', 'off', 'no');
    END IF;

    IF settings_live ? 'max_guests'
       AND COALESCE(settings_live ->> 'max_guests', '') ~ '^[0-8]$' THEN
      configured_cap := (settings_live ->> 'max_guests')::integer;
    END IF;

    IF NOT layout_enabled OR configured_cap = 0 THEN
      RAISE EXCEPTION 'GUEST_STAGE_DISABLED';
    END IF;

    SELECT count(*)
      INTO active_guests
      FROM public.live_guests
     WHERE live_id = NEW.live_id
       AND status = 'accepted'
       AND id IS DISTINCT FROM NEW.id;

    IF active_guests >= configured_cap THEN
      RAISE EXCEPTION 'GUEST_CAP_REACHED';
    END IF;

    -- Reuse a valid free slot; otherwise allocate the first free slot inside
    -- the selected capacity. Never leave an accepted guest in an out-of-range slot.
    IF NEW.slot IS NULL
       OR NEW.slot < 1
       OR NEW.slot > configured_cap
       OR EXISTS (
         SELECT 1
           FROM public.live_guests g
          WHERE g.live_id = NEW.live_id
            AND g.status = 'accepted'
            AND g.slot = NEW.slot
            AND g.id IS DISTINCT FROM NEW.id
       ) THEN
      SELECT min(slot_number)
        INTO free_slot
        FROM generate_series(1, configured_cap) AS slots(slot_number)
       WHERE NOT EXISTS (
         SELECT 1
           FROM public.live_guests g
          WHERE g.live_id = NEW.live_id
            AND g.status = 'accepted'
            AND g.slot = slots.slot_number
            AND g.id IS DISTINCT FROM NEW.id
       );

      IF free_slot IS NULL THEN
        RAISE EXCEPTION 'GUEST_CAP_REACHED';
      END IF;
      NEW.slot := free_slot;
    END IF;
  ELSE
    NEW.slot := NULL;
  END IF;

  RETURN NEW;
END;
$$;

-- The live database contained both of these names; leaving either would run the
-- function twice and could reassign slots unexpectedly.
DROP TRIGGER IF EXISTS live_guest_cap_enforce ON public.live_guests;
DROP TRIGGER IF EXISTS trg_guest_cap ON public.live_guests;

CREATE TRIGGER trg_guest_cap
  BEFORE INSERT OR UPDATE OF status, slot, live_id
  ON public.live_guests
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_guest_cap();
