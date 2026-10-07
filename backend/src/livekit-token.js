```js
import { AccessToken } from 'livekit-server-sdk';

const MIN_TTL_SECONDS = 60;
const MAX_TTL_SECONDS = 3600;

function clean(value) {
  return String(value ?? '').trim();
}

export function validateRoomName(roomName) {
  return /^[A-Za-z0-9][A-Za-z0-9._:-]{1,127}$/.test(
    clean(roomName)
  );
}

function validateIdentity(userId) {
  const identity = clean(userId);

  return identity.length > 0 && identity.length <= 128;
}

function getLiveKitUrl() {
  const url = clean(process.env.LIVEKIT_URL);

  if (!url) {
    throw Object.assign(
      new Error('LIVEKIT_URL is not configured.'),
      {
        code: 'TOKEN_GENERATION_FAILED',
        status: 503
      }
    );
  }

  if (
    !url.startsWith('wss://') &&
    !url.startsWith('ws://')
  ) {
    throw Object.assign(
      new Error('LIVEKIT_URL must be a valid ws:// or wss:// URL.'),
      {
        code: 'TOKEN_GENERATION_FAILED',
        status: 503
      }
    );
  }

  return url;
}

export async function createLiveKitToken({
  userId,
  roomName,
  canPublish = false,
  ttlSeconds = 3600
}) {
  const apiKey = clean(process.env.LIVEKIT_API_KEY);
  const apiSecret = clean(process.env.LIVEKIT_API_SECRET);

  getLiveKitUrl();

  if (!apiKey || !apiSecret) {
    throw Object.assign(
      new Error(
        'LiveKit server credentials are not completely configured.'
      ),
      {
        code: 'TOKEN_GENERATION_FAILED',
        status: 503
      }
    );
  }

  const identity = clean(userId);
  const room = clean(roomName);

  if (!validateIdentity(identity)) {
    throw Object.assign(
      new Error('Invalid LiveKit participant identity.'),
      {
        code: 'INVALID_IDENTITY',
        status: 400
      }
    );
  }

  if (!validateRoomName(room)) {
    throw Object.assign(
      new Error('Invalid LiveKit room name.'),
      {
        code: 'INVALID_ROOM',
        status: 400
      }
    );
  }

  const requestedTtl = Number(ttlSeconds);

  const safeTtl = Number.isFinite(requestedTtl)
    ? Math.trunc(requestedTtl)
    : 3600;

  const boundedTtlSeconds = Math.max(
    MIN_TTL_SECONDS,
    Math.min(MAX_TTL_SECONDS, safeTtl)
  );

  const token = new AccessToken(
    apiKey,
    apiSecret,
    {
      identity,
      name: canPublish ? 'Host' : 'Viewer',
      ttl: boundedTtlSeconds
    }
  );

  token.addGrant({
    roomJoin: true,
    room,
    canPublish: Boolean(canPublish),
    canSubscribe: true,
    canPublishData: true
  });

  return await token.toJwt();
}

export function livekitHealth() {
  const url = clean(process.env.LIVEKIT_URL);
  const apiKey = clean(process.env.LIVEKIT_API_KEY);
  const apiSecret = clean(process.env.LIVEKIT_API_SECRET);

  return {
    configured: Boolean(
      url &&
      apiKey &&
      apiSecret
    ),
    serverUrl: url || null
  };
}
```
