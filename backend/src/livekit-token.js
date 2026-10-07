import { AccessToken } from 'livekit-server-sdk';

/**
 * Validates a room name according to official LiveKit specifications.
 * @param {string} roomName - Name string to test.
 * @returns {boolean}
 */
export function validateRoomName(roomName) {
  return /^[A-Za-z0-9][A-Za-z0-9._:-]{1,127}$/.test(String(roomName || ''));
}

/**
 * Generates an authenticated secure AccessToken for real-time WebRTC room validation.
 * @param {Object} options - Parameter properties mapping block.
 * @param {string} options.userId - Unique reference UUID of the matching user profile.
 * @param {string} options.roomName - The designation target string of the stream channel.
 * @param {boolean} [options.canPublish=false] - Grants mic and camera broadcasting permissions.
 * @param {number} [options.ttlSeconds=3600] - Lifespan duration token validity.
 * @returns {Promise<string>} Signed JSON Web Token string block.
 */
export async function createLiveKitToken({ userId, roomName, canPublish = false, ttlSeconds = 3600 }) {
  const apiKey = process.env.LIVEKIT_API_KEY;
  const apiSecret = process.env.LIVEKIT_API_SECRET;

  // 1. Verify credentials exist inside server runtime contexts
  if (!apiKey || !apiSecret) {
    throw Object.assign(new Error('LiveKit server configuration is incomplete.'), { 
      code: 'TOKEN_GENERATION_FAILED', 
      status: 500 
    });
  }

  // 2. Strict constraint tracking assertions
  if (!userId || !validateRoomName(roomName)) {
    throw Object.assign(new Error('Invalid LiveKit room parameter targets.'), { 
      code: 'INVALID_ROOM', 
      status: 400 
    });
  }

  // 3. Bound the lifespan of tokens safely using integers between 60s and 3600s
  const boundedTtlSeconds = Math.max(60, Math.min(3600, Number(ttlSeconds) || 3600));

  // 4. Instantiate Token with official metadata block format mappings
  const token = new AccessToken(apiKey, apiSecret, { 
    identity: String(userId), 
    name: canPublish ? 'Host' : 'Viewer', 
    ttl: boundedTtlSeconds 
  });

  // 5. Attach explicit video track permission capabilities
  token.addGrant({ 
    roomJoin: true, 
    room: roomName, 
    canPublish: !!canPublish, 
    canSubscribe: true, 
    canPublishData: true 
  });

  // 6. Asynchronously encode and sign token to prevent runtime blocking loops
  return await token.toJwt();
}

/**
 * Evaluates active environment variables to track integration states.
 * @returns {Object} Operational connection diagnostics array matrix.
 */
export function livekitHealth() {
  return { 
    configured: !!(process.env.LIVEKIT_URL && process.env.LIVEKIT_API_KEY && process.env.LIVEKIT_API_SECRET), 
    serverUrl: process.env.LIVEKIT_URL || null 
  };
}
