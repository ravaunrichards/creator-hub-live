import { AccessToken, RoomServiceClient } from 'livekit-server-sdk';
import { classifyPublishedTracks } from './livekit-verification.js';

// Validate the configured realtime endpoint before issuing tokens. The URL,
// API key and API secret must all belong to the same LiveKit project.
function livekitServerUrl() {
  const value = String(process.env.LIVEKIT_URL || '').trim();
  if (!value) return '';
  try {
    const parsed = new URL(value);
    if (parsed.protocol !== 'wss:' || !parsed.hostname || parsed.username || parsed.password || parsed.pathname !== '/' || parsed.search || parsed.hash) return '';
    return parsed.origin;
  } catch (_) {
    return '';
  }
}

// Convert the LiveKit realtime URL to its HTTP API URL.
function livekitHttpBase() {
  const url = livekitServerUrl();
  return url ? url.replace(/^wss:/, 'https:') : '';
}

// Verify that the host has published both camera and microphone tracks.
export async function verifyHostPublishing(roomName, identity) {
  const apiKey = process.env.LIVEKIT_API_KEY;
  const apiSecret = process.env.LIVEKIT_API_SECRET;
  const httpBase = livekitHttpBase();

  if (!apiKey || !apiSecret || !httpBase) {
    throw Object.assign(
      new Error('LiveKit server configuration is incomplete.'),
      { code: 'REQUIRES_CONFIGURATION', status: 503 }
    );
  }

  const svc = new RoomServiceClient(httpBase, apiKey, apiSecret);
  let participants;

  try {
    participants = await svc.listParticipants(roomName);
  } catch (e) {
    throw Object.assign(
      new Error('Unable to verify LIVE publication with LiveKit.'),
      { code: 'LIVEKIT_UNREACHABLE', status: 502, cause: e }
    );
  }

  const host = (participants || []).find(
    (participant) => String(participant.identity) === String(identity)
  );

  if (!host) {
    throw Object.assign(
      new Error('Host is not connected to the LIVE room yet.'),
      { code: 'LIVE_PUBLISH_REQUIRED', status: 409 }
    );
  }

  const tracks = Array.isArray(host.tracks)
    ? host.tracks
    : host.tracks
      ? Array.from(host.tracks)
      : [];

  const media = classifyPublishedTracks(tracks);

  if (!media.camera || !media.microphone) {
    const missing = [];

    if (!media.camera) missing.push('camera');
    if (!media.microphone) missing.push('microphone');

    throw Object.assign(
      new Error(
        `Host must publish camera and microphone. Missing: ${missing.join(', ')}.`
      ),
      {
        code: 'LIVE_PUBLISH_REQUIRED',
        status: 409,
        details: { missing }
      }
    );
  }

  return {
    identity: String(identity),
    trackCount: tracks.length,
    camera: true,
    microphone: true
  };
}

// Validate the room name.
export function validateRoomName(roomName) {
  return /^[A-Za-z0-9][A-Za-z0-9._:-]{1,127}$/.test(
    String(roomName || '')
  );
}

// Create a LiveKit access token for a host or viewer.
export async function createLiveKitToken({
  userId,
  roomName,
  canPublish = false,
  ttlSeconds = 3600
}) {
  const apiKey = process.env.LIVEKIT_API_KEY;
  const apiSecret = process.env.LIVEKIT_API_SECRET;

  if (!apiKey || !apiSecret || !livekitServerUrl()) {
    throw Object.assign(
      new Error('LiveKit is not configured correctly. Set LIVEKIT_URL to the wss:// URL for the same LiveKit project as LIVEKIT_API_KEY and LIVEKIT_API_SECRET.'),
      {
        code: 'LIVEKIT_CONFIGURATION_INVALID',
        status: 503
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
    // LiveKit source IDs: camera=1, microphone=2, screen share=3, screen-share audio=4.
    canPublishSources: canPublish ? [1, 2, 3, 4] : [],
    canSubscribe: true,
    canPublishData: true
  });

  return await token.toJwt();
}

// Report LiveKit configuration status.
export function livekitHealth() {
  return {
    configured: !!(
      livekitServerUrl() &&
      process.env.LIVEKIT_API_KEY &&
      process.env.LIVEKIT_API_SECRET
    ),
    serverUrl: livekitServerUrl() || null
  };
}
