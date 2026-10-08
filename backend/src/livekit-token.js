import { AccessToken, RoomServiceClient } from 'livekit-server-sdk';

// Derive the LiveKit HTTP API base (https) from the realtime (wss) URL.
function livekitHttpBase() {
  const url = process.env.LIVEKIT_URL || '';
  return url.replace(/^wss:/, 'https:').replace(/^ws:/, 'http:');
}

// Server-authoritative LIVE gate: confirm the host identity is actually present
// in the LiveKit room AND publishing at least one live (unmuted) track.
// Throws LIVE_PUBLISH_REQUIRED when the host has not published media.
export async function verifyHostPublishing(roomName, identity) {
  const apiKey = process.env.LIVEKIT_API_KEY;
  const apiSecret = process.env.LIVEKIT_API_SECRET;
  const httpBase = livekitHttpBase();
  
  if (!apiKey || !apiSecret || !httpBase) {
    throw Object.assign(new Error('LiveKit server configuration is incomplete.'), { 
      code: 'REQUIRES_CONFIGURATION', 
      status: 503 
    });
  }

  const svc = new RoomServiceClient(httpBase, apiKey, apiSecret);
  let participants;
  try {
    participants = await svc.listParticipants(roomName);
  } catch (e) {
    throw Object.assign(new Error('Unable to verify LIVE publication with LiveKit.'), { 
      code: 'LIVEKIT_UNREACHABLE', 
      status: 502, 
      cause: e 
    });
  }

  const host = (participants || []).find(p => String(p.identity) === String(identity));
  if (!host) {
    throw Object.assign(new Error('Host is not connected to the LIVE room yet.'), { 
      code: 'LIVE_PUBLISH_REQUIRED', 
      status: 409 
    });
  }

  // Handle both array and iterable/map track structures if returned by LiveKit SDK
  const tracks = host.tracks ? Array.from(host.tracks) : [];
  const publishing = tracks.some(t => {
    const isMuted = t.muted !== undefined ? t.muted : t.isMuted;
    return !isMuted;
  });

  if (!publishing) {
    throw Object.assign(new Error('Camera/microphone publication was not detected.'), { 
      code: 'LIVE_PUBLISH_REQUIRED', 
      status: 409 
    });
  }

  return { identity, trackCount: tracks.length };
}

export function validateRoomName(roomName) {
  return /^[A-Za-z0-9][A-Za-z0-9._:-]{1,127}$/.test(String(roomName || ''));
}

export async function createLiveKitToken({ userId, roomName, canPublish = false, ttlSeconds = 3600 }) {
  const apiKey = process.env.LIVEKIT_API_KEY;
  const apiSecret = process.env.LIVEKIT_API_SECRET;

  if (!apiKey || !apiSecret) {
    throw Object.assign(new Error('LiveKit server configuration is incomplete.'), { 
      code: 'TOKEN_GENERATION_FAILED', 
      status: 500 
    });
  }

  if (!userId || !validateRoomName(roomName)) {
    throw Object.assign(new Error('Invalid LiveKit room.'), { 
      code: 'INVALID_ROOM', 
      status: 400 
    });
  }

  // LiveKit accepts a plain number of seconds for options.ttl
  const boundedTtlSeconds = Math.max(60, Math.min(3600, Number(ttlSeconds) || 3600));

  const token = new AccessToken(apiKey, apiSecret, { 
    identity: String(userId), 
    name: canPublish ? 'Host' : 'Viewer', 
    ttl: boundedTtlSeconds 
  });

  token.addGrant({ 
    roomJoin: true, 
    room: roomName, 
    canPublish: !!canPublish, 
    canSubscribe: true, 
    canPublishData: true 
  });

  return await token.toJwt();
}

export function livekitHealth() {
  return { 
    configured: !!(process.env.LIVEKIT_URL && process.env.LIVEKIT_API_KEY && process.env.LIVEKIT_API_SECRET), 
    serverUrl: process.env.LIVEKIT_URL || null 
  };
}
