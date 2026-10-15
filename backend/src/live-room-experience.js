/* Creator Hub Creator Network — secure LIVE experience routes.
 * Uses the existing authenticated backend/service-role client; it never writes
 * wallet/diamond balances directly and it never trusts browser-supplied host IDs.
 */
import { createHash, createHmac, randomUUID, timingSafeEqual } from 'node:crypto';
import { readFileSync } from 'node:fs';

const str = (v) => String(v ?? '').trim();
const GIFT_ASSET_MAP = new Map((JSON.parse(readFileSync(new URL('./gift-asset-manifest.json', import.meta.url), 'utf8')).gifts || []).map(g => [str(g.name).toLowerCase(), g]));
const now = () => new Date().toISOString();
const safeInt = (v, fallback = 0) => Number.isSafeInteger(Number(v)) ? Number(v) : fallback;
const reactionsAllowed = new Set(['❤️', '👏', '🔥', '🎉', '😂', '🇯🇲']);
const audienceAllowed = new Set(['public', 'followers', 'private']);

async function roomAndUser(ctx, roomId) {
  let user = await ctx.requireSupabaseUser(ctx.req);
  const client = ctx.db();
  const { data: room, error } = await client.from('live_sessions').select('*').eq('id', roomId).maybeSingle();
  if (error) throw error;
  if (!room) throw ctx.fail(404, 'LIVE_ROOM_NOT_FOUND', 'LIVE room not found.');
  const host = String(room.host_id) === String(user.id);
  let moderator = false;
  if (!host) {
    const modResult = await client.from('live_room_moderators').select('user_id').eq('live_id', room.id).eq('user_id', user.id).maybeSingle();
    if (modResult.error && modResult.error.code !== '42P01') throw modResult.error;
    moderator = Boolean(modResult.data);
  }
  if (!host && !moderator) {
    if (room.status !== 'live') throw ctx.fail(403, 'LIVE_ACCESS_RESTRICTED', 'This LIVE is not available to this account.');
    const p = await client.from('profiles').select('privacy').eq('id', room.host_id).maybeSingle();
    if (p.error) throw p.error;
    const privateProfile = str(p.data?.privacy?.account || 'public') === 'private';
    let allowed = room.audience === 'public' && !privateProfile;
    if (!allowed && ['followers', 'public'].includes(room.audience)) {
      const f = await client.from('follows').select('follower_id').eq('follower_id', user.id).eq('followee_id', room.host_id).eq('status', 'accepted').maybeSingle();
      if (f.error) throw f.error;
      allowed = Boolean(f.data);
    }
    if (!allowed) {
      const g = await client.from('live_guests').select('id').eq('live_id', room.id).eq('user_id', user.id).in('status', ['invited', 'accepted']).maybeSingle();
      if (g.error) throw g.error;
      allowed = Boolean(g.data);
    }
    if (!allowed) throw ctx.fail(403, 'LIVE_ACCESS_RESTRICTED', 'This LIVE room is limited to its configured audience.');
  }
  return { user, room, client, isHost: host, isModerator: host || moderator };
}

function requireHost(ctx, room, user) {
  if (String(room.host_id) !== String(user.id)) throw ctx.fail(403, 'HOST_REQUIRED', 'Only the host can perform this action.');
}
function requireHostOrModerator(ctx, room, allowed) {
  if (!allowed) throw ctx.fail(403, 'MODERATOR_REQUIRED', 'The host or an approved moderator must perform this action.');
}
async function profilesFor(client, ids) {
  const unique = [...new Set((ids || []).map(str).filter(Boolean))];
  if (!unique.length) return new Map();
  const { data, error } = await client.from('profiles').select('id,username,display_name,avatar_url').in('id', unique);
  if (error) throw error;
  return new Map((data || []).map((p) => [String(p.id), p]));
}
function publicProfile(profile, id) {
  return { id: String(id || profile?.id || ''), username: profile?.username || null,
    displayName: profile?.display_name || profile?.username || 'Member', avatarUrl: profile?.avatar_url || null };
}

async function routeParticipants(ctx, state) {
  if (ctx.method !== 'GET') return null;
  const { client, room } = state;
  const { data: guests, error } = await client.from('live_guests')
    .select('user_id,status,mic_on,cam_on,slot,pinned,joined_at').eq('live_id', room.id)
    .in('status', ['invited', 'accepted']);
  if (error) throw error;
  const ids = [room.host_id, ...(guests || []).filter(g => g.status === 'accepted').map(g => g.user_id)];
  const profiles = await profilesFor(client, ids);
  let connected = [];
  if (process.env.LIVEKIT_URL && process.env.LIVEKIT_API_KEY && process.env.LIVEKIT_API_SECRET) {
    try {
      const { RoomServiceClient } = await import('livekit-server-sdk');
      const httpUrl = str(process.env.LIVEKIT_URL).replace(/^wss:/i, 'https:').replace(/^ws:/i, 'http:');
      connected = await new RoomServiceClient(httpUrl, process.env.LIVEKIT_API_KEY, process.env.LIVEKIT_API_SECRET).listParticipants(room.room_name);
    } catch (e) { console.warn('[LIVE] Participant refresh unavailable:', e?.message || e); }
  }
  const guestMap = new Map((guests || []).map(g => [String(g.user_id), g]));
  const participants = [...new Set(ids.map(String))].map(id => {
    const g = guestMap.get(id); const livekit = connected.find(p => String(p.identity) === id);
    return { ...publicProfile(profiles.get(id), id), role: id === String(room.host_id) ? 'host' : 'guest',
      status: id === String(room.host_id) ? (livekit ? 'connected' : room.status) : (g?.status || 'offline'),
      isConnected: Boolean(livekit), micOn: g ? Boolean(g.mic_on) : null, camOn: g ? Boolean(g.cam_on) : null,
      slot: g?.slot ?? null, pinned: g ? Boolean(g.pinned) : false };
  });
  return { participants };
}

async function routeModerators(ctx, state, id) {
  const { client, room, user, isHost } = state;
  if (ctx.method === 'GET' && !id) {
    const { data, error } = await client.from('live_room_moderators').select('live_id,user_id,granted_by,created_at').eq('live_id', room.id).order('created_at', { ascending: true });
    if (error) throw error;
    const profiles = await profilesFor(client, (data || []).map(x => x.user_id));
    return { moderators: (data || []).map(m => ({ ...m, profile: publicProfile(profiles.get(String(m.user_id)), m.user_id) })) };
  }
  if (!isHost) throw ctx.fail(403, 'HOST_REQUIRED', 'Only the host can manage moderators.');
  if (ctx.method === 'POST' && !id) {
    const body = await ctx.readJson(ctx.req); const userId = str(body.userId);
    if (!userId || userId === String(room.host_id)) throw ctx.fail(400, 'INVALID_MODERATOR', 'Choose another valid account.');
    const profile = await client.from('profiles').select('id').eq('id', userId).maybeSingle();
    if (profile.error) throw profile.error;
    if (!profile.data) throw ctx.fail(404, 'PROFILE_NOT_FOUND', 'The selected profile does not exist.');
    const { data, error } = await client.from('live_room_moderators').upsert({ live_id: room.id, user_id: userId, granted_by: user.id }, { onConflict: 'live_id,user_id' }).select('*').single();
    if (error) throw error;
    return { moderator: data };
  }
  if (ctx.method === 'DELETE' && id) {
    const { data, error } = await client.from('live_room_moderators').delete().eq('live_id', room.id).eq('user_id', id).select('user_id').maybeSingle();
    if (error) throw error;
    if (!data) throw ctx.fail(404, 'MODERATOR_NOT_FOUND', 'This moderator was not found.');
    return { removed: true, userId: data.user_id };
  }
  return null;
}

async function routePolls(ctx, state, pollId, action) {
  const { client, room, user, isModerator, isHost } = state;
  if (ctx.method === 'GET' && !pollId) {
    const { data, error } = await client.from('live_room_polls').select('id,live_id,host_id,kind,question,options,status,ends_at,created_at,updated_at').eq('live_id', room.id).order('created_at', { ascending: false }).limit(20);
    if (error) throw error;
    const polls = [];
    for (const p of data || []) {
      const [votes, mine] = await Promise.all([
        client.from('live_room_poll_votes').select('option_index', { count: 'exact' }).eq('poll_id', p.id),
        client.from('live_room_poll_votes').select('option_index').eq('poll_id', p.id).eq('user_id', user.id).maybeSingle()
      ]);
      if (votes.error) throw votes.error; if (mine.error) throw mine.error;
      const counts = Array(Array.isArray(p.options) ? p.options.length : 0).fill(0);
      for (const v of votes.data || []) if (v.option_index >= 0 && v.option_index < counts.length) counts[v.option_index]++;
      polls.push({ ...p, voteCounts: counts, myVote: mine.data?.option_index ?? null, totalVotes: votes.count ?? (votes.data || []).length });
    }
    return { polls };
  }
  if (ctx.method === 'POST' && !pollId) {
    if (!isHost) throw ctx.fail(403, 'HOST_REQUIRED', 'Only the host can create a poll or Q&A prompt.');
    if (room.status !== 'live') throw ctx.fail(409, 'LIVE_NOT_ACTIVE', 'Start LIVE before creating a poll.');
    const body = await ctx.readJson(ctx.req); const question = str(body.question).slice(0, 220);
    const kind = body.kind === 'qa' ? 'qa' : 'poll';
    const options = kind === 'qa' ? [] : (Array.isArray(body.options) ? body.options.map(x => str(x).slice(0, 80)).filter(Boolean).slice(0, 6) : []);
    if (!question) throw ctx.fail(400, 'POLL_QUESTION_REQUIRED', 'Enter a poll question.');
    if (kind === 'poll' && options.length < 2) throw ctx.fail(400, 'POLL_OPTIONS_REQUIRED', 'A poll needs at least two options.');
    const endTime = body.durationSeconds == null ? null : Date.now() + Math.max(30, Math.min(3600, safeInt(body.durationSeconds, 300))) * 1000;
    const { data, error } = await client.from('live_room_polls').insert({ live_id: room.id, host_id: user.id, kind, question, options, ends_at: endTime ? new Date(endTime).toISOString() : null }).select('*').single();
    if (error) throw error;
    return { poll: data };
  }
  if (!pollId) return null;
  const lookup = await client.from('live_room_polls').select('*').eq('live_id', room.id).eq('id', pollId).maybeSingle();
  if (lookup.error) throw lookup.error;
  if (!lookup.data) throw ctx.fail(404, 'POLL_NOT_FOUND', 'Poll not found.');
  const poll = lookup.data;
  if (action === 'vote' && ctx.method === 'POST') {
    if (poll.status !== 'active' || (poll.ends_at && Date.parse(poll.ends_at) <= Date.now())) throw ctx.fail(409, 'POLL_CLOSED', 'This poll is closed.');
    const body = await ctx.readJson(ctx.req); const optionIndex = Number(body.optionIndex);
    if (!Number.isSafeInteger(optionIndex) || optionIndex < 0 || optionIndex >= (poll.options || []).length) throw ctx.fail(400, 'INVALID_POLL_OPTION', 'Choose a valid poll option.');
    const { data, error } = await client.from('live_room_poll_votes').upsert({ poll_id: poll.id, user_id: user.id, option_index: optionIndex, updated_at: now() }, { onConflict: 'poll_id,user_id' }).select('*').single();
    if (error) throw error;
    return { vote: data };
  }
  if (action === 'close' && ctx.method === 'POST') {
    if (!isHost) throw ctx.fail(403, 'HOST_REQUIRED', 'Only the host can close this poll.');
    const { data, error } = await client.from('live_room_polls').update({ status: 'closed', updated_at: now() }).eq('id', poll.id).eq('status', 'active').select('*').maybeSingle();
    if (error) throw error;
    return { poll: data || { ...poll, status: 'closed' } };
  }
  return null;
}

async function routeQuestions(ctx, state, questionId, action) {
  const { client, room, user, isModerator } = state;
  if (ctx.method === 'GET' && !questionId) {
    const { data, error } = await client.from('live_room_questions').select('id,live_id,user_id,body,status,pinned,answered_at,created_at,updated_at').eq('live_id', room.id).order('pinned', { ascending: false }).order('created_at', { ascending: true }).limit(100);
    if (error) throw error;
    const profiles = await profilesFor(client, (data || []).map(q => q.user_id));
    return { questions: (data || []).map(q => ({ ...q, profile: publicProfile(profiles.get(String(q.user_id)), q.user_id) })) };
  }
  if (ctx.method === 'POST' && !questionId) {
    if (room.status !== 'live') throw ctx.fail(409, 'LIVE_NOT_ACTIVE', 'Questions are available while LIVE is active.');
    const body = await ctx.readJson(ctx.req); const text = str(body.body).slice(0, 500);
    if (text.length < 3) throw ctx.fail(400, 'QUESTION_REQUIRED', 'Enter a question of at least three characters.');
    const { data, error } = await client.from('live_room_questions').insert({ live_id: room.id, user_id: user.id, body: text }).select('*').single();
    if (error) throw error;
    return { question: data };
  }
  if (!questionId) return null;
  if (!isModerator) throw ctx.fail(403, 'MODERATOR_REQUIRED', 'Only the host or an approved moderator can manage questions.');
  if (action === 'pin' && ctx.method === 'POST') {
    const body = await ctx.readJson(ctx.req); const pinned = body.pinned !== false;
    const { data, error } = await client.from('live_room_questions').update({ pinned, updated_at: now() }).eq('id', questionId).eq('live_id', room.id).select('*').maybeSingle();
    if (error) throw error; if (!data) throw ctx.fail(404, 'QUESTION_NOT_FOUND', 'Question not found.');
    return { question: data };
  }
  if (action === 'answer' && ctx.method === 'POST') {
    const { data, error } = await client.from('live_room_questions').update({ status: 'answered', answered_at: now(), updated_at: now() }).eq('id', questionId).eq('live_id', room.id).select('*').maybeSingle();
    if (error) throw error; if (!data) throw ctx.fail(404, 'QUESTION_NOT_FOUND', 'Question not found.');
    return { question: data };
  }
  if (ctx.method === 'DELETE' && !action) {
    const { data, error } = await client.from('live_room_questions').delete().eq('id', questionId).eq('live_id', room.id).select('id').maybeSingle();
    if (error) throw error; if (!data) throw ctx.fail(404, 'QUESTION_NOT_FOUND', 'Question not found.');
    return { deleted: true, id: data.id };
  }
  return null;
}

async function routeReactions(ctx, state) {
  const { client, room, user } = state;
  if (ctx.method === 'GET') {
    const { data, error } = await client.from('live_room_reactions').select('id,user_id,reaction,created_at').eq('live_id', room.id).gte('created_at', new Date(Date.now() - 60_000).toISOString()).order('created_at', { ascending: true }).limit(200);
    if (error) throw error;
    const profiles = await profilesFor(client, (data || []).map(r => r.user_id));
    return { reactions: (data || []).map(r => ({ ...r, profile: publicProfile(profiles.get(String(r.user_id)), r.user_id) })) };
  }
  if (ctx.method === 'POST') {
    if (room.status !== 'live') throw ctx.fail(409, 'LIVE_NOT_ACTIVE', 'Reactions are available while LIVE is active.');
    const body = await ctx.readJson(ctx.req); const reaction = str(body.reaction);
    if (!reactionsAllowed.has(reaction)) throw ctx.fail(400, 'REACTION_INVALID', 'Choose an available reaction.');
    const recent = await client.from('live_room_reactions').select('id', { count: 'exact', head: true }).eq('live_id', room.id).eq('user_id', user.id).gte('created_at', new Date(Date.now() - 3000).toISOString());
    if (recent.error) throw recent.error;
    if (safeInt(recent.count) >= 4) throw ctx.fail(429, 'REACTION_RATE_LIMITED', 'Please slow down your reactions.');
    const { data, error } = await client.from('live_room_reactions').insert({ live_id: room.id, user_id: user.id, reaction }).select('*').single();
    if (error) throw error;
    return { reaction: data };
  }
  return null;
}

async function routeSettings(ctx, state) {
  const { client, room, isHost } = state;
  if (ctx.method === 'GET') return { settings: { title: room.title, category: room.category, audience: room.audience || 'public', allowGuests: room.allow_guests !== false, coverImageUrl: room.cover_image_url || null } };
  if (!isHost || !['PATCH', 'POST'].includes(ctx.method)) return null;
  const body = await ctx.readJson(ctx.req); const patch = { updated_at: now() };
  if (body.title !== undefined) { const title = str(body.title).slice(0, 200); if (!title) throw ctx.fail(400, 'TITLE_REQUIRED', 'Enter a room title.'); patch.title = title; }
  if (body.category !== undefined) patch.category = str(body.category).slice(0, 60) || null;
  if (body.audience !== undefined) { if (!audienceAllowed.has(body.audience)) throw ctx.fail(400, 'INVALID_AUDIENCE', 'Audience must be public, followers or private.'); patch.audience = body.audience; }
  if (body.allowGuests !== undefined) patch.allow_guests = Boolean(body.allowGuests);
  if (body.coverImageUrl !== undefined) { const url = str(body.coverImageUrl); if (url && (url.length > 500 || !/^https:\/\//i.test(url))) throw ctx.fail(400, 'INVALID_COVER_URL', 'Cover image must be a valid HTTPS URL.'); patch.cover_image_url = url || null; }
  if (Object.keys(patch).length === 1) throw ctx.fail(400, 'SETTINGS_EMPTY', 'Change at least one room setting.');
  const { data, error } = await client.from('live_sessions').update(patch).eq('id', room.id).eq('host_id', state.user.id).select('*').single();
  if (error) throw error;
  return { settings: { title: data.title, category: data.category, audience: data.audience, allowGuests: data.allow_guests, coverImageUrl: data.cover_image_url } };
}

async function routeAnalytics(ctx, state) {
  if (ctx.method !== 'GET') return null;
  requireHostOrModerator(ctx, state.room, state.isModerator);
  const { client, room } = state;
  const [chat, guests, gifts] = await Promise.all([
    client.from('live_chat_messages').select('id', { count: 'exact', head: true }).eq('live_id', room.id),
    client.from('live_guests').select('user_id', { count: 'exact', head: true }).eq('live_id', room.id).eq('status', 'accepted'),
    client.from('gift_transactions').select('coin_cost,diamond_value,id').eq('live_id', room.id)
  ]);
  for (const r of [chat, guests, gifts]) if (r.error) throw r.error;
  const totals = (gifts.data || []).reduce((a, g) => ({ count: a.count + 1, coins: a.coins + safeInt(g.coin_cost), diamonds: a.diamonds + safeInt(g.diamond_value) }), { count: 0, coins: 0, diamonds: 0 });
  const started = room.started_at ? Date.parse(room.started_at) : NaN; const end = room.ended_at ? Date.parse(room.ended_at) : Date.now();
  return { analytics: { liveId: room.id, status: room.status, durationSeconds: Number.isFinite(started) ? Math.max(0, Math.floor((end-started)/1000)) : null,
    chatMessages: safeInt(chat.count), activeGuests: safeInt(guests.count), giftsReceived: totals.count, giftCoins: totals.coins, giftDiamonds: totals.diamonds, measuredAt: now() } };
}

async function routeGiftEvents(ctx, state) {
  if (ctx.method !== 'GET') return null;
  const { client, room } = state;
  const { data, error } = await client.from('gift_transactions').select('id,gift_id,sender_id,recipient_id,coin_cost,diamond_value,created_at,gifts(name,emoji,asset_key,animation_url,sound_url,category)').eq('live_id', room.id).order('created_at', { ascending: false }).limit(40);
  if (error) throw error;
  const rows = (data || []).slice().reverse();
  const profiles = await profilesFor(client, rows.flatMap(r => [r.sender_id, r.recipient_id]));
  return { events: rows.map(r => { const g = r.gifts || {}; const meta = GIFT_ASSET_MAP.get(str(g.name).toLowerCase()); const key = str(g.asset_key || meta?.assetKey); return {
    id: r.id, giftName: g.name || 'Gift', emoji: g.emoji || meta?.emoji || null, assetKey: key || null, category: g.category || meta?.category || null,
    animationUrl: g.animation_url || (key ? `/assets/gifts/animations/${key}.svg` : null), soundUrl: g.sound_url || (key ? `/assets/gifts/sounds/${key}.wav` : null),
    coinCost: r.coin_cost == null ? null : Number(r.coin_cost), diamondValue: r.diamond_value == null ? null : Number(r.diamond_value),
    senderId: String(r.sender_id), sender: publicProfile(profiles.get(String(r.sender_id)), r.sender_id), recipient: publicProfile(profiles.get(String(r.recipient_id)), r.recipient_id), createdAt: r.created_at
  }; }) };
}

async function routeChatModeration(ctx, state, messageId, action) {
  const { client, room, user, isModerator } = state;
  if (ctx.method === 'POST' && action === 'report') {
    const body = await ctx.readJson(ctx.req); const targetId = str(body.messageId || messageId); const reason = str(body.reason || 'LIVE chat report').slice(0, 500);
    if (!targetId) throw ctx.fail(400, 'MESSAGE_ID_REQUIRED', 'Choose a chat message to report.');
    const target = await client.from('live_chat_messages').select('id').eq('id', targetId).eq('live_id', room.id).maybeSingle();
    if (target.error) throw target.error; if (!target.data) throw ctx.fail(404, 'MESSAGE_NOT_FOUND', 'Chat message not found.');
    const { data, error } = await client.from('reports').insert({ reporter_id: user.id, target_type: 'live_chat_message', target_id: targetId, reason, status: 'open' }).select('id,status,created_at').single();
    if (error) throw error;
    return { report: data };
  }
  if (ctx.method === 'POST' && action === 'delete') {
    requireHostOrModerator(ctx, room, isModerator);
    const { data, error } = await client.from('live_chat_messages').delete().eq('id', messageId).eq('live_id', room.id).select('id').maybeSingle();
    if (error) throw error; if (!data) throw ctx.fail(404, 'MESSAGE_NOT_FOUND', 'Chat message not found.');
    return { deleted: true, messageId: data.id };
  }
  return null;
}

// Private S3-compatible recording storage. The signing code deliberately uses
// server-only credentials and never returns bucket keys or long-lived credentials.
function recordingConfig() {
  return { bucket: str(process.env.LIVE_RECORDING_S3_BUCKET), region: str(process.env.LIVE_RECORDING_S3_REGION || process.env.AWS_REGION),
    accessKey: str(process.env.LIVE_RECORDING_S3_ACCESS_KEY || process.env.AWS_ACCESS_KEY_ID), secretKey: str(process.env.LIVE_RECORDING_S3_SECRET_KEY || process.env.AWS_SECRET_ACCESS_KEY),
    endpoint: str(process.env.LIVE_RECORDING_S3_ENDPOINT), forcePathStyle: str(process.env.LIVE_RECORDING_S3_FORCE_PATH_STYLE).toLowerCase() === 'true' };
}
function requireRecordingConfig(ctx) {
  const cfg = recordingConfig();
  if (!process.env.LIVEKIT_URL || !process.env.LIVEKIT_API_KEY || !process.env.LIVEKIT_API_SECRET) throw ctx.fail(503, 'LIVEKIT_NOT_CONFIGURED', 'Configure server-side LiveKit credentials before recording.');
  if (!cfg.bucket || !cfg.region || !cfg.accessKey || !cfg.secretKey) throw ctx.fail(503, 'RECORDING_STORAGE_NOT_CONFIGURED', 'Configure private S3-compatible recording storage before recording.');
  return cfg;
}
const enc = (v) => encodeURIComponent(String(v)).replace(/[!'()*]/g, c => '%' + c.charCodeAt(0).toString(16).toUpperCase());
function objectUrl(key, cfg) {
  const clean = String(key).split('/').map(enc).join('/');
  if (cfg.endpoint) { const u = new URL(cfg.endpoint); const base = u.pathname.replace(/\/$/, ''); if (cfg.forcePathStyle || !u.hostname.includes('amazonaws.com')) { u.pathname = `${base}/${enc(cfg.bucket)}/${clean}`.replace(/\/+/g, '/'); } else { u.hostname = `${cfg.bucket}.${u.hostname}`; u.pathname = `${base}/${clean}`.replace(/\/+/g, '/'); } return u; }
  return cfg.forcePathStyle ? new URL(`https://s3.${cfg.region}.amazonaws.com/${enc(cfg.bucket)}/${clean}`) : new URL(`https://${cfg.bucket}.s3.${cfg.region}.amazonaws.com/${clean}`);
}
const sha = x => createHash('sha256').update(x).digest('hex');
const hmac = (k, x, encoding) => createHmac('sha256', k).update(x).digest(encoding);
function signKey(secret, date, region) { return hmac(hmac(hmac(hmac(`AWS4${secret}`, date), region), 's3'), 'aws4_request'); }
function canonicalQuery(params) { return [...params.entries()].map(([k,v]) => [enc(k),enc(v)]).sort((a,b) => a[0].localeCompare(b[0]) || a[1].localeCompare(b[1])).map(([k,v]) => `${k}=${v}`).join('&'); }
function signedStorageUrl(key, expires = 300, filename = 'creator-hub-live-recording.mp4') {
  const cfg = recordingConfig(); const url = objectUrl(key,cfg); const date = new Date(); const amzDate = date.toISOString().replace(/[:-]|\.\d{3}/g,''); const shortDate = amzDate.slice(0,8); const scope = `${shortDate}/${cfg.region}/s3/aws4_request`;
  const safeName = str(filename).replace(/[^A-Za-z0-9._-]/g,'_').slice(0,140) || 'creator-hub-live-recording.mp4';
  const params = new URLSearchParams({ 'X-Amz-Algorithm':'AWS4-HMAC-SHA256','X-Amz-Credential':`${cfg.accessKey}/${scope}`,'X-Amz-Date':amzDate,'X-Amz-Expires':String(expires),'X-Amz-SignedHeaders':'host','response-content-disposition':`attachment; filename="${safeName}"`,'response-content-type':'video/mp4' });
  const query = canonicalQuery(params); const request = `GET\n${url.pathname}\n${query}\nhost:${url.host}\n\nhost\nUNSIGNED-PAYLOAD`; const toSign = `AWS4-HMAC-SHA256\n${amzDate}\n${scope}\n${sha(request)}`;
  url.search = `${query}&X-Amz-Signature=${hmac(signKey(cfg.secretKey,shortDate,cfg.region),toSign,'hex')}`; return url.toString();
}
async function storageRequest(method, key) {
  const cfg = recordingConfig(); const url = objectUrl(key,cfg); const date = new Date(); const amzDate = date.toISOString().replace(/[:-]|\.\d{3}/g,''); const shortDate = amzDate.slice(0,8); const payloadHash = sha(''); const scope = `${shortDate}/${cfg.region}/s3/aws4_request`;
  const canonicalHeaders = `host:${url.host}\nx-amz-content-sha256:${payloadHash}\nx-amz-date:${amzDate}\n`; const signedHeaders = 'host;x-amz-content-sha256;x-amz-date';
  const canonical = `${method}\n${url.pathname}\n${canonicalQuery(url.searchParams)}\n${canonicalHeaders}${signedHeaders}\n${payloadHash}`; const toSign = `AWS4-HMAC-SHA256\n${amzDate}\n${scope}\n${sha(canonical)}`;
  const signature = hmac(signKey(cfg.secretKey,shortDate,cfg.region),toSign,'hex'); const authorization = `AWS4-HMAC-SHA256 Credential=${cfg.accessKey}/${scope}, SignedHeaders=${signedHeaders}, Signature=${signature}`;
  const response = await fetch(url,{ method, headers:{ Authorization:authorization,'x-amz-content-sha256':payloadHash,'x-amz-date':amzDate } });
  if (!response.ok && !(method === 'DELETE' && response.status === 404)) throw Object.assign(new Error(`Recording storage returned HTTP ${response.status}.`),{ status:502, code:'RECORDING_STORAGE_REQUEST_FAILED' });
  return response;
}
async function livekitEgress(ctx) {
  requireRecordingConfig(ctx);
  const sdk = await import('livekit-server-sdk');
  const httpUrl = str(process.env.LIVEKIT_URL).replace(/^wss:/i,'https:').replace(/^ws:/i,'http:');
  const egress = new sdk.EgressClient(httpUrl,process.env.LIVEKIT_API_KEY,process.env.LIVEKIT_API_SECRET);
  return { egress, sdk };
}
function egressStatus(info) {
  const raw = info?.status;
  if (typeof raw === 'number' || /^\d+$/.test(String(raw || ''))) { const c = Number(raw); if (c === 3) return 'ready'; if (c >= 4 && c <= 6) return 'failed'; if (c === 1 || c === 2) return 'recording'; return 'processing'; }
  const v = str(raw).toUpperCase(); if (v.includes('COMPLETE')) return 'ready'; if (['FAILED','ABORTED','LIMIT_REACHED'].some(x=>v.includes(x))) return 'failed'; if (v.includes('ACTIVE')) return 'recording'; return 'processing';
}
async function refreshRecordingStatus(ctx, client, row) {
  if (!row.egress_id || !['recording', 'processing'].includes(row.status)) return row;
  try {
    const { egress } = await livekitEgress(ctx);
    const list = await egress.listEgress({ egressId: row.egress_id });
    const info = (list || []).find(x => String(x.egressId || x.egress_id) === String(row.egress_id)) || (list || [])[0];
    if (!info) {
      // LiveKit may omit completed jobs from its active list. A private object
      // HEAD is the evidence that the MP4 upload actually finished.
      const object = await storageRequest('HEAD', row.storage_key);
      const patch = { status: 'ready', ended_at: row.ended_at || now(), expires_at: row.expires_at || new Date(Date.now()+30*86400000).toISOString(), updated_at: now() };
      const size = Number(object.headers.get('content-length')); if (Number.isSafeInteger(size) && size >= 0) patch.file_size_bytes = size;
      const result = await client.from('live_room_recordings').update(patch).eq('id', row.id).select('*').single();
      if (!result.error && result.data) return result.data;
      return row;
    }
    const status = egressStatus(info); const file = Array.isArray(info.fileResults) ? info.fileResults[0] : null;
    const patch = { status, updated_at: now() };
    if (status === 'ready' || status === 'failed') { patch.ended_at = row.ended_at || now(); patch.expires_at = row.expires_at || new Date(Date.now()+30*86400000).toISOString(); }
    if (status === 'ready') { if (file?.filename) patch.storage_key = String(file.filename); if (Number.isFinite(Number(file?.size))) patch.file_size_bytes = Number(file.size); if (Number.isFinite(Number(file?.duration))) patch.duration_ms = Number(file.duration); }
    if (status === 'failed') patch.failure_reason = str(info.error || info.errorMessage || 'LiveKit Egress failed.').slice(0, 1000);
    const result = await client.from('live_room_recordings').update(patch).eq('id', row.id).select('*').single();
    if (!result.error && result.data) return result.data;
  } catch (e) {
    // Keep listing usable when the optional recording integration is offline.
    console.warn('[LIVE recording] Status refresh deferred:', e?.message || e);
  }
  return row;
}
async function routeRecordings(ctx,state,id,action) {
  const { client,room,user,isHost } = state; if (!isHost) throw ctx.fail(403,'HOST_REQUIRED','Only the host can access, control or delete recordings.');
  if (ctx.method === 'GET' && !id) {
    const { data,error } = await client.from('live_room_recordings').select('id,live_id,host_id,egress_id,storage_key,status,started_at,ended_at,expires_at,file_size_bytes,duration_ms,failure_reason,created_at,updated_at').eq('live_id',room.id).neq('status','deleted').order('created_at',{ascending:false}).limit(50);
    if (error) throw error;
    const refreshed = [];
    for (const row of data || []) refreshed.push(await refreshRecordingStatus(ctx, client, row));
    return { recordings: refreshed.map(r => ({ id:r.id, live_id:r.live_id, status:r.status, started_at:r.started_at, ended_at:r.ended_at, expires_at:r.expires_at, file_size_bytes:r.file_size_bytes, duration_ms:r.duration_ms, failure_reason:r.failure_reason, created_at:r.created_at, updated_at:r.updated_at })) };
  }
  if (ctx.method === 'POST' && id === 'start' && !action) {
    if (room.status !== 'live') throw ctx.fail(409,'LIVE_NOT_ACTIVE','Start LIVE before recording.');
    const { egress,sdk } = await livekitEgress(ctx);
    const current = await client.from('live_room_recordings').select('id,status').eq('live_id',room.id).in('status',['processing','recording']).limit(1);
    if (current.error) throw current.error; if ((current.data||[]).length) throw ctx.fail(409,'RECORDING_ALREADY_ACTIVE','A recording is already running or being finalized.');
    const key = `creator-hub-live/${room.id}/${randomUUID().replace(/-/g,'')}.mp4`;
    const { data:row,error:insertError } = await client.from('live_room_recordings').insert({live_id:room.id,host_id:user.id,storage_key:key,status:'processing'}).select('*').single();
    if (insertError) throw insertError;
    const cfg = recordingConfig(); const opts = { accessKey:cfg.accessKey,secret:cfg.secretKey,bucket:cfg.bucket,region:cfg.region,forcePathStyle:cfg.forcePathStyle }; if (cfg.endpoint) opts.endpoint=cfg.endpoint;
    try {
      const output = new sdk.EncodedFileOutput({ fileType:sdk.EncodedFileType.MP4,disableManifest:true,filepath:key,output:{case:'s3',value:new sdk.S3Upload(opts)} });
      const info = await egress.startRoomCompositeEgress(room.room_name,{file:output},{layout:'speaker'});
      const {data,error} = await client.from('live_room_recordings').update({egress_id:String(info.egressId||info.egress_id||''),status:egressStatus(info),updated_at:now()}).eq('id',row.id).select('id,live_id,status,started_at,created_at').single();
      if(error) throw error; return { recording:data };
    } catch(e) {
      await client.from('live_room_recordings').update({status:'failed',ended_at:now(),expires_at:new Date(Date.now()+30*86400000).toISOString(),failure_reason:str(e?.message||'Recording failed.').slice(0,1000),updated_at:now()}).eq('id',row.id);
      throw ctx.fail(502,'RECORDING_START_FAILED','LiveKit could not start recording. Check LiveKit Egress and private recording-storage configuration.');
    }
  }
  if (!id) return null;
  const { data:row,error:lookupError } = await client.from('live_room_recordings').select('*').eq('id',id).eq('live_id',room.id).maybeSingle();
  if (lookupError) throw lookupError; if (!row || row.status === 'deleted') throw ctx.fail(404,'RECORDING_NOT_FOUND','Recording not found.');
  if (action === 'stop' && ctx.method === 'POST') {
    if (!row.egress_id || !['recording','processing'].includes(row.status)) return { recording:{id:row.id,status:row.status} };
    const {egress}=await livekitEgress(ctx); await egress.stopEgress(row.egress_id);
    const {data,error}=await client.from('live_room_recordings').update({status:'processing',ended_at:now(),updated_at:now()}).eq('id',row.id).select('id,status,ended_at').single(); if(error) throw error; return {recording:data};
  }
  if (action === 'download' && ctx.method === 'GET') {
    if (row.status !== 'ready') throw ctx.fail(409,'RECORDING_NOT_READY','The recording is not ready to download yet. Refresh the recording list shortly.');
    if (row.expires_at && Date.parse(row.expires_at) <= Date.now()) throw ctx.fail(410,'RECORDING_EXPIRED','This recording has expired.');
    requireRecordingConfig(ctx); return { downloadUrl:signedStorageUrl(row.storage_key,300,`creator-hub-live-${row.id}.mp4`), expiresInSeconds:300 };
  }
  if (ctx.method === 'DELETE' && !action) {
    requireRecordingConfig(ctx);
    try { await storageRequest('DELETE',row.storage_key); }
    catch(e) { if (e?.code === 'RECORDING_STORAGE_REQUEST_FAILED') throw e; throw ctx.fail(502,'RECORDING_DELETE_FAILED','Private recording storage could not delete the file.'); }
    const {error}=await client.from('live_room_recordings').update({status:'deleted',deleted_at:now(),updated_at:now()}).eq('id',row.id); if(error) throw error;
    return { deleted:true, recordingId:row.id };
  }
  return null;
}

async function routeSchedule(ctx) {
  const m=ctx.pathname.match(/^\/api\/live-experience\/schedules(?:\/([^/]+)(?:\/(cancel))?)?\/?$/); if(!m) return false;
  const user=await ctx.requireSupabaseUser(ctx.req); const client=ctx.db();
  if(ctx.method==='GET'&&!m[1]) { const {data,error}=await client.from('live_schedules').select('id,creator_id,title,description,category,starts_at,audience,notify_followers,status,created_at').eq('creator_id',user.id).order('starts_at',{ascending:true}).limit(50); if(error) throw error; ctx.ok(ctx.res,{schedules:data||[]}); return true; }
  if(ctx.method==='POST'&&!m[1]) { const b=await ctx.readJson(ctx.req); const title=str(b.title).slice(0,160); const starts=Date.parse(b.startsAt||''); const audience=audienceAllowed.has(b.audience)?b.audience:'public'; if(!title) throw ctx.fail(400,'SCHEDULE_TITLE_REQUIRED','Enter a LIVE schedule title.'); if(!Number.isFinite(starts)||starts<=Date.now()+60000) throw ctx.fail(400,'SCHEDULE_TIME_INVALID','Choose a start time at least one minute in the future.');
    const {data,error}=await client.from('live_schedules').insert({creator_id:user.id,title,description:str(b.description).slice(0,1200),category:str(b.category||'Just Chatting').slice(0,60),starts_at:new Date(starts).toISOString(),audience,notify_followers:b.notifyFollowers!==false}).select('*').single(); if(error) throw error; ctx.ok(ctx.res,{schedule:data}); return true; }
  if(ctx.method==='POST'&&m[1]&&m[2]==='cancel') { const {data,error}=await client.from('live_schedules').update({status:'cancelled',updated_at:now()}).eq('id',m[1]).eq('creator_id',user.id).eq('status','scheduled').select('*').maybeSingle(); if(error) throw error; if(!data) throw ctx.fail(404,'SCHEDULE_NOT_FOUND','A cancellable LIVE schedule was not found.'); ctx.ok(ctx.res,{schedule:data}); return true; }
  return false;
}

export async function handleLiveRoomExperience(ctx) {
  if (await routeSchedule(ctx)) return true;
  if (ctx.pathname === '/api/live-experience/maintenance/recordings/cleanup' && ctx.method === 'POST') {
    const expected=str(process.env.LIVE_RECORDING_CLEANUP_SECRET), supplied=str(ctx.req.headers['x-live-recording-cleanup-secret']);
    if (!expected || !supplied || Buffer.byteLength(expected)!==Buffer.byteLength(supplied) || !timingSafeEqual(Buffer.from(expected),Buffer.from(supplied))) throw ctx.fail(401,'CLEANUP_UNAUTHORIZED','Recording cleanup service authorization failed.');
    const cfg=recordingConfig(); if(!cfg.bucket||!cfg.region||!cfg.accessKey||!cfg.secretKey) throw ctx.fail(503,'RECORDING_STORAGE_NOT_CONFIGURED','Configure private recording storage before cleanup.');
    const client=ctx.db(); const {data,error}=await client.from('live_room_recordings').select('id,storage_key').in('status',['ready','failed']).lte('expires_at',now()).limit(200); if(error) throw error;
    let deleted=0; const failures=[]; for(const row of data||[]) { try { await storageRequest('DELETE',row.storage_key); const u=await client.from('live_room_recordings').update({status:'deleted',deleted_at:now(),updated_at:now()}).eq('id',row.id); if(u.error) throw u.error; deleted++; } catch(e) { failures.push({id:row.id,error:str(e?.message||e).slice(0,200)}); } }
    ctx.ok(ctx.res,{processed:(data||[]).length,deleted,failures,retentionDays:30}); return true;
  }
  const m=ctx.pathname.match(/^\/api\/live\/rooms\/([^/]+)\/(participants|gift-events|polls|questions|moderators|analytics|recordings|settings|chat-moderation|reactions)(?:\/([^/]+))?(?:\/([^/]+))?\/?$/);
  if(!m) return false;
  let roomId; let id; let action; try { roomId=decodeURIComponent(m[1]); id=m[3]?decodeURIComponent(m[3]):null; action=m[4]?decodeURIComponent(m[4]):null; } catch { throw ctx.fail(400,'INVALID_ROOM','LIVE room route contains invalid encoding.'); }
  const state=await roomAndUser(ctx,roomId); let result=null; const resource=m[2];
  if(resource==='participants') result=await routeParticipants(ctx,state);
  else if(resource==='gift-events') result=await routeGiftEvents(ctx,state);
  else if(resource==='polls') result=await routePolls(ctx,state,id,action);
  else if(resource==='questions') result=await routeQuestions(ctx,state,id,action);
  else if(resource==='moderators') result=await routeModerators(ctx,state,id);
  else if(resource==='analytics') result=await routeAnalytics(ctx,state);
  else if(resource==='recordings') result=await routeRecordings(ctx,state,id,action);
  else if(resource==='settings') result=await routeSettings(ctx,state);
  else if(resource==='chat-moderation') result=await routeChatModeration(ctx,state,id,action);
  else if(resource==='reactions') result=await routeReactions(ctx,state);
  if(result===null||result===undefined) return false;
  ctx.ok(ctx.res,result); return true;
}
