import 'dotenv/config';
import http from 'node:http';
import { URL } from 'node:url';
import { createClient } from '@supabase/supabase-js';
import {
  createLiveKitToken,
  validateRoomName,
  livekitHealth,
  verifyHostPublishing
} from './livekit-token.js';

// ============================================================================
// Creator Hub Creator Network
// Backend HTTP API
//
// IMPORTANT:
// - Server-authoritative authentication
// - Server-authoritative LIVE state
// - Server-authoritative wallet/payment operations
// - Supabase service-role credentials remain server-side
// - No fabricated production data
// ============================================================================

const PORT = Number(process.env.PORT || 3000);

const FRONTEND_URL = String(
  process.env.FRONTEND_URL ||
  process.env.NEXT_PUBLIC_APP_URL ||
  ''
).replace(/\/$/, '');

const SUPABASE_URL =
  process.env.SUPABASE_URL ||
  process.env.NEXT_PUBLIC_SUPABASE_URL ||
  '';

const SUPABASE_ANON_KEY =
  process.env.SUPABASE_ANON_KEY ||
  process.env.SUPABASE_KEY ||
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
  '';

const SUPABASE_SERVICE_ROLE_KEY =
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  '';

const PAYPAL_ENV = String(
  process.env.PAYPAL_ENV ||
  process.env.PAYPAL_MODE ||
  'sandbox'
).toLowerCase();

const PAYPAL_CLIENT_ID =
  process.env.PAYPAL_CLIENT_ID ||
  '';

const PAYPAL_CLIENT_SECRET =
  process.env.PAYPAL_CLIENT_SECRET ||
  '';

const PAYPAL_WEBHOOK_ID =
  process.env.PAYPAL_WEBHOOK_ID ||
  '';

const PAYPAL_BASE =
  PAYPAL_ENV === 'live'
    ? 'https://api-m.paypal.com'
    : 'https://api-m.sandbox.paypal.com';

const PAYPAL_RETURN_URL = String(
  process.env.PAYPAL_RETURN_URL ||
  (FRONTEND_URL ? FRONTEND_URL.split(',')[0] : '') ||
  ''
).replace(/\/$/, '');

const LIVEKIT_URL =
  process.env.LIVEKIT_URL ||
  'wss://creator-hub-live-9susyfri.livekit.cloud';


// ============================================================================
// Generic helpers
// ============================================================================

function fail(status, code, message, details = undefined) {
  const error = new Error(String(message || 'Request failed.'));
  error.status = Number(status) || 500;
  error.code = String(code || 'INTERNAL_ERROR');

  if (details !== undefined) {
    error.details = details;
  }

  return error;
}

function secureHeaders(extra = {}) {
  return {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'DENY',
    'Referrer-Policy': 'no-referrer',
    ...extra
  };
}

function send(res, status, body, extra = {}) {
  if (res.headersSent) {
    return;
  }

  res.writeHead(status, secureHeaders(extra));
  res.end(JSON.stringify(body));
}

function ok(res, body = {}) {
  return send(res, 200, {
    ok: true,
    ...body
  });
}


// ---------------------------------------------------------------------------
// Supabase error normalization
//
// Supabase errors are structured objects. Converting one directly with
// String(error) produces "[object Object]". This function preserves the useful
// diagnostic fields without exposing secrets.
// ---------------------------------------------------------------------------

function normalizeExternalError(error) {
  if (!error) {
    return {
      message: 'Unknown error.',
      code: undefined,
      details: undefined,
      hint: undefined,
      name: undefined
    };
  }

  if (error instanceof Error) {
    return {
      message: error.message || 'Unknown error.',
      code: error.code,
      details: error.details,
      hint: error.hint,
      name: error.name
    };
  }

  if (typeof error === 'object') {
    return {
      message:
        error.message ||
        error.error_description ||
        error.details ||
        error.hint ||
        'Unknown external service error.',
      code: error.code,
      details: error.details,
      hint: error.hint,
      name: error.name
    };
  }

  return {
    message: String(error),
    code: undefined,
    details: undefined,
    hint: undefined,
    name: undefined
  };
}

function errorResponse(res, error) {
  const normalized = normalizeExternalError(error);

  const status =
    Number(error?.status) ||
    500;

  const code =
    error?.code ||
    normalized.code ||
    'INTERNAL_ERROR';

  // Log the structured error server-side so Render logs contain the actual
  // Supabase/API failure instead of "[object Object]".
  console.error('[Creator Hub Backend Error]', {
    status,
    code,
    message: normalized.message,
    details: normalized.details,
    hint: normalized.hint,
    name: normalized.name
  });

  // Client-visible response.
  //
  // For expected 4xx errors, the actual message is useful to the client.
  // For unexpected 5xx errors, expose a controlled message rather than
  // arbitrary internal objects.
  if (status >= 500) {
    return send(res, status, {
      ok: false,
      code,
      error: normalized.message || 'Internal server error.'
    });
  }

  return send(res, status, {
    ok: false,
    code,
    error: normalized.message || 'Request failed.',
    details: normalized.details || undefined
  });
}


function allowedOrigin(origin) {
  if (!origin) {
    return true;
  }

  const list = FRONTEND_URL
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean);

  if (list.length) {
    return list.includes(origin);
  }

  return (
    origin === `http://localhost:${PORT}` ||
    origin === `http://127.0.0.1:${PORT}`
  );
}

function applyCors(req, res) {
  const origin = req.headers.origin;

  if (origin && allowedOrigin(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
  }

  res.setHeader('Vary', 'Origin');

  res.setHeader(
    'Access-Control-Allow-Headers',
    [
      'Authorization',
      'Content-Type',
      'Idempotency-Key',
      'PayPal-Request-Id',
      'X-Requested-With'
    ].join(', ')
  );

  res.setHeader(
    'Access-Control-Allow-Methods',
    'GET, POST, OPTIONS'
  );
}


async function readJson(req) {
  let raw = '';

  for await (const chunk of req) {
    raw += chunk;
  }

  if (!raw.trim()) {
    return {};
  }

  try {
    return JSON.parse(raw);
  } catch {
    throw fail(
      400,
      'INVALID_JSON',
      'Request body must be valid JSON.'
    );
  }
}


function requireServerConfig(keys) {
  const missing = keys.filter(
    (key) => !process.env[key]
  );

  if (missing.length) {
    throw fail(
      503,
      'REQUIRES_CONFIGURATION',
      'Backend configuration is incomplete.',
      { missing }
    );
  }
}


function db() {
  requireServerConfig([
    'SUPABASE_URL',
    'SUPABASE_SERVICE_ROLE_KEY'
  ]);

  return createClient(
    SUPABASE_URL,
    SUPABASE_SERVICE_ROLE_KEY,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    }
  );
}


function clampLimit(value, defaultValue, maximum) {
  const number = Number(value);

  if (!Number.isFinite(number) || number <= 0) {
    return defaultValue;
  }

  return Math.min(
    Math.floor(number),
    maximum
  );
}


function requireIdem(req) {
  const key = String(
    req.headers['idempotency-key'] || ''
  ).trim();

  if (
    !key ||
    key.length < 16 ||
    key.length > 200
  ) {
    throw fail(
      400,
      'PAYMENT_DUPLICATE',
      'A unique Idempotency-Key with 16-200 characters is required.'
    );
  }

  return key;
}


// ============================================================================
// Authentication
// ============================================================================

async function requireSupabaseUser(req) {
  requireServerConfig([
    'SUPABASE_URL',
    'SUPABASE_ANON_KEY'
  ]);

  const authorization =
    req.headers.authorization || '';

  if (!authorization.startsWith('Bearer ')) {
    throw fail(
      401,
      'AUTH_REQUIRED',
      'Authentication required.'
    );
  }

  const token =
    authorization.slice(7).trim();

  if (!token) {
    throw fail(
      401,
      'AUTH_REQUIRED',
      'Authentication required.'
    );
  }

  const authClient = createClient(
    SUPABASE_URL,
    SUPABASE_ANON_KEY,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    }
  );

  const {
    data,
    error
  } = await authClient.auth.getUser(token);

  if (error) {
    const normalized = normalizeExternalError(error);

    console.warn(
      '[Creator Hub Auth Error]',
      normalized
    );

    throw fail(
      401,
      'AUTH_REQUIRED',
      'Invalid or expired Supabase session.'
    );
  }

  if (!data?.user) {
    throw fail(
      401,
      'AUTH_REQUIRED',
      'Invalid or expired Supabase session.'
    );
  }

  return data.user;
}


async function profileFor(user) {
  const client = db();

  const {
    data,
    error
  } = await client
    .from('profiles')
    .select(
      'id,username,display_name,is_admin'
    )
    .eq('id', user.id)
    .maybeSingle();

  if (error) {
    const normalized =
      normalizeExternalError(error);

    throw fail(
      500,
      'PROFILE_LOOKUP_FAILED',
      normalized.message,
      {
        code: normalized.code,
        details: normalized.details
      }
    );
  }

  return (
    data || {
      id: user.id,
      is_admin: false
    }
  );
}


async function requireAdmin(req) {
  const user =
    await requireSupabaseUser(req);

  const profile =
    await profileFor(user);

  if (!profile.is_admin) {
    throw fail(
      403,
      'FORBIDDEN',
      'Administrator permission is required.'
    );
  }

  return user;
}


// ============================================================================
// LIVE helpers
// ============================================================================

function liveRoomParts(pathname) {
  const match = pathname.match(
    /^\/api\/live\/rooms(?:\/([^/]+))?(?:\/(join|start|end|leave))?\/?$/
  );

  if (!match) {
    return null;
  }

  return {
    id: match[1]
      ? decodeURIComponent(match[1])
      : null,
    action: match[2] || null
  };
}


function validateLiveRoomId(id) {
  const value =
    String(id || '').trim();

  if (!value) {
    throw fail(
      400,
      'INVALID_ROOM',
      'A LIVE room ID is required.'
    );
  }

  return value;
}


async function liveRoomById(client, id) {
  const roomId =
    validateLiveRoomId(id);

  const {
    data,
    error
  } = await client
    .from('live_sessions')
    .select('*')
    .eq('id', roomId)
    .maybeSingle();

  if (error) {
    const normalized =
      normalizeExternalError(error);

    throw fail(
      500,
      'LIVE_ROOM_LOOKUP_FAILED',
      normalized.message,
      {
        code: normalized.code,
        details: normalized.details,
        hint: normalized.hint
      }
    );
  }

  if (!data) {
    throw fail(
      404,
      'LIVE_ROOM_NOT_FOUND',
      'LIVE room not found.'
    );
  }

  return data;
}


function validateLiveRoomName(roomName) {
  const value =
    String(roomName || '').trim();

  if (!validateRoomName(value)) {
    throw fail(
      400,
      'INVALID_ROOM',
      'The LIVE room name is invalid.'
    );
  }

  return value;
}


// ============================================================================
// PayPal
// ============================================================================

async function paypalToken() {
  requireServerConfig([
    'PAYPAL_CLIENT_ID',
    'PAYPAL_CLIENT_SECRET'
  ]);

  const auth =
    Buffer
      .from(
        `${PAYPAL_CLIENT_ID}:${PAYPAL_CLIENT_SECRET}`
      )
      .toString('base64');

  const response =
    await fetch(
      `${PAYPAL_BASE}/v1/oauth2/token`,
      {
        method: 'POST',
        headers: {
          Authorization: `Basic ${auth}`,
          'Content-Type':
            'application/x-www-form-urlencoded'
        },
        body:
          'grant_type=client_credentials'
      }
    );

  const text =
    await response.text();

  if (!response.ok) {
    throw fail(
      502,
      'PAYMENT_PROVIDER_ERROR',
      `PayPal OAuth failed (${response.status}).`
    );
  }

  let data;

  try {
    data = JSON.parse(text);
  } catch {
    throw fail(
      502,
      'PAYMENT_PROVIDER_ERROR',
      'PayPal OAuth returned an invalid response.'
    );
  }

  if (!data.access_token) {
    throw fail(
      502,
      'PAYMENT_PROVIDER_ERROR',
      'PayPal did not return an access token.'
    );
  }

  return data.access_token;
}


async function paypal(path, options = {}) {
  const token =
    await paypalToken();

  const headers = {
    Authorization:
      `Bearer ${token}`,
    'Content-Type':
      'application/json',
    ...(options.headers || {})
  };

  const response =
    await fetch(
      `${PAYPAL_BASE}${path}`,
      {
        ...options,
        headers
      }
    );

  const text =
    await response.text();

  let data = {};

  try {
    data =
      text
        ? JSON.parse(text)
        : {};
  } catch {
    data = {};
  }

  if (!response.ok) {
    throw fail(
      502,
      'PAYMENT_PROVIDER_ERROR',
      data?.message ||
        `PayPal request failed (${response.status}).`,
      {
        paypalStatus:
          response.status
      }
    );
  }

  return data;
}


async function paymentByOrder(client, orderId) {
  const {
    data,
    error
  } = await client
    .from('payments')
    .select('*')
    .eq(
      'provider_order_id',
      orderId
    )
    .maybeSingle();

  if (error) {
    throw error;
  }

  if (!data) {
    throw fail(
      404,
      'PAYMENT_FAILED',
      'Payment order was not found.'
    );
  }

  return data;
}


async function creditCapture(
  client,
  payment,
  captureId
) {
  if (!captureId) {
    throw fail(
      502,
      'PAYMENT_VERIFICATION_FAILED',
      'PayPal capture ID was not returned.'
    );
  }

  const idempotencyKey =
    `paypal:capture:${captureId}`;

  const {
    error
  } = await client.rpc(
    'credit_coins',
    {
      p_user:
        payment.user_id,
      p_amount:
        payment.package_coins,
      p_source:
        'paypal',
      p_provider:
        'paypal',
      p_reference:
        captureId,
      p_reason:
        `PayPal coin purchase ${payment.provider_order_id}`,
      p_idempotency_key:
        idempotencyKey
    }
  );

  if (error) {
    throw error;
  }

  const {
    error: updateError
  } = await client
    .from('payments')
    .update({
      provider_capture_id:
        captureId,
      status:
        'completed',
      credited:
        true,
      updated_at:
        new Date().toISOString()
    })
    .eq(
      'id',
      payment.id
    );

  if (updateError) {
    throw updateError;
  }

  return true;
}


async function coinPackage(
  client,
  coins
) {
  const {
    data,
    error
  } = await client
    .from('coin_packages')
    .select('*')
    .eq(
      'coins',
      coins
    )
    .eq(
      'active',
      true
    )
    .maybeSingle();

  if (error) {
    throw error;
  }

  if (!data) {
    throw fail(
      400,
      'INVALID_PACKAGE',
      'The requested coin package is not available.'
    );
  }

  return data;
}


// ============================================================================
// Wallet
// ============================================================================

async function ensureWallet(
  client,
  userId
) {
  const {
    error
  } = await client
    .from('wallets')
    .upsert(
      {
        user_id:
          userId
      },
      {
        onConflict:
          'user_id',
        ignoreDuplicates:
          true
      }
    );

  if (error) {
    throw error;
  }
}


async function walletFor(
  client,
  userId
) {
  await ensureWallet(
    client,
    userId
  );

  const {
    data,
    error
  } = await client
    .from('wallets')
    .select(
      'coin_balance,diamond_balance,lifetime_gifts_sent'
    )
    .eq(
      'user_id',
      userId
    )
    .maybeSingle();

  if (error) {
    throw error;
  }

  return (
    data || {
      coin_balance:
        0,
      diamond_balance:
        0,
      lifetime_gifts_sent:
        0
    }
  );
}


// ============================================================================
// HTTP router
// ============================================================================

const server =
  http.createServer(
    async (req, res) => {
      applyCors(
        req,
        res
      );

      const url =
        new URL(
          req.url,
          `http://${req.headers.host || 'localhost'}`
        );

      const pathname =
        url.pathname.replace(
          /\/+$/,
          ''
        ) || '/';

      const method =
        req.method;

      if (method === 'OPTIONS') {
        res.writeHead(
          204,
          secureHeaders()
        );

        return res.end();
      }

      try {

        // ==================================================================
        // Infrastructure
        // ==================================================================

        if (
          pathname === '/api/health' &&
          method === 'GET'
        ) {
          return ok(
            res,
            {
              status:
                'operational',
              livekit:
                livekitHealth(),
              time:
                new Date().toISOString()
            }
          );
        }


        if (
          pathname === '/api/livekit/health' &&
          method === 'GET'
        ) {
          return ok(
            res,
            {
              livekit:
                livekitHealth()
            }
          );
        }


        // ==================================================================
        // Public configuration
        //
        // Only non-secret information is returned.
        // ==================================================================

        if (
          pathname === '/api/config/public' &&
          method === 'GET'
        ) {
          return ok(
            res,
            {
              frontendUrl:
                FRONTEND_URL || null,
              livekitUrl:
                LIVEKIT_URL || null,
              paypalEnvironment:
                PAYPAL_ENV,
              features: {
                livekit:
                  livekitHealth().configured,
                paypal:
                  !!(
                    PAYPAL_CLIENT_ID &&
                    PAYPAL_CLIENT_SECRET
                  )
              }
            }
          );
        }


        // ==================================================================
        // LiveKit token
        // ==================================================================

        if (
          pathname === '/api/livekit/token' &&
          method === 'POST'
        ) {
          const user =
            await requireSupabaseUser(
              req
            );

          const body =
            await readJson(req);

          const client =
            db();

          let roomName =
            null;

          let canPublish =
            false;

          const roomId =
            body.roomId
              ? String(
                  body.roomId
                ).trim()
              : null;

          if (roomId) {
            const room =
              await liveRoomById(
                client,
                roomId
              );

            roomName =
              validateLiveRoomName(
                room.room_name
              );

            canPublish =
              String(
                room.host_id
              ) ===
              String(
                user.id
              );
          } else if (
            body.roomName &&
            validateRoomName(
              body.roomName
            )
          ) {
            roomName =
              String(
                body.roomName
              ).trim();

            const {
              data: room,
              error
            } =
              await client
                .from(
                  'live_sessions'
                )
                .select(
                  'id,host_id,room_name,status'
                )
                .eq(
                  'room_name',
                  roomName
                )
                .maybeSingle();

            if (error) {
              throw error;
            }

            if (!room) {
              throw fail(
                404,
                'LIVE_ROOM_NOT_FOUND',
                'LIVE room not found.'
              );
            }

            canPublish =
              String(
                room.host_id
              ) ===
              String(
                user.id
              );
          } else {
            throw fail(
              400,
              'INVALID_ROOM',
              'A valid LIVE room is required.'
            );
          }

          const token =
            await createLiveKitToken(
              {
                userId:
                  user.id,
                roomName,
                canPublish,
                ttlSeconds:
                  body.ttlSeconds
              }
            );

          return ok(
            res,
            {
              token,
              serverUrl:
                LIVEKIT_URL,
              canPublish,
              roomName,
              identity:
                user.id
            }
          );
        }


        // ==================================================================
        // LIVE rooms - list
        // ==================================================================

        if (
          pathname === '/api/live/rooms' &&
          method === 'GET'
        ) {
          const client =
            db();

          const limit =
            clampLimit(
              url.searchParams.get(
                'limit'
              ),
              30,
              100
            );

          const {
            data,
            error
          } =
            await client
              .from(
                'live_sessions'
              )
              .select(
                'id,host_id,title,category,status,viewer_count,started_at'
              )
              .eq(
                'status',
                'live'
              )
              .order(
                'started_at',
                {
                  ascending:
                    false
                }
              )
              .limit(
                limit
              );

          if (error) {
            const normalized =
              normalizeExternalError(
                error
              );

            throw fail(
              500,
              'LIVE_ROOMS_QUERY_FAILED',
              normalized.message,
              {
                code:
                  normalized.code,
                details:
                  normalized.details,
                hint:
                  normalized.hint
              }
            );
          }

          return ok(
            res,
            {
              rooms:
                data || []
            }
          );
        }


        // ==================================================================
        // LIVE room - create
        // ==================================================================

        if (
          pathname === '/api/live/rooms' &&
          method === 'POST'
        ) {
          const user =
            await requireSupabaseUser(
              req
            );

          const body =
            await readJson(req);

          const title =
            String(
              body.title || ''
            )
              .trim()
              .slice(
                0,
                200
              );

          if (!title) {
            throw fail(
              400,
              'INVALID_INPUT',
              'A stream title is required.'
            );
          }

          const client =
            db();

          const randomId =
            globalThis.crypto?.randomUUID?.();

          const roomName =
            (
              'chl_' +
              (
                randomId ||
                Date.now().toString(36)
              )
            ).replace(
              /-/g,
              ''
            );

          if (
            !validateRoomName(
              roomName
            )
          ) {
            throw fail(
              500,
              'LIVE_ROOM_CREATION_FAILED',
              'A valid LiveKit room name could not be generated.'
            );
          }

          const insertData = {
            host_id:
              user.id,
            room_name:
              roomName,
            title,
            category:
              body.category
                ? String(
                    body.category
                  )
                    .trim()
                    .slice(
                      0,
                      60
                    )
                : null,
            status:
              'pending'
          };

          const {
            data,
            error
          } =
            await client
              .from(
                'live_sessions'
              )
              .insert(
                insertData
              )
              .select('*')
              .single();

          if (error) {
            const normalized =
              normalizeExternalError(
                error
              );

            throw fail(
              500,
              'LIVE_ROOM_CREATION_FAILED',
              normalized.message,
              {
                code:
                  normalized.code,
                details:
                  normalized.details,
                hint:
                  normalized.hint
              }
            );
          }

          return ok(
            res,
            data
          );
        }


        // ==================================================================
        // LIVE room actions
        // ==================================================================

        const liveParts =
          liveRoomParts(
            pathname
          );

        if (
          liveParts &&
          liveParts.id
        ) {
          const client =
            db();


          // ---------------------------------------------------------------
          // GET /api/live/rooms/:id
          // ---------------------------------------------------------------

          if (
            !liveParts.action &&
            method === 'GET'
          ) {
            const room =
              await liveRoomById(
                client,
                liveParts.id
              );

            return ok(
              res,
              room
            );
          }


          // ---------------------------------------------------------------
          // POST /api/live/rooms/:id/join
          // ---------------------------------------------------------------

          if (
            liveParts.action === 'join' &&
            method === 'POST'
          ) {
            const user =
              await requireSupabaseUser(
                req
              );

            const room =
              await liveRoomById(
                client,
                liveParts.id
              );

            if (
              room.status ===
              'ended'
            ) {
              throw fail(
                409,
                'LIVE_ENDED',
                'This LIVE session has ended.'
              );
            }

            return ok(
              res,
              {
                joined:
                  true,
                roomId:
                  room.id,
                status:
                  room.status,
                roomName:
                  room.room_name,
                isHost:
                  String(
                    room.host_id
                  ) ===
                  String(
                    user.id
                  )
              }
            );
          }


          // ------------------------------------------------
