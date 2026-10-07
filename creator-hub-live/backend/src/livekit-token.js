import { AccessToken } from 'livekit-server-sdk';

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

  // CRITICAL FIX: token.toJwt() is an asynchronous operation and MUST be awaited
  return await token.toJwt();
}

export function livekitHealth() {
  return { 
    configured: !!(process.env.LIVEKIT_URL && process.env.LIVEKIT_API_KEY && process.env.LIVEKIT_API_SECRET), 
    serverUrl: process.env.LIVEKIT_URL || null 
  };
}
