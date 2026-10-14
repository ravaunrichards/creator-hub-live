import { createHmac, createHash, randomUUID, timingSafeEqual } from 'node:crypto';
import { EgressClient, EncodedFileOutput, EncodedFileType, S3Upload, RoomServiceClient } from 'livekit-server-sdk';

const LIVEKIT_URL = () => String(process.env.LIVEKIT_URL || '').replace(/^wss:/i, 'https:').replace(/^ws:/i, 'http:');
const LIVEKIT_KEY = () => String(process.env.LIVEKIT_API_KEY || '');
const LIVEKIT_SECRET = () => String(process.env.LIVEKIT_API_SECRET || '');
const nowIso = () => new Date().toISOString();
const isoPlusDays = (days) => new Date(Date.now() + days * 86400000).toISOString();
const asString = (value) => String(value ?? '').trim();
const safeInt = (value, fallback = 0) => Number.isSafeInteger(Number(value)) ? Number(value) : fallback;

function requireLiveKit(fail) {
  if (!LIVEKIT_URL() || !LIVEKIT_KEY() || !LIVEKIT_SECRET()) {
    throw fail(503, 'LIVEKIT_NOT_CONFIGURED', 'LiveKit server credentials are not configured.');
  }
}

function roomService() {
  return new RoomServiceClient(LIVEKIT_URL(), LIVEKIT_KEY(), LIVEKIT_SECRET());
}

function egressService() {
  return new EgressClient(LIVEKIT_URL(), LIVEKIT_KEY(), LIVEKIT_SECRET());
}

export async function hasAcceptedLiveRoomGuest(client, liveId, userId) {
  const { data, error } = await client
    .from('live_guests')
    .select('id')
    .eq('live_id', liveId)
    .eq('user_id', userId)
    .eq('status', 'accepted')
    .maybeSingle();
  if (error) throw error;
  return Boolean(data);
}

export async function canAccessLiveRoom(client, room, user, hostProfileOverride) {
  if (!room) return false;
  const audience = String(room.audience || 'public');
  if (user && String(room.host_id) === String(user.id)) return true;
  if (String(room.status || '').toLowerCase() === 'ended') return false;
  let hostProfile = hostProfileOverride;
  if (hostProfileOverride === undefined) {
    const { data, error: profileError } = await client.from('profiles').select('privacy').eq('id', room.host_id).maybeSingle();
    if (profileError) throw profileError;
    hostProfile = data;
  }
  const profileIsPrivate = String(hostProfile?.privacy?.account || 'public') === 'private';
  const isLive = String(room.status || '').toLowerCase() === 'live';
  if (!user) return isLive && audience === 'public' && !profileIsPrivate;
  const { data: moderator, error: moderatorError } = await client.from('live_room_moderators').select('user_id')
    .eq('live_id', room.id).eq('user_id', user.id).maybeSingle();
  if (moderatorError) throw moderatorError;
  if (moderator) return true;
  const { data: invitation, error: invitationError } = await client.from('live_guests').select('status')
    .eq('live_id', room.id).eq('user_id', user.id).in('status', ['invited', 'accepted']).maybeSingle();
  if (invitationError) throw invitationError;
  if (invitation) return true;
  if (!isLive) return false;
  if (audience === 'public' && !profileIsPrivate) return true;
  if (audience === 'followers' || (audience === 'public' && profileIsPrivate)) {
    const { data, error } = await client.from('follows').select('follower_id')
      .eq('follower_id', user.id).eq('followee_id', room.host_id).eq('status', 'accepted').maybeSingle();
    if (error) throw error;
    return Boolean(data);
  }
  return false;
}

async function roomAndUser(ctx, roomId) {
  const user = await ctx.requireSupabaseUser(ctx.req);
  const client = ctx.db();
  const room = await ctx.liveRoomById(client, roomId);
  return { user, room, client };
}

async function isModerator(client, roomId, userId) {
  const { data, error } = await client.from('live_room_moderators')
    .select('user_id').eq('live_id', roomId).eq('user_id', userId).maybeSingle();
  if (error) throw error;
  return Boolean(data);
}

async function requireHost(ctx, room, user) {
  if (String(room.host_id) !== String(user.id)) {
    throw ctx.fail(403, 'HOST_REQUIRED', 'Only this LIVE host can perform that action.');
  }
}

async function requireHostOrModerator(ctx, client, room, user) {
  if (String(room.host_id) === String(user.id)) return { isHost: true, isModerator: true };
  if (await isModerator(client, room.id, user.id)) return { isHost: false, isModerator: true };
  throw ctx.fail(403, 'MODERATOR_REQUIRED', 'The host or an approved moderator must perform that action.');
}

async function profilesByIds(client, ids) {
  const uniqueIds = [...new Set((ids || []).map(asString).filter(Boolean))];
  if (!uniqueIds.length) return new Map();
  const { data, error } = await client.from('profiles')
    .select('id,username,display_name,avatar_url').in('id', uniqueIds);
  if (error) throw error;
  return new Map((data || []).map((profile) => [String(profile.id), profile]));
}

function publicProfile(profile, id) {
  return {
    id: String(id || profile?.id || ''),
    username: profile?.username || null,
    displayName: profile?.display_name || profile?.username || 'Member',
    avatarUrl: profile?.avatar_url || null,
  };
}

export async function getCurrentLiveViewerCount(client, room) {
  if (!room || !LIVEKIT_URL() || !LIVEKIT_KEY() || !LIVEKIT_SECRET()) return null;
  try {
    const [participants, guestsResult] = await Promise.all([
      roomService().listParticipants(room.room_name),
      client.from('live_guests').select('user_id').eq('live_id', room.id).eq('status', 'accepted'),
    ]);
    if (guestsResult.error) throw guestsResult.error;
    const nonViewerIds = new Set([String(room.host_id), ...(guestsResult.data || []).map((guest) => String(guest.user_id))]);
    return (participants || []).filter((participant) => participant.identity && !nonViewerIds.has(String(participant.identity))).length;
  } catch (error) {
    console.warn('[LIVE room] Current viewer count unavailable:', error?.message || error);
    return null;
  }
}

async function getLiveParticipants(ctx, client, room) {
  const ids = new Set([String(room.host_id)]);
  const { data: guests, error } = await client.from('live_guests')
    .select('user_id,status,mic_on,cam_on,slot,pinned,joined_at')
    .eq('live_id', room.id).in('status', ['invited', 'accepted']);
  if (error) throw error;
  (guests || []).filter((g) => g.status === 'accepted').forEach((g) => ids.add(String(g.user_id)));
  let connected = [];
  if (LIVEKIT_URL() && LIVEKIT_KEY() && LIVEKIT_SECRET()) {
    try { connected = await roomService().listParticipants(room.room_name); }
    catch (error) {
      // If LiveKit is momentarily unavailable, database-backed guest state remains visible.
      console.warn('[LIVE room] Participant refresh failed:', error?.message || error);
    }
  }
  const stageEligible = new Set([String(room.host_id), ...(guests || []).filter((g) => g.status === 'accepted').map((g) => String(g.user_id))]);
  (connected || []).forEach((p) => { if (p.identity && stageEligible.has(String(p.identity))) ids.add(String(p.identity)); });
  const profiles = await profilesByIds(client, [...ids]);
  const guestByUser = new Map((guests || []).map((g) => [String(g.user_id), g]));
  return [...ids].map((id) => {
    const profile = profiles.get(id);
    const guest = guestByUser.get(id);
    const online = (connected || []).some((p) => String(p.identity) === id);
    return {
      ...publicProfile(profile, id),
      role: id === String(room.host_id) ? 'host' : (guest?.status === 'accepted' ? 'guest' : 'participant'),
      status: id === String(room.host_id) ? (online ? 'connected' : room.status) : (guest?.status || (online ? 'connected' : 'offline')),
      isConnected: online,
      micOn: guest ? Boolean(guest.mic_on) : null,
      camOn: guest ? Boolean(guest.cam_on) : null,
      slot: guest?.slot ?? null,
      pinned: guest ? Boolean(guest.pinned) : false,
    };
  });
}

function recordingConfig() {
  return {
    bucket: asString(process.env.LIVE_RECORDING_S3_BUCKET),
    region: asString(process.env.LIVE_RECORDING_S3_REGION || process.env.AWS_REGION),
    accessKey: asString(process.env.LIVE_RECORDING_S3_ACCESS_KEY || process.env.AWS_ACCESS_KEY_ID),
    secretKey: asString(process.env.LIVE_RECORDING_S3_SECRET_KEY || process.env.AWS_SECRET_ACCESS_KEY),
    endpoint: asString(process.env.LIVE_RECORDING_S3_ENDPOINT),
    forcePathStyle: String(process.env.LIVE_RECORDING_S3_FORCE_PATH_STYLE || '').toLowerCase() === 'true',
  };
}

function assertStorageConfig(fail) {
  const cfg = recordingConfig();
  if (!cfg.bucket || !cfg.region || !cfg.accessKey || !cfg.secretKey) {
    throw fail(503, 'RECORDING_STORAGE_NOT_CONFIGURED', 'LIVE recording needs private S3-compatible storage. Set LIVE_RECORDING_S3_BUCKET, LIVE_RECORDING_S3_REGION, LIVE_RECORDING_S3_ACCESS_KEY and LIVE_RECORDING_S3_SECRET_KEY on the backend.');
  }
  return cfg;
}

function assertRecordingConfig(fail) {
  requireLiveKit(fail);
  return assertStorageConfig(fail);
}

function awsEncode(value) {
  return encodeURIComponent(String(value)).replace(/[!'()*]/g, (c) => '%' + c.charCodeAt(0).toString(16).toUpperCase());
}

function s3ObjectUrl(key, cfg = recordingConfig()) {
  const cleanKey = String(key).split('/').map(awsEncode).join('/');
  if (cfg.endpoint) {
    const endpoint = new URL(cfg.endpoint);
    const path = endpoint.pathname.replace(/\/$/, '');
    if (cfg.forcePathStyle || !endpoint.hostname.includes('amazonaws.com')) {
      endpoint.pathname = `${path}/${awsEncode(cfg.bucket)}/${cleanKey}`.replace(/\/+/g, '/');
    } else {
      endpoint.hostname = `${cfg.bucket}.${endpoint.hostname}`;
      endpoint.pathname = `${path}/${cleanKey}`.replace(/\/+/g, '/');
    }
    return endpoint;
  }
  const url = cfg.forcePathStyle
    ? new URL(`https://s3.${cfg.region}.amazonaws.com/${awsEncode(cfg.bucket)}/${cleanKey}`)
    : new URL(`https://${cfg.bucket}.s3.${cfg.region}.amazonaws.com/${cleanKey}`);
  return url;
}

function sha256(value) { return createHash('sha256').update(value).digest('hex'); }
function hmac(key, value, encoding) { return createHmac('sha256', key).update(value).digest(encoding); }
function signingKey(secret, date, region) {
  return hmac(hmac(hmac(hmac(`AWS4${secret}`, date), region), 's3'), 'aws4_request');
}
function canonicalQuery(params) {
  return [...params.entries()].map(([k, v]) => [awsEncode(k), awsEncode(v)])
    .sort((a, b) => a[0].localeCompare(b[0]) || a[1].localeCompare(b[1]))
    .map(([k, v]) => `${k}=${v}`).join('&');
}

function presignedDownloadUrl(key, expiresSeconds = 300, filename = 'creator-hub-live-recording.mp4') {
  const cfg = recordingConfig();
  const url = s3ObjectUrl(key, cfg);
  const date = new Date();
  const amzDate = date.toISOString().replace(/[:-]|\.\d{3}/g, '');
  const shortDate = amzDate.slice(0, 8);
  const scope = `${shortDate}/${cfg.region}/s3/aws4_request`;
  const safeFilename = String(filename || 'creator-hub-live-recording.mp4').replace(/[^A-Za-z0-9._-]/g, '_').slice(0, 160) || 'creator-hub-live-recording.mp4';
  const params = new URLSearchParams({
    'X-Amz-Algorithm': 'AWS4-HMAC-SHA256',
    'X-Amz-Credential': `${cfg.accessKey}/${scope}`,
    'X-Amz-Date': amzDate,
    'X-Amz-Expires': String(expiresSeconds),
    'X-Amz-SignedHeaders': 'host',
    'response-content-disposition': `attachment; filename="${safeFilename}"`,
    'response-content-type': 'video/mp4',
  });
  const query = canonicalQuery(params);
  const request = `GET\n${url.pathname}\n${query}\nhost:${url.host}\n\nhost\nUNSIGNED-PAYLOAD`;
  const stringToSign = `AWS4-HMAC-SHA256\n${amzDate}\n${scope}\n${sha256(request)}`;
  const signature = hmac(signingKey(cfg.secretKey, shortDate, cfg.region), stringToSign, 'hex');
  url.search = `${query}&X-Amz-Signature=${signature}`;
  return url.toString();
}

async function signedS3Request(method, key) {
  const cfg = recordingConfig();
  const url = s3ObjectUrl(key, cfg);
  const date = new Date();
  const amzDate = date.toISOString().replace(/[:-]|\.\d{3}/g, '');
  const shortDate = amzDate.slice(0, 8);
  const payloadHash = sha256('');
  const scope = `${shortDate}/${cfg.region}/s3/aws4_request`;
  const headers = `host:${url.host}\nx-amz-content-sha256:${payloadHash}\nx-amz-date:${amzDate}\n`;
  const signedHeaders = 'host;x-amz-content-sha256;x-amz-date';
  const request = `${method}\n${url.pathname}\n${canonicalQuery(url.searchParams)}\n${headers}${signedHeaders}\n${payloadHash}`;
  const stringToSign = `AWS4-HMAC-SHA256\n${amzDate}\n${scope}\n${sha256(request)}`;
  const signature = hmac(signingKey(cfg.secretKey, shortDate, cfg.region), stringToSign, 'hex');
  const authorization = `AWS4-HMAC-SHA256 Credential=${cfg.accessKey}/${scope}, SignedHeaders=${signedHeaders}, Signature=${signature}`;
  const response = await fetch(url, { method, headers: {
    Authorization: authorization,
    'x-amz-content-sha256': payloadHash,
    'x-amz-date': amzDate,
  } });
  if (!response.ok && response.status !== 404) {
    const text = await response.text().catch(() => '');
    throw Object.assign(new Error(`Private recording storage returned HTTP ${response.status}. ${text.slice(0, 200)}`), { status: 502, code: 'RECORDING_STORAGE_REQUEST_FAILED' });
  }
  return response;
}

function egressInfoStatus(info) {
  const raw = info?.status;
  // livekit-server-sdk v2 exposes EgressStatus as enum values 0..6.
  if (typeof raw === 'number' || /^\d+$/.test(String(raw || ''))) {
    const code = Number(raw);
    if (code === 3) return 'ready';
    if (code >= 4 && code <= 6) return 'failed';
    if (code === 1) return 'recording';
    return 'processing';
  }
  const value = String(raw || '').toUpperCase();
  if (value.includes('COMPLETE')) return 'ready';
  if (value.includes('FAILED') || value.includes('ABORTED') || value.includes('LIMIT_REACHED')) return 'failed';
  if (value.includes('ACTIVE')) return 'recording';
  return 'processing';
}

async function refreshRecordingStatus(client, row) {
  if (!row.egress_id || !['recording', 'processing'].includes(row.status)) return row;
  try {
    const rows = await egressService().listEgress({ egressId: row.egress_id });
    const info = (rows || []).find((item) => String(item.egressId || item.egress_id) === String(row.egress_id)) || rows?.[0];
    if (!info) {
      // LiveKit Egress lists active jobs, not all completed jobs. A private
      // S3 HEAD confirms upload completion without exposing the recording URL.
      const object = await signedS3Request('HEAD', row.storage_key);
      if (object && object.ok) {
        const patch = {
          status: 'ready', ended_at: row.ended_at || nowIso(),
          expires_at: row.expires_at || isoPlusDays(30), updated_at: nowIso(),
        };
        const length = Number(object.headers.get('content-length'));
        if (Number.isSafeInteger(length) && length >= 0) patch.file_size_bytes = length;
        const { data, error } = await client.from('live_room_recordings').update(patch).eq('id', row.id).select('*').single();
        if (!error && data) return data;
      } else {
        await client.from('live_room_recordings').update({ updated_at: nowIso() }).eq('id', row.id);
      }
      return row;
    }
    const status = egressInfoStatus(info);
    const fileResult = Array.isArray(info.fileResults) ? info.fileResults[0] : null;
    const patch = { status, updated_at: nowIso() };
    if (status === 'ready') {
      patch.ended_at = row.ended_at || nowIso();
      patch.expires_at = row.expires_at || isoPlusDays(30);
      if (fileResult?.filename) patch.storage_key = String(fileResult.filename);
      if (Number.isFinite(Number(fileResult?.size))) patch.file_size_bytes = Number(fileResult.size);
      if (Number.isFinite(Number(fileResult?.duration))) patch.duration_ms = Number(fileResult.duration);
    }
    if (status === 'failed') {
      patch.ended_at = row.ended_at || nowIso();
      patch.expires_at = row.expires_at || isoPlusDays(30);
      patch.failure_reason = String(info.error || info.errorMessage || 'LiveKit Egress failed.').slice(0, 1000);
    }
    const { data, error } = await client.from('live_room_recordings').update(patch).eq('id', row.id).select('*').single();
    if (!error && data) return data;
  } catch (error) {
    console.warn('[LIVE recording] Status refresh deferred:', error?.message || error);
    // Rotate this row behind others so the daily bounded cleanup sweep can
    // make progress even while one Egress/storage provider is unavailable.
    try { await client.from('live_room_recordings').update({ updated_at: nowIso() }).eq('id', row.id); } catch (_) {}
  }
  return row;
}

async function loadRecordings(client, room) {
  const { data, error } = await client.from('live_room_recordings')
    .select('id,live_id,host_id,egress_id,storage_key,status,started_at,ended_at,expires_at,file_size_bytes,duration_ms,failure_reason,created_at,updated_at')
    .eq('live_id', room.id).neq('status', 'deleted').order('created_at', { ascending: false }).limit(50);
  if (error) throw error;
  const refreshed = [];
  for (const row of data || []) refreshed.push(await refreshRecordingStatus(client, row));
  return refreshed;
}

async function startRecording(ctx, client, room, user) {
  await requireHost(ctx, room, user);
  if (room.status !== 'live') throw ctx.fail(409, 'LIVE_NOT_ACTIVE', 'Start LIVE before starting a recording.');
  const cfg = assertRecordingConfig(ctx.fail);
  const { data: active, error: activeError } = await client.from('live_room_recordings')
    .select('id,status').eq('live_id', room.id).in('status', ['recording', 'processing']).limit(1);
  if (activeError) throw activeError;
  if ((active || []).length) throw ctx.fail(409, 'RECORDING_ALREADY_ACTIVE', 'A recording is already running or being finalized.');
  const { data: created, error: insertError } = await client.from('live_room_recordings').insert({
    live_id: room.id, host_id: user.id, storage_key: `creator-hub-live/${room.id}/${cryptoRandomId()}.mp4`, status: 'processing', started_at: nowIso(),
  }).select('*').single();
  if (insertError) throw insertError;
  const storageKey = created.storage_key;
  const s3Options = {
    accessKey: cfg.accessKey,
    secret: cfg.secretKey,
    bucket: cfg.bucket,
    region: cfg.region,
    forcePathStyle: cfg.forcePathStyle,
  };
  if (cfg.endpoint) s3Options.endpoint = cfg.endpoint;
  try {
    const output = new EncodedFileOutput({
      fileType: EncodedFileType.MP4,
      disableManifest: true,
      filepath: storageKey,
      output: { case: 's3', value: new S3Upload(s3Options) },
    });
    const info = await egressService().startRoomCompositeEgress(room.room_name, { file: output }, { layout: 'speaker' });
    const { data, error } = await client.from('live_room_recordings').update({
      egress_id: String(info.egressId || info.egress_id || ''),
      status: egressInfoStatus(info),
      updated_at: nowIso(),
    }).eq('id', created.id).select('*').single();
    if (error) throw error;
    return data;
  } catch (error) {
    await client.from('live_room_recordings').update({ status: 'failed', ended_at: nowIso(), expires_at: isoPlusDays(30), failure_reason: String(error?.message || 'Recording did not start.').slice(0, 1000), updated_at: nowIso() }).eq('id', created.id);
    throw ctx.fail(502, error?.code || 'RECORDING_START_FAILED', error?.message || 'LiveKit recording could not be started.');
  }
}

function cryptoRandomId() {
  return randomUUID().replace(/-/g, '');
}

export async function terminateLiveKitRoom(ctx, room, user) {
  if (String(room.host_id) !== String(user.id)) {
    throw ctx.fail(403, 'HOST_REQUIRED', 'Only this LIVE host can end the broadcast.');
  }
  requireLiveKit(ctx.fail);
  const service = roomService();
  try {
    await service.deleteRoom(String(room.room_name));
    return { terminated: true };
  } catch (error) {
    // A previously removed room is already disconnected; confirm whether it remains active.
    try {
      const existing = await service.listRooms([String(room.room_name)]);
      if (!existing || existing.length === 0) return { terminated: true, alreadyClosed: true };
    } catch (_) {}
    throw ctx.fail(502, 'LIVEKIT_ROOM_END_FAILED', 'LiveKit could not disconnect everyone in this LIVE room. The session remains marked live so you can retry safely.');
  }
}

export async function stopActiveRoomRecordings(ctx, client, room, user) {
  const { data: rows, error } = await client.from('live_room_recordings').select('id,egress_id,status')
    .eq('live_id', room.id).in('status', ['recording', 'processing']).order('created_at', { ascending: true });
  if (error) throw error;
  const activeRows = rows || [];
  if (!activeRows.length) return { stopped: 0 };
  requireLiveKit(ctx.fail);
  if (activeRows.some((row) => !row.egress_id)) {
    throw ctx.fail(409, 'RECORDING_START_PENDING', 'A recording is still being initialized. Wait for its Egress ID, then end LIVE again so the recording can be stopped safely.');
  }
  let stopped = 0;
  for (const row of activeRows) {
    await stopRecording(ctx, client, room, user, row.id);
    stopped += 1;
  }
  return { stopped };
}

async function stopRecording(ctx, client, room, user, recordingId) {
  await requireHost(ctx, room, user);
  const { data: row, error } = await client.from('live_room_recordings').select('*')
    .eq('id', recordingId).eq('live_id', room.id).maybeSingle();
  if (error) throw error;
  if (!row) throw ctx.fail(404, 'RECORDING_NOT_FOUND', 'Recording not found.');
  if (!['recording', 'processing'].includes(row.status)) return await refreshRecordingStatus(client, row);
  if (!row.egress_id) throw ctx.fail(409, 'RECORDING_NOT_READY', 'The recording provider has not returned an Egress ID yet.');
  try {
    const info = await egressService().stopEgress(row.egress_id);
    const status = egressInfoStatus(info);
    const endedAt = nowIso();
    const update = {
      status: status === 'ready' ? 'ready' : (status === 'failed' ? 'failed' : 'processing'),
      ended_at: endedAt,
      expires_at: isoPlusDays(30),
      updated_at: endedAt,
    };
    const fileResult = Array.isArray(info.fileResults) ? info.fileResults[0] : null;
    if (fileResult?.filename) update.storage_key = String(fileResult.filename);
    if (Number.isFinite(Number(fileResult?.size))) update.file_size_bytes = Number(fileResult.size);
    if (Number.isFinite(Number(fileResult?.duration))) update.duration_ms = Number(fileResult.duration);
    const { data, error: updateError } = await client.from('live_room_recordings').update(update).eq('id', row.id).select('*').single();
    if (updateError) throw updateError;
    return data;
  } catch (error) {
    throw ctx.fail(502, error?.code || 'RECORDING_STOP_FAILED', error?.message || 'Recording could not be stopped.');
  }
}

async function routeRecording(ctx, client, room, user, partId, action) {
  if ((action === 'start' || (!partId && ctx.method === 'POST')) && ctx.method === 'POST') return await startRecording(ctx, client, room, user);
  if (action === 'stop' && ctx.method === 'POST') return await stopRecording(ctx, client, room, user, partId);
  if (action === 'download' && ctx.method === 'POST') {
    await requireHost(ctx, room, user);
    const { data, error } = await client.from('live_room_recordings').select('*').eq('id', partId).eq('live_id', room.id).maybeSingle();
    if (error) throw error;
    if (!data || data.status === 'deleted') throw ctx.fail(404, 'RECORDING_NOT_FOUND', 'Recording not found.');
    const row = await refreshRecordingStatus(client, data);
    if (row.status !== 'ready') throw ctx.fail(409, 'RECORDING_NOT_READY', 'The recording is not ready to download yet. Refresh the list shortly.');
    if (!row.storage_key) throw ctx.fail(503, 'RECORDING_STORAGE_KEY_MISSING', 'The recording provider has not reported a storage object key.');
    assertRecordingConfig(ctx.fail);
    const filename = `creator-hub-live-${String(room.id).replace(/[^A-Za-z0-9._-]/g, '_')}.mp4`;
    return { downloadUrl: presignedDownloadUrl(row.storage_key, 300, filename), expiresInSeconds: 300, filename };
  }
  if ((action === 'delete' || (!action && partId)) && ctx.method === 'DELETE') {
    await requireHost(ctx, room, user);
    const { data, error } = await client.from('live_room_recordings').select('*').eq('id', partId).eq('live_id', room.id).maybeSingle();
    if (error) throw error;
    if (!data || data.status === 'deleted') throw ctx.fail(404, 'RECORDING_NOT_FOUND', 'Recording not found.');
    if (['recording', 'processing'].includes(data.status)) throw ctx.fail(409, 'RECORDING_ACTIVE', 'Stop the recording and wait for finalization before deleting it.');
    assertRecordingConfig(ctx.fail);
    await signedS3Request('DELETE', data.storage_key);
    const { data: updated, error: updateError } = await client.from('live_room_recordings').update({ status: 'deleted', deleted_at: nowIso(), updated_at: nowIso() }).eq('id', data.id).select('id,status').single();
    if (updateError) throw updateError;
    return updated;
  }
  if (ctx.method === 'GET' && !partId) {
    await requireHost(ctx, room, user);
    return { recordings: await loadRecordings(client, room) };
  }
  return null;
}

async function routeGuests(ctx, client, room, user, partId, action) {
  if (ctx.method === 'GET' && !partId) {
    const { data, error } = await client.from('live_guests')
      .select('id,live_id,user_id,status,slot,mic_on,cam_on,pinned,joined_at')
      .eq('live_id', room.id).order('slot', { ascending: true });
    if (error) throw error;
    const hostOrMod = String(room.host_id) === String(user.id) || await isModerator(client, room.id, user.id);
    const visibleRows = hostOrMod ? (data || []) : (data || []).filter((row) => String(row.user_id) === String(user.id) && ['invited', 'accepted'].includes(row.status));
    const profiles = await profilesByIds(client, visibleRows.map((row) => row.user_id));
    return { guests: visibleRows.map((row) => ({ ...row, profile: publicProfile(profiles.get(String(row.user_id)), row.user_id) })) };
  }
  if (ctx.method === 'POST' && !partId) {
    await requireHost(ctx, room, user);
    if (room.status === 'ended') throw ctx.fail(409, 'LIVE_ENDED', 'Guest invitations are unavailable after LIVE ends.');
    const body = await ctx.readJson(ctx.req);
    const memberRef = asString(body.userId || body.guestId || body.username);
    if (!memberRef) throw ctx.fail(400, 'INVALID_GUEST', 'Enter a Creator Hub username or member account ID.');
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(memberRef);
    const lookup = client.from('profiles').select('id').eq(isUuid ? 'id' : 'username', isUuid ? memberRef : memberRef.replace(/^@/, '')).maybeSingle();
    const { data: profile, error: profileError } = await lookup;
    if (profileError) throw profileError;
    if (!profile) throw ctx.fail(404, 'GUEST_NOT_FOUND', 'That member account was not found.');
    const guestId = String(profile.id);
    if (guestId === String(user.id)) throw ctx.fail(400, 'INVALID_GUEST', 'You cannot invite yourself.');
    if (room.allow_guests === false || Number(room.max_guests) === 0) throw ctx.fail(409, 'GUESTS_DISABLED', 'Guest participation is disabled for this LIVE room.');
    const { data: old, error: oldError } = await client.from('live_guests').select('status').eq('live_id', room.id).eq('user_id', guestId).maybeSingle();
    if (oldError) throw oldError;
    if (old?.status === 'accepted') throw ctx.fail(409, 'GUEST_ALREADY_JOINED', 'That member is already an accepted guest.');
    const { data, error } = await client.from('live_guests').upsert({ live_id: room.id, user_id: guestId, status: 'invited', slot: old?.slot ?? null, mic_on: true, cam_on: true, pinned: false, joined_at: null }, { onConflict: 'live_id,user_id' }).select('*').single();
    if (error) throw error;
    const { error: notificationError } = await client.from('notifications').insert({ user_id: guestId, type: 'live_guest_invite', actor_id: user.id, data: { live_id: room.id, title: room.title || 'LIVE invitation', room_id: room.id } });
    if (notificationError) console.warn('[LIVE room] Guest invitation notification could not be created:', notificationError.message);
    return { guest: data, invited: true };
  }
  if (!partId || !action) return null;
  const targetId = partId;
  if (action === 'accept' || action === 'decline') {
    if (action === 'accept' && room.allow_guests === false) throw ctx.fail(409, 'GUESTS_DISABLED', 'The host has disabled guest invitations for this LIVE room.');
    const guestId = targetId;
    if (String(user.id) !== guestId) throw ctx.fail(403, 'INVITATION_OWNER_REQUIRED', 'Only the invited member can accept or decline this invitation.');
    const { data, error } = await client.from('live_guests').update({ status: action === 'accept' ? 'accepted' : 'rejected', joined_at: action === 'accept' ? nowIso() : null })
      .eq('live_id', room.id).eq('user_id', guestId).eq('status', 'invited').select('*').maybeSingle();
    if (error) throw error;
    if (!data) throw ctx.fail(404, 'GUEST_INVITATION_NOT_FOUND', 'No pending invitation was found for this room.');
    return { guest: data };
  }
  if (action === 'remove' || action === 'leave') {
    const selfLeave = action === 'leave' && String(user.id) === String(targetId);
    if (!selfLeave) await requireHostOrModerator(ctx, client, room, user);
    const { data: row, error } = await client.from('live_guests').select('*').eq('live_id', room.id).eq('user_id', targetId).maybeSingle();
    if (error) throw error;
    if (!row) throw ctx.fail(404, 'GUEST_NOT_FOUND', 'Guest record was not found.');
    if (row.status === 'accepted' && LIVEKIT_URL() && LIVEKIT_KEY() && LIVEKIT_SECRET()) {
      try { await roomService().removeParticipant(room.room_name, String(targetId), { revokeTokenTs: BigInt(Math.floor(Date.now() / 1000)) }); }
      catch (error) {
        const code = String(error?.code || '');
        if (!/not.?found|participant/i.test(`${code} ${error?.message || ''}`)) {
          throw ctx.fail(502, 'LIVEKIT_GUEST_REMOVE_FAILED', 'LiveKit could not remove the guest. The guest state was not changed.');
        }
      }
    } else if (row.status === 'accepted') {
      throw ctx.fail(503, 'LIVEKIT_NOT_CONFIGURED', 'LiveKit must be configured before removing an active guest.');
    }
    const { data, error: updateError } = await client.from('live_guests').update({ status: selfLeave ? 'left' : 'removed', joined_at: null }).eq('id', row.id).select('*').single();
    if (updateError) throw updateError;
    return { guest: data };
  }
  if (action === 'mute' || action === 'unmute' || action === 'camera-off' || action === 'camera-on') {
    await requireHostOrModerator(ctx, client, room, user);
    const col = action.includes('camera') ? 'cam_on' : 'mic_on';
    const enabled = action === 'unmute' || action === 'camera-on';
    const { data: row, error } = await client.from('live_guests').select('*').eq('live_id', room.id).eq('user_id', targetId).eq('status', 'accepted').maybeSingle();
    if (error) throw error;
    if (!row) throw ctx.fail(404, 'GUEST_NOT_ACTIVE', 'The selected member is not an active guest.');
    if (!LIVEKIT_URL() || !LIVEKIT_KEY() || !LIVEKIT_SECRET()) throw ctx.fail(503, 'LIVEKIT_NOT_CONFIGURED', 'LiveKit server credentials are required to mute a guest.');
    try {
      const svc = roomService();
      const participants = await svc.listParticipants(room.room_name);
      const participant = (participants || []).find((item) => String(item.identity) === String(targetId));
      if (!participant) throw new Error('The guest is not connected to LiveKit.');
      const tracks = Array.isArray(participant.tracks) ? participant.tracks : [];
      const relevant = tracks.filter((track) => {
        const kind = String(track.type ?? track.source ?? '').toLowerCase();
        const numericType = Number(track.type);
        return col === 'mic_on'
          ? kind.includes('audio') || kind.includes('microphone') || (Number.isInteger(numericType) && numericType === 0)
          : kind.includes('video') || kind.includes('camera') || (Number.isInteger(numericType) && numericType === 1);
      });
      for (const track of relevant) {
        const sid = String(track.sid || track.trackSid || '');
        if (sid) await svc.mutePublishedTrack(room.room_name, String(targetId), sid, !enabled);
      }
    } catch (error) {
      throw ctx.fail(502, 'LIVEKIT_GUEST_MEDIA_CONTROL_FAILED', error?.message || 'LiveKit could not change the guest media state.');
    }
    const { data, error: updateError } = await client.from('live_guests').update({ [col]: enabled }).eq('id', row.id).select('*').single();
    if (updateError) throw updateError;
    return { guest: data };
  }
  return null;
}

async function routeReactions(ctx, client, room, user, partId) {
  const allowed = new Set(['❤️', '👏', '🔥', '🎉', '😂', '🇯🇲']);
  if (ctx.method === 'GET' && !partId) {
    const since = new Date(Date.now() - 30000).toISOString();
    const { data, error } = await client.from('live_room_reactions').select('reaction')
      .eq('live_id', room.id).gte('created_at', since).limit(600);
    if (error) throw error;
    const counts = Object.fromEntries([...allowed].map((emoji) => [emoji, 0]));
    (data || []).forEach((row) => { if (allowed.has(row.reaction)) counts[row.reaction] += 1; });
    return { counts, windowSeconds: 30, measuredAt: nowIso() };
  }
  if (ctx.method === 'POST' && !partId) {
    if (room.status !== 'live') throw ctx.fail(409, 'LIVE_NOT_ACTIVE', 'Reactions are available only while LIVE is active.');
    const body = await ctx.readJson(ctx.req);
    const reaction = asString(body.reaction);
    if (!allowed.has(reaction)) throw ctx.fail(400, 'REACTION_INVALID', 'Choose one of the supported LIVE reactions.');
    const since = new Date(Date.now() - 1000).toISOString();
    const { count, error: countError } = await client.from('live_room_reactions').select('id', { count: 'exact', head: true })
      .eq('live_id', room.id).eq('user_id', user.id).gte('created_at', since);
    if (countError) throw countError;
    if (safeInt(count) >= 5) throw ctx.fail(429, 'REACTION_RATE_LIMITED', 'Please slow down your LIVE reactions.');
    const { data, error } = await client.from('live_room_reactions').insert({ live_id: room.id, user_id: user.id, reaction })
      .select('id,live_id,user_id,reaction,created_at').single();
    if (error) throw error;
    return { reaction: data };
  }
  return null;
}

async function routeModerators(ctx, client, room, user, partId, action) {
  if (ctx.method === 'GET' && !partId) {
    const { data, error } = await client.from('live_room_moderators').select('user_id,granted_by,created_at').eq('live_id', room.id).order('created_at', { ascending: true });
    if (error) throw error;
    const profiles = await profilesByIds(client, (data || []).map((x) => x.user_id));
    return { moderators: (data || []).map((x) => ({ ...x, profile: publicProfile(profiles.get(String(x.user_id)), x.user_id) })) };
  }
  await requireHost(ctx, room, user);
  if (ctx.method === 'POST' && !partId) {
    const body = await ctx.readJson(ctx.req);
    const memberRef = asString(body.userId || body.username);
    if (!memberRef) throw ctx.fail(400, 'INVALID_MODERATOR', 'Choose another member username or account ID.');
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(memberRef);
    const { data: profile, error: profileError } = await client.from('profiles').select('id').eq(isUuid ? 'id' : 'username', isUuid ? memberRef : memberRef.replace(/^@/, '')).maybeSingle();
    if (profileError) throw profileError;
    if (!profile) throw ctx.fail(404, 'MODERATOR_NOT_FOUND', 'That member account was not found.');
    const userId = String(profile.id);
    if (userId === String(room.host_id)) throw ctx.fail(400, 'INVALID_MODERATOR', 'Choose another member account.');
    const { data, error } = await client.from('live_room_moderators').upsert({ live_id: room.id, user_id: userId, granted_by: user.id }, { onConflict: 'live_id,user_id' }).select('*').single();
    if (error) throw error;
    return { moderator: data };
  }
  if (ctx.method === 'DELETE' && partId) {
    const { error, count } = await client.from('live_room_moderators').delete({ count: 'exact' }).eq('live_id', room.id).eq('user_id', partId);
    if (error) throw error;
    return { removed: true, affected: count ?? null };
  }
  return null;
}

async function routeBattle(ctx, client, room, user, partId, action) {
  if (ctx.method === 'GET' && !partId) {
    const { data, error } = await client.from('matches').select('id,live_id,mode,status,started_at,ends_at').eq('live_id', room.id).order('started_at', { ascending: false }).limit(1);
    if (error) throw error;
    const match = data?.[0] || null;
    if (!match) return { battle: null };
    return { battle: await hydrateBattle(client, room, match) };
  }
  if ((action === 'start' || (!partId && ctx.method === 'POST')) && ctx.method === 'POST') {
    await requireHost(ctx, room, user);
    if (room.status !== 'live') throw ctx.fail(409, 'LIVE_NOT_ACTIVE', 'Start LIVE before a battle.');
    const body = await ctx.readJson(ctx.req);
    const opponentId = asString(body.opponentId);
    if (!opponentId || opponentId === String(room.host_id)) throw ctx.fail(400, 'INVALID_BATTLE_OPPONENT', 'Choose an accepted guest to battle.');
    const { data: guest, error: guestError } = await client.from('live_guests').select('user_id').eq('live_id', room.id).eq('user_id', opponentId).eq('status', 'accepted').maybeSingle();
    if (guestError) throw guestError;
    if (!guest) throw ctx.fail(400, 'BATTLE_OPPONENT_NOT_GUEST', 'The opponent must accept a guest invitation first.');
    const { data: active, error: activeError } = await client.from('matches').select('id').eq('live_id', room.id).eq('status', 'active').limit(1);
    if (activeError) throw activeError;
    if ((active || []).length) throw ctx.fail(409, 'BATTLE_ALREADY_ACTIVE', 'End the current battle before starting another.');
    const { data: match, error } = await client.from('matches').insert({ live_id: room.id, mode: '1v1', status: 'active' }).select('*').single();
    if (error) throw error;
    const { error: partError } = await client.from('match_participants').insert([
      { match_id: match.id, user_id: room.host_id, team: 'host', points: 0 },
      { match_id: match.id, user_id: opponentId, team: 'guest', points: 0 },
    ]);
    if (partError) { await client.from('matches').update({ status: 'ended', ends_at: nowIso() }).eq('id', match.id); throw partError; }
    return { battle: await hydrateBattle(client, room, match) };
  }
  if (action === 'end' && ctx.method === 'POST') {
    await requireHost(ctx, room, user);
    const matchId = asString(partId);
    const { data: match, error } = await client.from('matches').select('*').eq('id', matchId).eq('live_id', room.id).maybeSingle();
    if (error) throw error;
    if (!match) throw ctx.fail(404, 'BATTLE_NOT_FOUND', 'Battle not found.');
    if (match.status === 'active') {
      const { error: endError } = await client.from('matches').update({ status: 'ended', ends_at: nowIso() }).eq('id', match.id);
      if (endError) throw endError;
    }
    const battle = await hydrateBattle(client, room, { ...match, status: 'ended', ends_at: match.ends_at || nowIso() });
    // Store only a real gift-coin score calculated from committed wallet transactions.
    for (const competitor of battle.participants || []) {
      const { error: updateError } = await client.from('match_participants').update({ points: competitor.score }).eq('match_id', match.id).eq('user_id', competitor.id);
      if (updateError) throw updateError;
    }
    return { battle };
  }
  return null;
}

async function hydrateBattle(client, room, match) {
  const { data: participants, error } = await client.from('match_participants').select('match_id,user_id,team,points').eq('match_id', match.id);
  if (error) throw error;
  const profiles = await profilesByIds(client, (participants || []).map((p) => p.user_id));
  const ids = (participants || []).map((p) => String(p.user_id));
  const scores = new Map(ids.map((id) => [id, 0]));
  if (ids.length) {
    let giftQuery = client.from('gift_transactions').select('recipient_id,coin_cost').eq('live_id', room.id).gte('created_at', match.started_at);
    if (match.ends_at) giftQuery = giftQuery.lte('created_at', match.ends_at);
    const { data: gifts, error: giftError } = await giftQuery.in('recipient_id', ids);
    if (giftError) throw giftError;
    (gifts || []).forEach((gift) => scores.set(String(gift.recipient_id), (scores.get(String(gift.recipient_id)) || 0) + safeInt(gift.coin_cost)));
  }
  return {
    id: match.id, status: match.status, mode: match.mode,
    startedAt: match.started_at, endsAt: match.ends_at,
    scoring: 'committed gift coins received during this LIVE room',
    participants: (participants || []).map((p) => ({ ...publicProfile(profiles.get(String(p.user_id)), p.user_id), team: p.team, score: scores.get(String(p.user_id)) || 0 })),
  };
}

async function routePolls(ctx, client, room, user, partId, action) {
  if (ctx.method === 'GET' && !partId) {
    const { data: polls, error } = await client.from('live_room_polls').select('id,live_id,host_id,kind,question,options,status,ends_at,created_at').eq('live_id', room.id).order('created_at', { ascending: false }).limit(20);
    if (error) throw error;
    const votes = await Promise.all((polls || []).map(async (poll) => {
      const { data, error: voteError } = await client.from('live_room_poll_votes').select('option_index').eq('poll_id', poll.id);
      if (voteError) throw voteError;
      const counts = Array(Array.isArray(poll.options) ? poll.options.length : 0).fill(0);
      (data || []).forEach((vote) => { if (Number.isInteger(vote.option_index) && counts[vote.option_index] !== undefined) counts[vote.option_index] += 1; });
      return { ...poll, voteCounts: counts };
    }));
    return { polls: votes };
  }
  if ((action === 'create' || (!partId && ctx.method === 'POST')) && ctx.method === 'POST') {
    await requireHostOrModerator(ctx, client, room, user);
    if (room.status !== 'live') throw ctx.fail(409, 'LIVE_NOT_ACTIVE', 'Create polls only while LIVE is active.');
    const body = await ctx.readJson(ctx.req);
    const question = asString(body.question).slice(0, 220);
    const kind = body.kind === 'qa' ? 'qa' : 'poll';
    const options = Array.isArray(body.options) ? [...new Set(body.options.map((x) => asString(x).slice(0, 100)).filter(Boolean))] : [];
    if (!question) throw ctx.fail(400, 'POLL_QUESTION_REQUIRED', 'Enter a question.');
    if (kind === 'poll' && (options.length < 2 || options.length > 6)) throw ctx.fail(400, 'POLL_OPTIONS_INVALID', 'A poll needs 2–6 different answer options.');
    const { data: active, error: activeError } = await client.from('live_room_polls').select('id').eq('live_id', room.id).eq('status', 'active').limit(1);
    if (activeError) throw activeError;
    if ((active || []).length) throw ctx.fail(409, 'POLL_ALREADY_ACTIVE', 'Close the current poll before creating another.');
    const { data, error } = await client.from('live_room_polls').insert({ live_id: room.id, host_id: room.host_id, kind, question, options, status: 'active', ends_at: body.durationSeconds ? new Date(Date.now() + Math.min(3600, Math.max(30, safeInt(body.durationSeconds, 180))) * 1000).toISOString() : null }).select('*').single();
    if (error) throw error;
    return { poll: data };
  }
  if (action === 'vote' && ctx.method === 'POST') {
    if (room.status !== 'live') throw ctx.fail(409, 'LIVE_NOT_ACTIVE', 'Voting is available only while LIVE is active.');
    const pollId = asString(partId);
    const body = await ctx.readJson(ctx.req);
    const { data: poll, error } = await client.from('live_room_polls').select('*').eq('id', pollId).eq('live_id', room.id).maybeSingle();
    if (error) throw error;
    if (!poll || poll.status !== 'active') throw ctx.fail(409, 'POLL_CLOSED', 'This poll is no longer accepting votes.');
    if (poll.ends_at && new Date(poll.ends_at).getTime() <= Date.now()) throw ctx.fail(409, 'POLL_EXPIRED', 'This poll has ended.');
    const optionIndex = safeInt(body.optionIndex, -1);
    if (optionIndex < 0 || optionIndex >= (poll.options || []).length) throw ctx.fail(400, 'POLL_OPTION_INVALID', 'Choose a valid poll option.');
    const { data, error: voteError } = await client.from('live_room_poll_votes').upsert({ poll_id: poll.id, user_id: user.id, option_index: optionIndex, updated_at: nowIso() }, { onConflict: 'poll_id,user_id' }).select('*').single();
    if (voteError) throw voteError;
    return { vote: data };
  }
  if (action === 'close' && ctx.method === 'POST') {
    await requireHostOrModerator(ctx, client, room, user);
    const { data, error } = await client.from('live_room_polls').update({ status: 'closed', updated_at: nowIso() }).eq('id', partId).eq('live_id', room.id).select('*').maybeSingle();
    if (error) throw error;
    if (!data) throw ctx.fail(404, 'POLL_NOT_FOUND', 'Poll not found.');
    return { poll: data };
  }
  return null;
}

async function routeQuestions(ctx, client, room, user, partId, action) {
  if (ctx.method === 'GET' && !partId) {
    const { data, error } = await client.from('live_room_questions').select('id,live_id,user_id,body,status,pinned,created_at,answered_at').eq('live_id', room.id).order('pinned', { ascending: false }).order('created_at', { ascending: true }).limit(100);
    if (error) throw error;
    const profiles = await profilesByIds(client, (data || []).map((x) => x.user_id));
    return { questions: (data || []).map((x) => ({ ...x, profile: publicProfile(profiles.get(String(x.user_id)), x.user_id) })) };
  }
  if (ctx.method === 'POST' && !partId) {
    if (room.status !== 'live') throw ctx.fail(409, 'LIVE_NOT_ACTIVE', 'Audience questions are available only while LIVE is active.');
    const body = await ctx.readJson(ctx.req);
    const text = asString(body.body || body.question).slice(0, 500);
    if (text.length < 3) throw ctx.fail(400, 'QUESTION_TOO_SHORT', 'Enter a question of at least 3 characters.');
    const { data, error } = await client.from('live_room_questions').insert({ live_id: room.id, user_id: user.id, body: text }).select('*').single();
    if (error) throw error;
    return { question: data };
  }
  if (action === 'answer' && ctx.method === 'POST') {
    await requireHostOrModerator(ctx, client, room, user);
    const { data, error } = await client.from('live_room_questions').update({ status: 'answered', answered_at: nowIso(), updated_at: nowIso() }).eq('id', partId).eq('live_id', room.id).select('*').maybeSingle();
    if (error) throw error;
    if (!data) throw ctx.fail(404, 'QUESTION_NOT_FOUND', 'Question not found.');
    return { question: data };
  }
  if (action === 'pin' && ctx.method === 'POST') {
    await requireHostOrModerator(ctx, client, room, user);
    const body = await ctx.readJson(ctx.req).catch(() => ({}));
    const { data, error } = await client.from('live_room_questions').update({ pinned: Boolean(body.pinned), updated_at: nowIso() }).eq('id', partId).eq('live_id', room.id).select('*').maybeSingle();
    if (error) throw error;
    if (!data) throw ctx.fail(404, 'QUESTION_NOT_FOUND', 'Question not found.');
    return { question: data };
  }
  if ((action === 'delete' || (!action && partId)) && ctx.method === 'DELETE') {
    const { isHost } = await requireHostOrModerator(ctx, client, room, user);
    const { error } = await client.from('live_room_questions').delete().eq('id', partId).eq('live_id', room.id);
    if (error) throw error;
    return { deleted: true, byHost: isHost };
  }
  return null;
}

async function routeSettings(ctx, client, room, user) {
  if (ctx.method === 'GET') {
    const canManage = String(room.host_id) === String(user.id) || await isModerator(client, room.id, user.id);
    return { settings: { title: room.title, category: room.category, audience: room.audience || 'public', allowGuests: room.allow_guests !== false, coverImageUrl: room.cover_image_url || null }, canManage };
  }
  if (ctx.method !== 'PATCH') return null;
  await requireHost(ctx, room, user);
  const body = await ctx.readJson(ctx.req);
  const patch = { updated_at: nowIso() };
  if (body.title !== undefined) {
    const title = asString(body.title).slice(0, 200);
    if (!title) throw ctx.fail(400, 'INVALID_TITLE', 'LIVE title cannot be blank.');
    patch.title = title;
  }
  if (body.category !== undefined) patch.category = asString(body.category).slice(0, 60) || null;
  if (body.audience !== undefined) {
    if (!['public', 'followers', 'private'].includes(body.audience)) throw ctx.fail(400, 'INVALID_AUDIENCE', 'Choose public, followers, or private.');
    patch.audience = body.audience;
  }
  if (body.allowGuests !== undefined) patch.allow_guests = Boolean(body.allowGuests);
  if (body.coverImageUrl !== undefined) {
    const url = asString(body.coverImageUrl);
    if (url && (!/^https:\/\//i.test(url) || url.length > 1500)) throw ctx.fail(400, 'INVALID_COVER_URL', 'Cover image must be a valid HTTPS URL.');
    patch.cover_image_url = url || null;
  }
  const { data, error } = await client.from('live_sessions').update(patch).eq('id', room.id).select('*').single();
  if (error) throw error;
  return { settings: { title: data.title, category: data.category, audience: data.audience, allowGuests: data.allow_guests, coverImageUrl: data.cover_image_url } };
}

async function routeAnalytics(ctx, client, room, user) {
  if (ctx.method !== 'GET') return null;
  await requireHostOrModerator(ctx, client, room, user);
  const [chat, guests, gifts] = await Promise.all([
    client.from('live_chat_messages').select('id', { count: 'exact', head: true }).eq('live_id', room.id),
    client.from('live_guests').select('user_id', { count: 'exact', head: true }).eq('live_id', room.id).eq('status', 'accepted'),
    client.from('gift_transactions').select('coin_cost,diamond_value,recipient_id').eq('live_id', room.id),
  ]);
  for (const result of [chat, guests, gifts]) if (result.error) throw result.error;
  // Room-specific analytics are computed from actual chat, guest, and wallet transaction rows.
  const totals = (gifts.data || []).reduce((acc, row) => ({
    count: acc.count + 1,
    coins: acc.coins + safeInt(row.coin_cost),
    diamonds: acc.diamonds + safeInt(row.diamond_value),
  }), { count: 0, coins: 0, diamonds: 0 });
  const started = room.started_at ? new Date(room.started_at).getTime() : null;
  const until = room.ended_at ? new Date(room.ended_at).getTime() : Date.now();
  const viewerCount = room.status === 'live' ? await getCurrentLiveViewerCount(client, room) : null;
  return { analytics: {
    liveId: room.id,
    status: room.status,
    durationSeconds: started && Number.isFinite(started) ? Math.max(0, Math.floor((until - started) / 1000)) : null,
    viewerCount,
    chatMessages: safeInt(chat.count),
    activeGuests: safeInt(guests.count),
    giftsReceived: totals.count,
    giftCoins: totals.coins,
    giftDiamonds: totals.diamonds,
    measuredAt: nowIso(),
  } };
}

async function routeSchedules(ctx) {
  const parts = ctx.pathname.match(/^\/api\/live-experience\/schedules(?:\/([^/]+)(?:\/(cancel))?)?$/);
  if (!parts) return null;
  const user = await ctx.requireSupabaseUser(ctx.req);
  const client = ctx.db();
  if (ctx.method === 'GET' && !parts[1]) {
    const { data, error } = await client.from('live_schedules').select('id,creator_id,title,description,category,starts_at,audience,notify_followers,status,created_at').eq('creator_id', user.id).order('starts_at', { ascending: true }).limit(50);
    if (error) throw error;
    return { schedules: data || [] };
  }
  if (ctx.method === 'POST' && !parts[1]) {
    const body = await ctx.readJson(ctx.req);
    const title = asString(body.title).slice(0, 160);
    const startsAt = new Date(body.startsAt || '').getTime();
    const audience = ['public', 'followers', 'private'].includes(body.audience) ? body.audience : 'public';
    if (!title) throw ctx.fail(400, 'SCHEDULE_TITLE_REQUIRED', 'Enter a LIVE schedule title.');
    if (!Number.isFinite(startsAt) || startsAt <= Date.now() + 60000) throw ctx.fail(400, 'SCHEDULE_TIME_INVALID', 'Choose a start time at least one minute in the future.');
    const { data, error } = await client.from('live_schedules').insert({ creator_id: user.id, title, description: asString(body.description).slice(0, 1200), category: asString(body.category || 'Just Chatting').slice(0, 60), starts_at: new Date(startsAt).toISOString(), audience, notify_followers: body.notifyFollowers !== false }).select('*').single();
    if (error) throw error;
    return { schedule: data, reminders: 'in-app follower notifications are sent by the existing database trigger when enabled' };
  }
  if (ctx.method === 'POST' && parts[1] && parts[2] === 'cancel') {
    const { data, error } = await client.from('live_schedules').update({ status: 'cancelled', updated_at: nowIso() }).eq('id', parts[1]).eq('creator_id', user.id).eq('status', 'scheduled').select('*').maybeSingle();
    if (error) throw error;
    if (!data) throw ctx.fail(404, 'SCHEDULE_NOT_FOUND', 'A cancellable LIVE schedule was not found.');
    return { schedule: data };
  }
  return null;
}

async function routeChatModeration(ctx, client, room, user, messageId, action) {
  if ((action === 'report' || (!action && ctx.method === 'POST' && messageId === 'report')) && ctx.method === 'POST') {
    const body = await ctx.readJson(ctx.req);
    const message = asString(body.messageId || messageId);
    const reason = asString(body.reason || 'LIVE chat report').slice(0, 500);
    if (!message) throw ctx.fail(400, 'MESSAGE_ID_REQUIRED', 'Choose a chat message to report.');
    const { data: target, error: targetError } = await client.from('live_chat_messages').select('id').eq('id', message).eq('live_id', room.id).maybeSingle();
    if (targetError) throw targetError;
    if (!target) throw ctx.fail(404, 'MESSAGE_NOT_FOUND', 'Chat message not found.');
    const { data, error } = await client.from('reports').insert({ reporter_id: user.id, target_type: 'live_chat_message', target_id: String(message), reason, status: 'open' }).select('id,status,created_at').single();
    if (error) throw error;
    return { report: data };
  }
  if ((action === 'delete' || (!action && ctx.method === 'POST' && messageId && messageId !== 'report')) && ctx.method === 'POST') {
    await requireHostOrModerator(ctx, client, room, user);
    const { data, error } = await client.from('live_chat_messages').delete().eq('id', messageId).eq('live_id', room.id).select('id').maybeSingle();
    if (error) throw error;
    if (!data) throw ctx.fail(404, 'MESSAGE_NOT_FOUND', 'Chat message not found.');
    return { deleted: true, messageId: data.id };
  }
  return null;
}

// Maximum simultaneous accepted guests on the LIVE stage (matches the
// database-level enforce_guest_cap trigger in migration 0004).
const LIVE_GUEST_CAP = 12;

async function countAcceptedGuests(client, roomId) {
  const { count, error } = await client.from('live_guests')
    .select('user_id', { count: 'exact', head: true })
    .eq('live_id', roomId).eq('status', 'accepted');
  if (error) throw error;
  return safeInt(count);
}

// Viewer-initiated "request to join as a guest" lifecycle. This is distinct
// from the host-initiated invited/accepted seat lifecycle in routeGuests:
// here a viewer asks for a seat, the host accepts/rejects, and acceptance
// creates the real live_guests INVITED row the viewer must still accept
// before publishing. Backed by the public.live_room_guest_requests table
// (migration 0029).
async function routeGuestRequests(ctx, client, room, user, partId, action) {
  // List guest-join requests. Hosts/moderators see all pending requests with
  // the requester profile; everyone else sees only their own request state.
  if (ctx.method === 'GET' && !partId) {
    const hostOrMod = String(room.host_id) === String(user.id) || await isModerator(client, room.id, user.id);
    let query = client.from('live_room_guest_requests')
      .select('id,live_id,requester_id,status,created_at,updated_at')
      .eq('live_id', room.id);
    query = hostOrMod ? query.eq('status', 'pending') : query.eq('requester_id', user.id);
    const { data, error } = await query.order('created_at', { ascending: false }).limit(100);
    if (error) throw error;
    const rows = data || [];
    const profiles = await profilesByIds(client, rows.map((row) => row.requester_id));
    return { requests: rows.map((row) => ({ ...row, profile: publicProfile(profiles.get(String(row.requester_id)), row.requester_id) })) };
  }
  // A viewer requests a guest seat on the current LIVE.
  if (ctx.method === 'POST' && !partId) {
    if (room.status !== 'live') throw ctx.fail(409, 'LIVE_NOT_ACTIVE', 'Guest requests are available only while LIVE is active.');
    if (String(room.host_id) === String(user.id)) throw ctx.fail(400, 'INVALID_GUEST_REQUEST', 'The host cannot request a guest seat on their own LIVE.');
    if (room.allow_guests === false || Number(room.max_guests) === 0) throw ctx.fail(409, 'GUESTS_DISABLED', 'Guest participation is disabled for this LIVE room.');
    const alreadyGuest = await hasAcceptedLiveRoomGuest(client, room.id, user.id);
    if (alreadyGuest) throw ctx.fail(409, 'GUEST_ALREADY_JOINED', 'You are already a guest on this LIVE.');
    if (await countAcceptedGuests(client, room.id) >= LIVE_GUEST_CAP) {
      throw ctx.fail(409, 'GUEST_CAP_REACHED', 'This LIVE already has the maximum number of guests on stage.');
    }
    const { data, error } = await client.from('live_room_guest_requests')
      .upsert({ live_id: room.id, requester_id: user.id, status: 'pending', updated_at: nowIso() }, { onConflict: 'live_id,requester_id' })
      .select('id,live_id,requester_id,status,created_at,updated_at').single();
    if (error) throw error;
    const { error: notificationError } = await client.from('notifications').insert({ user_id: room.host_id, type: 'live_guest_request', actor_id: user.id, data: { live_id: room.id, request_id: data.id, room_id: room.id } });
    if (notificationError) console.warn('[LIVE room] Guest request notification could not be created:', notificationError.message);
    return { request: data };
  }
  if (!partId) return null;
  const requestId = partId;
  // The requester may cancel their own still-pending request.
  if (action === 'cancel' && ctx.method === 'POST') {
    const { data, error } = await client.from('live_room_guest_requests')
      .update({ status: 'cancelled', updated_at: nowIso() })
      .eq('id', requestId).eq('live_id', room.id).eq('requester_id', user.id).eq('status', 'pending')
      .select('id,live_id,requester_id,status,created_at,updated_at').maybeSingle();
    if (error) throw error;
    if (!data) throw ctx.fail(404, 'GUEST_REQUEST_NOT_FOUND', 'No cancellable guest request was found.');
    return { request: data };
  }
  // Host/moderator decisions on a pending request.
  if ((action === 'accept' || action === 'reject') && ctx.method === 'POST') {
    await requireHostOrModerator(ctx, client, room, user);
    const { data: request, error: lookupError } = await client.from('live_room_guest_requests')
      .select('id,requester_id,status').eq('id', requestId).eq('live_id', room.id).maybeSingle();
    if (lookupError) throw lookupError;
    if (!request || request.status !== 'pending') throw ctx.fail(404, 'GUEST_REQUEST_NOT_FOUND', 'No pending guest request was found.');
    if (action === 'reject') {
      const { data, error } = await client.from('live_room_guest_requests')
        .update({ status: 'rejected', updated_at: nowIso() }).eq('id', requestId).eq('status', 'pending')
        .select('id,live_id,requester_id,status,created_at,updated_at').maybeSingle();
      if (error) throw error;
      if (!data) throw ctx.fail(404, 'GUEST_REQUEST_NOT_FOUND', 'No pending guest request was found.');
      return { request: data };
    }
    // Accept: enforce the stage cap, then create the INVITED seat the member
    // must still accept before publishing (mirrors host-initiated invites).
    if (room.allow_guests === false) throw ctx.fail(409, 'GUESTS_DISABLED', 'Guest participation is disabled for this LIVE room.');
    if (await countAcceptedGuests(client, room.id) >= LIVE_GUEST_CAP) {
      throw ctx.fail(409, 'GUEST_CAP_REACHED', 'This LIVE already has the maximum number of guests on stage.');
    }
    const requesterId = String(request.requester_id);
    const { data: existingSeat, error: seatLookupError } = await client.from('live_guests').select('status,slot').eq('live_id', room.id).eq('user_id', requesterId).maybeSingle();
    if (seatLookupError) throw seatLookupError;
    if (existingSeat?.status !== 'accepted') {
      const { error: seatError } = await client.from('live_guests').upsert({ live_id: room.id, user_id: requesterId, status: 'invited', slot: existingSeat?.slot ?? null, mic_on: true, cam_on: true, pinned: false, joined_at: null }, { onConflict: 'live_id,user_id' });
      if (seatError) throw seatError;
    }
    const { data, error } = await client.from('live_room_guest_requests')
      .update({ status: 'accepted', updated_at: nowIso() }).eq('id', requestId).eq('status', 'pending')
      .select('id,live_id,requester_id,status,created_at,updated_at').maybeSingle();
    if (error) throw error;
    if (!data) throw ctx.fail(404, 'GUEST_REQUEST_NOT_FOUND', 'No pending guest request was found.');
    const { error: notificationError } = await client.from('notifications').insert({ user_id: requesterId, type: 'live_guest_invite', actor_id: user.id, data: { live_id: room.id, title: room.title || 'LIVE invitation', room_id: room.id } });
    if (notificationError) console.warn('[LIVE room] Guest acceptance notification could not be created:', notificationError.message);
    return { request: data, invited: true };
  }
  return null;
}

// Recent gift events for a LIVE room so every viewer sees the same gift
// animations. Sourced from real gift_transactions rows joined to the gift
// catalogue; nothing is synthesized.
async function routeGiftEvents(ctx, client, room, user, partId) {
  if (ctx.method !== 'GET' || partId) return null;
  const { data, error } = await client.from('gift_transactions')
    .select('id,gift_id,sender_id,recipient_id,coin_cost,diamond_value,created_at,gifts(name,emoji,asset_key,animation_url,sound_url,category)')
    .eq('live_id', room.id).order('created_at', { ascending: false }).limit(40);
  if (error) throw error;
  const rows = (data || []).slice().reverse();
  const profiles = await profilesByIds(client, rows.flatMap((row) => [row.sender_id, row.recipient_id]));
  const events = rows.map((row) => {
    const gift = row.gifts || {};
    const assetKey = gift.asset_key || null;
    return {
      id: row.id,
      giftName: gift.name || 'Gift',
      emoji: gift.emoji || null,
      assetKey,
      category: gift.category || null,
      animationUrl: gift.animation_url || (assetKey ? `/assets/gifts/animations/${assetKey}.svg` : null),
      soundUrl: gift.sound_url || (assetKey ? `/assets/gifts/sounds/${assetKey}.wav` : null),
      coinCost: row.coin_cost == null ? null : Number(row.coin_cost),
      diamondValue: row.diamond_value == null ? null : Number(row.diamond_value),
      senderId: String(row.sender_id),
      sender: publicProfile(profiles.get(String(row.sender_id)), row.sender_id),
      recipient: publicProfile(profiles.get(String(row.recipient_id)), row.recipient_id),
      createdAt: row.created_at,
    };
  });
  return { events };
}

export async function handleLiveRoomExperience(ctx) {
  try {
    const { pathname, method } = ctx;
    const scheduled = await routeSchedules({ ...ctx, pathname });
    if (scheduled !== null) { ctx.ok(ctx.res, scheduled); return true; }
    const cleanupPath = pathname === '/api/live-experience/maintenance/recordings/cleanup';
    if (cleanupPath && method === 'POST') {
      const expected = asString(process.env.LIVE_RECORDING_CLEANUP_SECRET);
      const supplied = asString(ctx.req.headers['x-live-recording-cleanup-secret']);
      const authorized = Boolean(expected && supplied && Buffer.byteLength(expected) === Buffer.byteLength(supplied)
        && timingSafeEqual(Buffer.from(expected), Buffer.from(supplied)));
      if (!authorized) throw ctx.fail(401, 'CLEANUP_UNAUTHORIZED', 'Recording cleanup service authorization failed.');
      assertStorageConfig(ctx.fail);
      const client = ctx.db();
      // Refresh pending jobs too: egress listing can omit completed jobs, in
      // which case a private S3 HEAD detects upload completion. Bounded and
      // oldest-first so a large catalogue is eventually swept in full.
      const { data: pending, error: pendingError } = await client.from('live_room_recordings')
        .select('id,live_id,host_id,egress_id,storage_key,status,started_at,ended_at,expires_at,file_size_bytes,duration_ms,failure_reason,created_at,updated_at')
        .in('status', ['recording', 'processing']).order('updated_at', { ascending: true }).limit(200);
      if (pendingError) throw pendingError;
      for (const row of pending || []) await refreshRecordingStatus(client, row);
      const { data, error } = await client.from('live_room_recordings').select('id,storage_key')
        .in('status', ['ready', 'failed']).lte('expires_at', nowIso()).limit(200);
      if (error) throw error;
      let deleted = 0;
      const failures = [];
      for (const row of data || []) {
        try {
          await signedS3Request('DELETE', row.storage_key);
          const { error: updateError } = await client.from('live_room_recordings').update({ status: 'deleted', deleted_at: nowIso(), updated_at: nowIso() }).eq('id', row.id);
          if (updateError) throw updateError;
          deleted += 1;
        } catch (error) { failures.push({ id: row.id, error: String(error?.message || error).slice(0, 200) }); }
      }
      ctx.ok(ctx.res, { pendingChecked: (pending || []).length, expiredProcessed: (data || []).length, deleted, failures, retentionDays: 30 });
      return true;
    }

    const match = pathname.match(/^\/api\/live\/rooms\/([^/]+)\/(participants|guests|guest-requests|gift-events|battle|polls|questions|moderators|analytics|recordings|settings|chat-moderation|reactions)(?:\/([^/]+))?(?:\/([^/]+))?$/);
    if (!match) return false;
    const roomId = decodeURIComponent(match[1]);
    const resource = match[2];
    const partId = match[3] ? decodeURIComponent(match[3]) : null;
    const action = match[4] ? decodeURIComponent(match[4]) : null;
    const { user, room, client } = await roomAndUser(ctx, roomId);
    if (!(await canAccessLiveRoom(client, room, user))) {
      throw ctx.fail(403, 'LIVE_ACCESS_RESTRICTED', 'This LIVE room is limited to its configured audience.');
    }
    let result = null;

    if (resource === 'participants' && method === 'GET' && !partId) {
      const participants = await getLiveParticipants(ctx, client, room);
      result = { participants };
    } else if (resource === 'guests') result = await routeGuests(ctx, client, room, user, partId, action);
    else if (resource === 'guest-requests') result = await routeGuestRequests(ctx, client, room, user, partId, action);
    else if (resource === 'gift-events') result = await routeGiftEvents(ctx, client, room, user, partId);
    else if (resource === 'moderators') result = await routeModerators(ctx, client, room, user, partId, action);
    else if (resource === 'battle') result = await routeBattle(ctx, client, room, user, partId, action);
    else if (resource === 'polls') result = await routePolls(ctx, client, room, user, partId, action);
    else if (resource === 'questions') result = await routeQuestions(ctx, client, room, user, partId, action);
    else if (resource === 'settings') result = await routeSettings(ctx, client, room, user);
    else if (resource === 'analytics') result = await routeAnalytics(ctx, client, room, user);
    else if (resource === 'recordings') result = await routeRecording(ctx, client, room, user, partId, action);
    else if (resource === 'chat-moderation') result = await routeChatModeration(ctx, client, room, user, partId, action);
    else if (resource === 'reactions') result = await routeReactions(ctx, client, room, user, partId);

    if (result === null || result === undefined) return false;
    ctx.ok(ctx.res, result);
    return true;
  } catch (error) {
    // Route errors must pass through the existing server error normalizer.
    throw error;
  }
}
