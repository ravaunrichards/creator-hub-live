import { AccessToken, RoomServiceClient } from 'livekit-server-sdk';
import { classifyPublishedTracks, missingMediaForMode } from './livekit-verification.js';

// Convert the LiveKit realtime URL to its HTTP API URL.
function livekitHttpBase() {
  const url = process.env.LIVEKIT_URL || '';
  return url.replace(/^wss:/, 'https:').replace(/^ws:/, 'http:');
}

// Verify the media required by the room's authoritative LIVE mode.
export async function verifyHostPublishing(roomName, identity, mediaMode = "video") {
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
  const mode = ['video', 'audio', 'screen'].includes(String(mediaMode))
    ? String(mediaMode)
    : 'video';
  const missing = missingMediaForMode(media, mode);

  if (missing.length) {
    const required = mode === 'audio' ? 'microphone' : mode === 'screen' ? 'screen share' : 'camera and microphone';
    throw Object.assign(
      new Error(`Host must publish ${required} for ${mode} LIVE. Missing: ${missing.join(', ')}.`),
      { code: 'LIVE_PUBLISH_REQUIRED', status: 409, details: { missing, mediaMode: mode } }
    );
  }

  return {
    identity: String(identity),
    trackCount: tracks.length,
    mediaMode: mode,
    camera: !!media.camera,
    microphone: !!media.microphone,
    screenShare: !!media.screenShare
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
  participantName = null,
  isHost = false,
  mediaMode = "video",
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

  const displayName = String(participantName || (isHost ? "Host" : "Creator")).trim().slice(0, 128) || (isHost ? "Host" : "Creator");
  const token = new AccessToken(apiKey, apiSecret, {
    identity: String(userId),
    name: displayName,
    ttl: boundedTtlSeconds
  });

  const mode = ['video', 'audio', 'screen'].includes(String(mediaMode))
    ? String(mediaMode)
    : 'video';
  const publishSources = !canPublish ? [] : mode === 'audio' ? [2] : mode === 'screen'
    ? (isHost ? [3, 4] : [])
    : [1, 2];

  token.addGrant({
    roomJoin: true,
    room: roomName,
    canPublish: publishSources.length > 0,
    canPublishSources: publishSources,
    canSubscribe: true,
    canPublishData: true
  });

  return await token.toJwt();
}

// Report LiveKit configuration status.
export function livekitHealth() {
  return {
    configured: !!(
      process.env.LIVEKIT_URL &&
      process.env.LIVEKIT_API_KEY &&
      process.env.LIVEKIT_API_SECRET
    ),
    serverUrl: process.env.LIVEKIT_URL || null
  };
}
