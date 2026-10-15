const DEFAULT_MINIMUM_AGE_MS = 5 * 60 * 1000;

function toHttpUrl(value) {
  return String(value || '')
    .trim()
    .replace(/^wss:/i, 'https:')
    .replace(/^ws:/i, 'http:');
}

async function createRoomService(url, apiKey, apiSecret) {
  const { RoomServiceClient } = await import('livekit-server-sdk');
  return new RoomServiceClient(url, apiKey, apiSecret);
}

function safeLog(logger, method, ...args) {
  try {
    (logger?.[method] || (() => {})).call(logger, ...args);
  } catch {
    // Logging must never break room reconciliation.
  }
}

/**
 * Reconcile database LIVE sessions against LiveKit without guessing that a
 * temporarily empty room is dead. A session is ended automatically only when:
 * - it is still marked live and has no ended_at timestamp;
 * - it is older than the safety grace period; and
 * - LiveKit confirms the named room no longer exists.
 *
 * LiveKit/network errors are unknown states, not proof that a room is gone.
 * This function never references live_sessions.created_at (that column does
 * not exist in the deployed schema).
 */
export async function closeOrphanedLiveRooms({
  client,
  livekitUrl = process.env.LIVEKIT_URL,
  apiKey = process.env.LIVEKIT_API_KEY,
  apiSecret = process.env.LIVEKIT_API_SECRET,
  now = Date.now(),
  minimumAgeMs = DEFAULT_MINIMUM_AGE_MS,
  logger = console,
  roomService,
} = {}) {
  if (!client || !apiKey || !apiSecret || !toHttpUrl(livekitUrl)) {
    safeLog(logger, 'warn', '[LIVE cleanup] Skipped: database or LiveKit configuration is incomplete.');
    return { scanned: 0, ended: 0, skipped: 'configuration' };
  }

  let query;
  try {
    query = await client
      .from('live_sessions')
      .select('id,room_name,started_at,updated_at,status,ended_at')
      .eq('status', 'live')
      .is('ended_at', null);
  } catch (error) {
    safeLog(logger, 'error', '[LIVE cleanup] Could not query live sessions:', error?.message || error);
    return { scanned: 0, ended: 0, skipped: 'database-query' };
  }

  if (query?.error) {
    safeLog(logger, 'error', '[LIVE cleanup] Could not query live sessions:', query.error.message || query.error);
    return { scanned: 0, ended: 0, skipped: 'database-query' };
  }

  const rows = Array.isArray(query?.data) ? query.data : [];
  if (!rows.length) return { scanned: 0, ended: 0 };

  let service = roomService;
  try {
    if (!service) service = await createRoomService(toHttpUrl(livekitUrl), apiKey, apiSecret);
  } catch (error) {
    safeLog(logger, 'error', '[LIVE cleanup] Could not initialize LiveKit:', error?.message || error);
    return { scanned: rows.length, ended: 0, skipped: 'livekit-client' };
  }

  let ended = 0;
  for (const room of rows) {
    const roomName = String(room?.room_name || '').trim();
    if (!room?.id || !roomName || room.status !== 'live' || room.ended_at) continue;

    const timestamp = room.started_at || room.updated_at;
    const startedMs = timestamp ? Date.parse(timestamp) : NaN;
    if (!Number.isFinite(startedMs) || now - startedMs < minimumAgeMs) continue;

    let listedRooms;
    try {
      listedRooms = await service.listRooms([roomName]);
    } catch (error) {
      safeLog(logger, 'warn', '[LIVE cleanup] LiveKit status unknown; keeping session live:', room.id, error?.message || error);
      continue;
    }

    if (!Array.isArray(listedRooms)) {
      safeLog(logger, 'warn', '[LIVE cleanup] LiveKit returned an unknown room list; keeping session live:', room.id);
      continue;
    }

    const liveRoom = listedRooms.find((item) => String(item?.name || '') === roomName);
    let confirmedSafeToEnd = !liveRoom;
    if (liveRoom) {
      // The room exists. Do not end a session while anyone is still connected.
      // After the grace period, an empty room is safe to close and reconcile.
      const participants = Number(liveRoom.numParticipants);
      if (!Number.isFinite(participants) || participants > 0) continue;
      try {
        await service.deleteRoom(roomName);
        confirmedSafeToEnd = true;
      } catch (error) {
        // A delete error is ambiguous. Confirm the room is absent before ending
        // the database row; if LiveKit cannot answer, leave the row untouched.
        try {
          const afterDelete = await service.listRooms([roomName]);
          confirmedSafeToEnd = Array.isArray(afterDelete) && !afterDelete.some((item) => String(item?.name || '') === roomName);
        } catch {
          confirmedSafeToEnd = false;
        }
        if (!confirmedSafeToEnd) {
          safeLog(logger, 'warn', '[LIVE cleanup] Could not confirm empty room closure; keeping session live:', room.id, error?.message || error);
          continue;
        }
      }
    }
    if (!confirmedSafeToEnd) continue;

    const endedAt = new Date(now).toISOString();
    let update;
    try {
      update = await client
        .from('live_sessions')
        .update({ status: 'ended', ended_at: endedAt, updated_at: endedAt, viewer_count: 0 })
        .eq('id', room.id)
        .eq('status', 'live')
        .is('ended_at', null)
        .select('id')
        .maybeSingle();
    } catch (error) {
      safeLog(logger, 'error', '[LIVE cleanup] Could not mark confirmed orphan ended:', room.id, error?.message || error);
      continue;
    }

    if (update?.error) {
      safeLog(logger, 'error', '[LIVE cleanup] Could not mark confirmed orphan ended:', room.id, update.error.message || update.error);
      continue;
    }

    if (update?.data?.id) {
      ended += 1;
      safeLog(logger, 'info', '[LIVE cleanup] Marked confirmed orphan ended:', room.id);
    }
  }

  return { scanned: rows.length, ended };
}

/** Best-effort room closure after the database has accepted an explicit end. */
export async function closeLiveKitRoom(roomName, {
  livekitUrl = process.env.LIVEKIT_URL,
  apiKey = process.env.LIVEKIT_API_KEY,
  apiSecret = process.env.LIVEKIT_API_SECRET,
  logger = console,
  roomService,
} = {}) {
  const name = String(roomName || '').trim();
  if (!name || !apiKey || !apiSecret || !toHttpUrl(livekitUrl)) {
    safeLog(logger, 'warn', '[LIVE end] LiveKit room closure skipped: incomplete configuration or room name.');
    return { closed: false, reason: 'configuration' };
  }

  try {
    const service = roomService || await createRoomService(toHttpUrl(livekitUrl), apiKey, apiSecret);
    await service.deleteRoom(name);
    return { closed: true };
  } catch (error) {
    // LiveKit may already have removed the room. Database status remains ended;
    // the scheduled reconciler and next cleanup can safely retry.
    safeLog(logger, 'warn', '[LIVE end] LiveKit room closure could not be confirmed:', name, error?.message || error);
    return { closed: false, reason: 'livekit-error' };
  }
}
