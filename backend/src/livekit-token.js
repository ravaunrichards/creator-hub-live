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
      new Error('LiveKit server configuration is incomplete.'),
      {
        code: 'TOKEN_GENERATION_FAILED',
        status: 500
      }
    );
  }

  if (!userId || !validateRoomName(roomName)) {
    throw Object.assign(new Error('Invalid LiveKit room.'), {
      code: 'INVALID_ROOM',
      status: 400
    });
  }

  const boundedTtlSeconds = Math.max(
    60,
    Math.min(3600, Number(ttlSeconds) || 3600)
  );

  const token = new AccessToken(apiKey, apiSecret, {
    identity: String(userId),
    name: canPublish ? 'Host' : 'Viewer',
    ttl: boundedTtlSeconds
  });

  token.addGrant({
    roomJoin: true,
    room: roomName,
    canPublish: !!canPublish,
    canPublishSources: canPublish ? [1, 2] : [],
    canSubscribe: true,
    canPublishData: true
  });

  return await token.toJwt();
}
  const apiKey = process.env.LIVEKIT_API_KEY;
  const apiSecret = process.env.LIVEKIT_API_SECRET;

  if (!apiKey || !apiSecret) {
    throw Object.assign(
      new Error('LiveKit server configuration is incomplete.'),
      {
        code: 'TOKEN_GENERATION_FAILED',
        status: 500
      }
    );
  }

  if (!userId || !validateRoomName(roomName)) {
    throw Object.assign(new Error('Invalid LiveKit room.'), {
      code: 'INVALID_ROOM',
      status: 400
    });
  }

  const boundedTtlSeconds = Math.max(
    60,
    Math.min(3600, Number(ttlSeconds) || 3600)
  );

  const token = new AccessToken(apiKey, apiSecret, {
    identity: String(userId),
    name: canPublish ? 'Host' : 'Viewer',
    ttl: boundedTtlSeconds
  });

  token.addGrant({
    roomJoin: true,
    room: roomName,
    canPublish: !!canPublish,
    canPublishSources: canPublish ? [1, 2] : [],
    canSubscribe: true,
    canPublishData: true
  });

  return await token.toJwt();
}
