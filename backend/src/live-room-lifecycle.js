const DEFAULT_STALE_AFTER_MS = 2 * 60 * 1000;

function toHttpUrl(value) {
  return String(value || '').trim().replace(/^wss:/i, 'https:').replace(/^ws:/i, 'http:');
}

async function createRoomService(url, apiKey, apiSecret) {
  const { RoomServiceClient } = await import('livekit-server-sdk');
  return new RoomServiceClient(url, apiKey, apiSecret);
}

function safeLog(logger, method, ...args) {
  try { (logger?.[method] || (() => {})).call(logger, ...args); } catch { /* cleanup must not crash the API */ }
}

function isNotFound(error) {
  const status = Number(error?.status || error?.statusCode || error?.response?.status);
  return status === 404 || /not found|participant.*does not exist|no participant/i.test(String(error?.message || error || ''));
}

/**
 * Reconcile abandoned LIVE sessions. A recent updated_at timestamp is treated
 * as a heartbeat only after LiveKit confirms the host participant is present.
 * Stale sessions are ended only after a successful LiveKit room/participant
 * lookup proves that the host is no longer connected. Network errors are not
 * proof that a broadcast has ended.
 */
export async function closeOrphanedLiveRooms({
  client,
  livekitUrl = process.env.LIVEKIT_URL,
  apiKey = process.env.LIVEKIT_API_KEY,
  apiSecret = process.env.LIVEKIT_API_SECRET,
  now = Date.now(),
  staleAfterMs = DEFAULT_STALE_AFTER_MS,
  logger = console,
  roomService,
} = {}) {
  if (!client || !apiKey || !apiSecret || !toHttpUrl(livekitUrl)) {
    safeLog(logger, 'warn', '[LIVE cleanup] Skipped: database or LiveKit configuration is incomplete.');
    return { scanned: 0, ended: 0, refreshed: 0, skipped: 'configuration' };
  }

  let query;
  try {
    query = await client.from('live_sessions')
      .select('id,host_id,room_name,started_at,updated_at,status,ended_at')
      .eq('status', 'live').is('ended_at', null);
  } catch (error) {
    safeLog(logger, 'error', '[LIVE cleanup] Could not query sessions:', error?.message || error);
    return { scanned: 0, ended: 0, refreshed: 0, skipped: 'database-query' };
  }
  if (query?.error) {
    safeLog(logger, 'error', '[LIVE cleanup] Could not query sessions:', query.error.message || query.error);
    return { scanned: 0, ended: 0, refreshed: 0, skipped: 'database-query' };
  }

  const rows = Array.isArray(query?.data) ? query.data : [];
  if (!rows.length) return { scanned: 0, ended: 0, refreshed: 0 };

  let service = roomService;
  try {
    if (!service) service = await createRoomService(toHttpUrl(livekitUrl), apiKey, apiSecret);
  } catch (error) {
    safeLog(logger, 'error', '[LIVE cleanup] Could not initialize LiveKit:', error?.message || error);
    return { scanned: rows.length, ended: 0, refreshed: 0, skipped: 'livekit-client' };
  }

  let ended = 0;
  let refreshed = 0;
  for (const room of rows) {
    const id = String(room?.id || '').trim();
    const roomName = String(room?.room_name || '').trim();
    const hostId = String(room?.host_id || '').trim();
    if (!id || !roomName || !hostId || room.status !== 'live' || room.ended_at) continue;

    const heartbeat = Date.parse(room.updated_at || room.started_at || '');
    if (Number.isFinite(heartbeat) && now - heartbeat < staleAfterMs) continue;

    let listedRooms;
    try {
      listedRooms = await service.listRooms([roomName]);
    } catch (error) {
      safeLog(logger, 'warn', '[LIVE cleanup] Room status unknown; keeping session live:', id, error?.message || error);
      continue;
    }
    if (!Array.isArray(listedRooms)) {
      safeLog(logger, 'warn', '[LIVE cleanup] Invalid room response; keeping session live:', id);
      continue;
    }

    const liveRoom = listedRooms.find((item) => String(item?.name || '') === roomName);
    let hostPresent = false;
    if (liveRoom) {
      let participants;
      try {
        participants = await service.listParticipants(roomName);
      } catch (error) {
        safeLog(logger, 'warn', '[LIVE cleanup] Participant status unknown; keeping session live:', id, error?.message || error);
        continue;
      }
      if (!Array.isArray(participants)) {
        safeLog(logger, 'warn', '[LIVE cleanup] Invalid participant response; keeping session live:', id);
        continue;
      }
      hostPresent = participants.some((participant) => String(participant?.identity || '') === hostId);
    }

    if (hostPresent) {
      const refreshedAt = new Date(now).toISOString();
      let heartbeatUpdate;
      try {
        heartbeatUpdate = await client.from('live_sessions')
          .update({ updated_at: refreshedAt })
          .eq('id', id).eq('status', 'live').is('ended_at', null)
          .select('id').maybeSingle();
      } catch (error) {
        safeLog(logger, 'warn', '[LIVE cleanup] Could not refresh live host heartbeat:', id, error?.message || error);
        continue;
      }
      if (heartbeatUpdate?.error) {
        safeLog(logger, 'warn', '[LIVE cleanup] Could not refresh live host heartbeat:', id, heartbeatUpdate.error.message || heartbeatUpdate.error);
        continue;
      }
      refreshed += 1;
      continue;
    }

    // A missing room or a confirmed room without its host is not a live
    // broadcast. Close any lingering viewer connections best-effort, then
    // mark the database row ended so every listing stops showing the stream.
    if (liveRoom) {
      try { await service.deleteRoom(roomName); }
      catch (error) { safeLog(logger, 'warn', '[LIVE cleanup] Could not close orphaned room immediately:', id, error?.message || error); }
    }

    const endedAt = new Date(now).toISOString();
    let update;
    try {
      update = await client.from('live_sessions')
        .update({ status: 'ended', ended_at: endedAt, updated_at: endedAt, viewer_count: 0 })
        .eq('id', id).eq('status', 'live').is('ended_at', null)
        .select('id').maybeSingle();
    } catch (error) {
      safeLog(logger, 'error', '[LIVE cleanup] Could not mark abandoned session ended:', id, error?.message || error);
      continue;
    }
    if (update?.error) {
      safeLog(logger, 'error', '[LIVE cleanup] Could not mark abandoned session ended:', id, update.error.message || update.error);
      continue;
    }
    if (update?.data?.id) {
      ended += 1;
      safeLog(logger, 'info', '[LIVE cleanup] Marked abandoned session ended:', id);
    }
  }
  return { scanned: rows.length, ended, refreshed };
}

export async function closeLiveKitRoom(roomName, {
  livekitUrl = process.env.LIVEKIT_URL,
  apiKey = process.env.LIVEKIT_API_KEY,
  apiSecret = process.env.LIVEKIT_API_SECRET,
  logger = console,
  roomService,
} = {}) {
  const name = String(roomName || '').trim();
  if (!name || !apiKey || !apiSecret || !toHttpUrl(livekitUrl)) return { closed: false, skipped: 'configuration' };
  let service = roomService;
  try {
    if (!service) service = await createRoomService(toHttpUrl(livekitUrl), apiKey, apiSecret);
    await service.deleteRoom(name);
    return { closed: true };
  } catch (error) {
    if (isNotFound(error)) return { closed: true, alreadyClosed: true };
    safeLog(logger, 'warn', '[LIVE cleanup] Could not close LiveKit room:', name, error?.message || error);
    return { closed: false, error: error?.message || String(error) };
  }
}
