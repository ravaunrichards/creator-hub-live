import { AccessToken, RoomServiceClient } from 'livekit-server-sdk';

// Convert the LiveKit realtime URL (wss://...) into the HTTPS
// URL required by the LiveKit server-side Room Service API.
function livekitHttpBase() {
  const url = String(process.env.LIVEKIT_URL || '').trim();

  if (!url) {
    return '';
  }

  return url
    .replace(/^wss:/i, 'https:')
    .replace(/^ws:/i, 'http:')
    .replace(/\/+$/, '');
}

// Server-authoritative LIVE gate.
//
// The creator is allowed to become LIVE only after the backend
// confirms that the creator is actually connected to the LiveKit
// room and has published an active audio or video track.
export async function verifyHostPublishing(roomName, identity) {
  const apiKey = process.env.LIVEKIT_API_KEY;
  const apiSecret = process.env.LIVEKIT_API_SECRET;
  const httpBase = livekitHttpBase();

  if (!apiKey || !apiSecret || !httpBase) {
    throw Object.assign(
      new Error('LiveKit server configuration is incomplete.'),
      {
        code: 'REQUIRES_CONFIGURATION',
        status: 503
      }
    );
  }

  if (!validateRoomName(roomName) || !identity) {
    throw Object.assign(
      new Error('A valid LiveKit room and host identity are required.'),
      {
        code: 'INVALID_ROOM',
        status: 400
      }
    );
  }

  const service = new RoomServiceClient(
    httpBase,
    apiKey,
    apiSecret
  );

  let participants;

  try {
    participants = await service.listParticipants(roomName);
  } catch (error) {
    throw Object.assign(
      new Error(
        'Unable to verify LIVE publication with LiveKit.'
      ),
      {
        code: 'LIVEKIT_UNREACHABLE',
        status: 502,
        cause: error
      }
    );
  }

  const host = (participants || []).find(
    participant =>
      String(participant.identity) === String(identity)
  );

  if (!host) {
    throw Object.assign(
      new Error(
        'Host is not connected to the LIVE room yet.'
      ),
      {
        code: 'LIVE_PUBLISH_REQUIRED',
        status: 409
      }
    );
  }

  const tracks = Array.isArray(host.tracks)
    ? host.tracks
    : [];

  const activeMediaTracks = tracks.filter(track => {
    const type = String(track.type || '').toLowerCase();
    const source = String(track.source || '').toLowerCase();

    const isAudio =
      type === 'audio' ||
      source === 'microphone';

    const isVideo =
      type === 'video' ||
      source === 'camera';

    return (isAudio || isVideo) && track.muted !== true;
  });

  if (activeMediaTracks.length === 0) {
    throw Object.assign(
      new Error(
        'Camera or microphone publication was not detected.'
      ),
      {
        code: 'LIVE_PUBLISH_REQUIRED',
        status: 409
      }
    );
  }

  return {
    identity: String(identity),
    trackCount: tracks.length,
    activeMediaTrackCount: activeMediaTracks.length
  };
}

export function validateRoomName(roomName) {
  return /^[A-Za-z0-9][A-Za-z0-9._:-]{1,127}$/.test(
    String(roomName || '')
  );
}

export async function createLiveKitToken({
  userId,
  roomName,
  canPublish = false,
  ttlSeconds = 3600
}) {
  const apiKey = process.env.LIVEKIT_API_KEY;
  const apiSecret = process.env.LIVEKIT_API_SECRET;

  if (!apiKey || !apiSecret) {
    throw Object.assign(
      new Error(
        'LiveKit server configuration is incomplete.'
      ),
      {
        code: 'TOKEN_GENERATION_FAILED',
        status: 500
      }
    );
  }

  if (!userId || !validateRoomName(roomName)) {
    throw Object.assign(
      new Error('Invalid LiveKit room.'),
      {
        code: 'INVALID_ROOM',
        status: 400
      }
    );
  }

  const boundedTtlSeconds = Math.max(
    60,
    Math.min(
      3600,
      Number(ttlSeconds) || 3600
    )
  );

  const token = new AccessToken(
    apiKey,
    apiSecret,
    {
      identity: String(userId),
      name: canPublish ? 'Host' : 'Viewer',
      ttl: boundedTtlSeconds
    }
  );

  token.addGrant({
    roomJoin: true,
    room: String(roomName),
    canPublish: !!canPublish,
    canSubscribe: true,
    canPublishData: true
  });

  return await token.toJwt();
}

export function livekitHealth() {
  const configured =
    !!process.env.LIVEKIT_URL &&
    !!process.env.LIVEKIT_API_KEY &&
    !!process.env.LIVEKIT_API_SECRET;

  return {
    configured,
    serverUrl: process.env.LIVEKIT_URL || null
  };
}
