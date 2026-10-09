  // Continuation from your original file state...
  const authClient = createClient(
    SUPABASE_URL,
    SUPABASE_ANON_KEY,
    {
      auth: {
        persistSession: false,
        autoRefreshToken: false
      }
    }
  );

  const { data: { user }, error } = await authClient.auth.getUser(token);

  if (error || !user) {
    throw fail(
      401,
      'AUTH_INVALID',
      'Session has expired or is invalid.',
      error ? { message: error.message } : undefined
    );
  }

  return user;
}

// ============================================================================
// Core Application Route Handlers
// ============================================================================

/**
 * POST /api/livekit/token
 * Generates short-lived WebRTC join tokens for hosts and viewers
 */
async function handleGetToken(req, res) {
  const user = await requireSupabaseUser(req);
  const body = await readJson(req);

  const roomName = String(body.roomName || '').trim();
  const canPublish = body.canPublish === true;
  const ttlSeconds = body.ttlSeconds;

  if (!roomName || !validateRoomName(roomName)) {
    throw fail(400, 'INVALID_ROOM', 'A valid live room alphanumeric identifier is required.');
  }

  // Cross-reference database state: Verify if the user has authorization to host this session
  if (canPublish) {
    const supabase = db();
    const { data: session, error } = await supabase
      .from('live_sessions')
      .select('host_id, status')
      .eq('room_name', roomName)
      .maybeSingle();

    if (error) throw error;
    
    // Safety check: Block unauthorized users attempting to inject host privileges
    if (!session || String(session.host_id) !== String(user.id)) {
      throw fail(403, 'FORBIDDEN_HOST', 'You are not authorized to start a stream for this room.');
    }
  }

  const token = await createLiveKitToken({
    userId: user.id,
    roomName,
    canPublish,
    ttlSeconds
  });

  return ok(res, {
    token,
    serverUrl: LIVEKIT_URL,
    roomName,
    canPublish
  });
}

/**
 * POST /api/livekit/verify-live
 * Server-authoritative step: host updates database state to "LIVE" 
 * only AFTER confirming active media tracks have reached the SFU.
 */
async function handleVerifyLive(res, req) {
  const user = await requireSupabaseUser(req);
  const body = await readJson(req);

  const roomName = String(body.roomName || '').trim();

  if (!roomName) {
    throw fail(400, 'INVALID_ROOM', 'Room name is required.');
  }

  const supabase = db();

  // Validate user ownership over the session record
  const { data: session, error: fetchErr } = await supabase
    .from('live_sessions')
    .select('id, host_id')
    .eq('room_name', roomName)
    .maybeSingle();

  if (fetchErr) throw fetchErr;
  if (!session || String(session.host_id) !== String(user.id)) {
    throw fail(403, 'FORBIDDEN_HOST', 'Ownership validation failed for this live session room.');
  }

  // Authoritative WebRTC verification layer checking SFU hardware streams directly
  const verification = await verifyHostPublishing(roomName, user.id);

  // Safely update relational database parameters now that the broadcast state is confirmed
  const { error: updateErr } = await supabase
    .from('live_sessions')
    .update({
      status: 'live',
      started_at: new Date().toISOString(),
      active_tracks: verification.trackCount
    })
    .eq('id', session.id);

  if (updateErr) throw updateErr;

  return ok(res, {
    verified: true,
    status: 'live',
    ...verification
  });
}

/**
 * GET /api/health
 * Simple diagnostic routing path
 */
function handleHealth(res) {
  const status = livekitHealth();
  return ok(res, {
    status: 'healthy',
    timestamp: new Date().toISOString(),
    livekit: status
  });
}

// ============================================================================
// Native Node.js Routing Engine Initialization
// ============================================================================

const server = http.createServer(async (req, res) => {
  try {
    applyCors(req, res);

    const parsedUrl = new URL(req.url || '', `http://${req.headers.host || 'localhost'}`);
    const pathname = parsedUrl.pathname;
    const method = req.method || 'GET';

    // Handle preflight requests gracefully
    if (method === 'OPTIONS') {
      res.writeHead(204, secureHeaders());
      return res.end();
    }

    // Explicit structural endpoint map routing matrix
    if (pathname === '/api/health' && method === 'GET') {
      return handleHealth(res);
    }
    
    if (pathname === '/api/livekit/token' && method === 'POST') {
      return await handleGetToken(req, res);
    }

    if (pathname === '/api/livekit/verify-live' && method === 'POST') {
      return await handleVerifyLive(res, req);
    }

    // Default 404 Route handler fallthrough
    throw fail(404, 'NOT_FOUND', `Route [${method}] ${pathname} does not exist.`);

  } catch (err) {
    return errorResponse(res, err);
  }
});

// Boot the listening engine context
server.listen(PORT, () => {
  console.log(`[Creator Hub Engine] Server live on interface port: ${PORT}`);
  console.log(`[Creator Hub Engine] System configured for base origin: ${FRONTEND_URL}`);
});
