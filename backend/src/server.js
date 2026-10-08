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

const PORT = Number(process.env.PORT || 3000);

const FRONTEND_URL = String(
  process.env.FRONTEND_URL ||
  process.env.NEXT_PUBLIC_APP_URL ||
  ''
).replace(/\/$/, '');

const SUPABASE_URL =
  process.env.SUPABASE_URL ||
  process.env.NEXT_PUBLIC_SUPABASE_URL;

const SUPABASE_ANON_KEY =
  process.env.SUPABASE_ANON_KEY ||
  process.env.SUPABASE_KEY ||
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

const SUPABASE_SERVICE_ROLE_KEY =
  process.env.SUPABASE_SERVICE_ROLE_KEY;

const PAYPAL_ENV = String(
  process.env.PAYPAL_ENV ||
  process.env.PAYPAL_MODE ||
  'sandbox'
).toLowerCase();

const PAYPAL_CLIENT_ID =
  process.env.PAYPAL_CLIENT_ID;

const PAYPAL_CLIENT_SECRET =
  process.env.PAYPAL_CLIENT_SECRET;

const PAYPAL_WEBHOOK_ID =
  process.env.PAYPAL_WEBHOOK_ID;

const PAYPAL_BASE =
  PAYPAL_ENV === 'live'
    ? 'https://api-m.paypal.com'
    : 'https://api-m.sandbox.paypal.com';

const PAYPAL_RETURN_URL = String(
  process.env.PAYPAL_RETURN_URL ||
  (FRONTEND_URL
    ? FRONTEND_URL.split(',')[0]
    : '') ||
  ''
).replace(/\/$/, '');

const LIVEKIT_URL =
  process.env.LIVEKIT_URL ||
  'wss://creator-hub-live-9susyfri.livekit.cloud';

/* -------------------------------------------------------------------------- */
/* General utilities                                                          */
/* -------------------------------------------------------------------------- */

function fail(status, code, message, details) {
  const error = new Error(message);

  error.status = status;
  error.code = code;

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
  res.writeHead(
    status,
    secureHeaders(extra)
  );

  res.end(
    JSON.stringify(body)
  );
}

function ok(res, body = {}) {
  return send(
    res,
    200,
    {
      ok: true,
      ...body
    }
  );
}

function errorResponse(res, error) {
  const e =
    error instanceof Error
      ? error
      : new Error(String(error));

  const status =
    Number(e.status) >= 400 &&
    Number(e.status) <= 599
      ? Number(e.status)
      : 500;

  const safeMessage =
    status >= 500
      ? 'The Creator Hub backend encountered an internal error.'
      : (
          e.message ||
          'The request could not be completed.'
        );

  const response = {
    ok: false,
    code:
      e.code ||
      'INTERNAL_ERROR',
    error: safeMessage
  };

  /*
   * Detailed validation information is safe only for
   * intentionally exposed client errors.
   */
  if (
    status < 500 &&
    e.details !== undefined
  ) {
    response.details = e.details;
  }

  return send(
    res,
    status,
    response
  );
}

function allowedOrigin(origin) {
  if (!origin) return true;

  const configured =
    FRONTEND_URL
      .split(',')
      .map(value => value.trim())
      .filter(Boolean);

  if (configured.length) {
    return configured.includes(origin);
  }

  return (
    origin ===
      `http://localhost:${PORT}` ||
    origin ===
      `http://127.0.0.1:${PORT}`
  );
}

function applyCors(req, res) {
  const origin =
    req.headers.origin;

  if (
    origin &&
    allowedOrigin(origin)
  ) {
    res.setHeader(
      'Access-Control-Allow-Origin',
      origin
    );
  }

  res.setHeader(
    'Vary',
    'Origin'
  );

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
  const missing =
    keys.filter(
      key => !process.env[key]
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

async function requireSupabaseUser(req) {
  requireServerConfig([
    'SUPABASE_URL',
    'SUPABASE_ANON_KEY'
  ]);

  const authorization =
    req.headers.authorization || '';

  if (
    !authorization.startsWith(
      'Bearer '
    )
  ) {
    throw fail(
      401,
      'AUTH_REQUIRED',
      'Authentication required.'
    );
  }

  const token =
    authorization
      .slice(7)
      .trim();

  if (!token) {
    throw fail(
      401,
      'AUTH_REQUIRED',
      'Authentication required.'
    );
  }

  const authClient =
    createClient(
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
  } =
    await authClient.auth.getUser(
      token
    );

  if (
    error ||
    !data?.user
  ) {
    throw fail(
      401,
      'AUTH_REQUIRED',
      'Invalid or expired Supabase session.'
    );
  }

  return data.user;
}

async function profileFor(user) {
  const {
    data,
    error
  } =
    await db()
      .from('profiles')
      .select(
        'id,username,display_name,is_admin'
      )
      .eq(
        'id',
        user.id
      )
      .maybeSingle();

  if (error) {
    throw error;
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

function requireIdem(req) {
  const key = String(
    req.headers['idempotency-key'] ||
    ''
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

function clampLimit(
  value,
  defaultValue,
  maximum
) {
  const number =
    Number(value);

  if (
    !Number.isFinite(number) ||
    number <= 0
  ) {
    return defaultValue;
  }

  return Math.min(
    Math.floor(number),
    maximum
  );
}

/* -------------------------------------------------------------------------- */
/* Public configuration                                                        */
/* -------------------------------------------------------------------------- */

function publicConfig() {
  return {
    app: {
      name:
        'Creator Hub Creator Network',
      environment:
        process.env.NODE_ENV ||
        'production',
      currency: 'JMD'
    },

    api: {
      baseUrl:
        process.env.API_BASE ||
        '',
      healthPath:
        '/api/health',
      livekitTokenPath:
        '/api/livekit/token',
      publicConfigPath:
        '/api/config/public'
    },

    livekit: {
      configured:
        livekitHealth().configured,
      serverUrl:
        LIVEKIT_URL
    },

    paypal: {
      configured:
        Boolean(
          PAYPAL_CLIENT_ID &&
          PAYPAL_CLIENT_SECRET
        ),
      environment:
        PAYPAL_ENV
    },

    features: {
      livekit:
        livekitHealth().configured,
      paypal:
        Boolean(
          PAYPAL_CLIENT_ID &&
          PAYPAL_CLIENT_SECRET
        ),
      storage:
        Boolean(
          SUPABASE_URL
        )
    },

    version:
      process.env.APP_VERSION ||
      '1.0.0'
  };
}

/* -------------------------------------------------------------------------- */
/* PayPal                                                                     */
/* -------------------------------------------------------------------------- */

async function paypalToken() {
  requireServerConfig([
    'PAYPAL_CLIENT_ID',
    'PAYPAL_CLIENT_SECRET'
  ]);

  const auth =
    Buffer.from(
      `${PAYPAL_CLIENT_ID}:${PAYPAL_CLIENT_SECRET}`
    ).toString('base64');

  const response =
    await fetch(
      `${PAYPAL_BASE}/v1/oauth2/token`,
      {
        method: 'POST',
        headers: {
          Authorization:
            `Basic ${auth}`,
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
    data =
      JSON.parse(text);
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

async function paypal(
  path,
  options = {}
) {
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

/* -------------------------------------------------------------------------- */
/* Payments                                                                   */
/* -------------------------------------------------------------------------- */

async function paymentByOrder(
  client,
  orderId
) {
  const {
    data,
    error
  } =
    await client
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

async function coinPackage(
  client,
  coins
) {
  const {
    data,
    error
  } =
    await client
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

  if (payment.credited) {
    return true;
  }

  const idempotencyKey =
    `paypal:capture:${captureId}`;

  const {
    error
  } =
    await client.rpc(
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
  } =
    await client
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

/* -------------------------------------------------------------------------- */
/* Wallet                                                                     */
/* -------------------------------------------------------------------------- */

async function ensureWallet(
  client,
  userId
) {
  const {
    error
  } =
    await client
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
  } =
    await client
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
      coin_balance: 0,
      diamond_balance: 0,
      lifetime_gifts_sent: 0
    }
  );
}

/* -------------------------------------------------------------------------- */
/* LIVE                                                                       */
/* -------------------------------------------------------------------------- */

function liveRoomParts(
  pathname
) {
  const match =
    pathname.match(
      /^\/api\/live\/rooms(?:\/([^/]+))?(?:\/(join|start|end|leave))?\/?$/
    );

  if (!match) {
    return null;
  }

  return {
    id:
      match[1]
        ? decodeURIComponent(
            match[1]
          )
        : null,

    action:
      match[2] ||
      null
  };
}

async function liveRoomById(
  client,
  id
) {
  if (!id) {
    throw fail(
      400,
      'INVALID_ROOM',
      'A LIVE room ID is required.'
    );
  }

  const {
    data,
    error
  } =
    await client
      .from('live_sessions')
      .select('*')
      .eq(
        'id',
        id
      )
      .maybeSingle();

  if (error) {
    throw error;
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

async function liveRoomByName(
  client,
  roomName
) {
  if (
    !validateRoomName(
      roomName
    )
  ) {
    throw fail(
      400,
      'INVALID_ROOM',
      'Invalid LiveKit room name.'
    );
  }

  const {
    data,
    error
  } =
    await client
      .from('live_sessions')
      .select('*')
      .eq(
        'room_name',
        roomName
      )
      .maybeSingle();

  if (error) {
    throw error;
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

/* -------------------------------------------------------------------------- */
/* HTTP server                                                                */
/* -------------------------------------------------------------------------- */

const server =
  http.createServer(
    async (
      req,
      res
    ) => {
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

      if (
        method ===
        'OPTIONS'
      ) {
        res.writeHead(
          204,
          secureHeaders()
        );

        return res.end();
      }

      try {
        /* ------------------------------------------------------------------ */
        /* Infrastructure                                                     */
        /* ------------------------------------------------------------------ */

        if (
          pathname ===
            '/api/health' &&
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
          pathname ===
            '/api/livekit/health' &&
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

        if (
          pathname ===
            '/api/config/public' &&
          method === 'GET'
        ) {
          return ok(
            res,
            publicConfig()
          );
        }

        /* ------------------------------------------------------------------ */
        /* LiveKit token                                                       */
        /* ------------------------------------------------------------------ */

        if (
          pathname ===
            '/api/livekit/token' &&
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

          let room = null;

          /*
           * Creator Hub database room ID.
           *
           * Example:
           * roomId = UUID of live_sessions row.
           */
          const roomId =
            body.roomId
              ? String(
                  body.roomId
                ).trim()
              : '';

          /*
           * Actual LiveKit room name.
           */
          const suppliedRoomName =
            body.roomName
              ? String(
                  body.roomName
                ).trim()
              : '';

          if (roomId) {
            room =
              await liveRoomById(
                client,
                roomId
              );
          } else if (
            suppliedRoomName
          ) {
            room =
              await liveRoomByName(
                client,
                suppliedRoomName
              );
          } else {
            throw fail(
              400,
              'INVALID_ROOM',
              'A valid LIVE room ID or room name is required.'
            );
          }

          const roomName =
            String(
              room.room_name ||
              ''
            ).trim();

          if (
            !validateRoomName(
              roomName
            )
          ) {
            throw fail(
              500,
              'LIVE_ROOM_CONFIGURATION_ERROR',
              'The LIVE room has an invalid LiveKit room name.'
            );
          }

          /*
           * IMPORTANT SECURITY RULE:
           *
           * The browser may request publishing,
           * but the browser does NOT decide whether
           * it is allowed to publish.
           *
           * Only the database host relationship
           * grants canPublish.
           */
          const canPublish =
            String(
              room.host_id
            ) ===
            String(
              user.id
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
              participantToken:
                token,
              serverUrl:
                LIVEKIT_URL,
              server_url:
                LIVEKIT_URL,
              canPublish,
              roomName,
              roomId:
                room.id,
              identity:
                user.id
            }
          );
        }

        /* ------------------------------------------------------------------ */
        /* LIVE rooms                                                          */
        /* ------------------------------------------------------------------ */

        if (
          pathname ===
            '/api/live/rooms' &&
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
                'id,host_id,title,category,status,viewer_count,started_at,room_name'
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
            throw error;
          }

          return ok(
            res,
            {
              rooms:
                data || []
            }
          );
        }

        if (
          pathname ===
            '/api/live/rooms' &&
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
              body.title ||
              ''
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
            globalThis.crypto?.randomUUID?.() ||
            `${Date.now()}-${Math.random()
              .toString(36)
              .slice(2)}`;

          const roomName =
            `chl_${String(
              randomId
            ).replace(
              /-/g,
              ''
            )}`;

          const {
            data,
            error
          } =
            await client
              .from(
                'live_sessions'
              )
              .insert({
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
              })
              .select('*')
              .single();

          if (error) {
            throw error;
          }

          return ok(
            res,
            {
              room:
                data
            }
          );
        }

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

          /* -------------------------------------------------------------- */
          /* GET LIVE room                                                   */
          /* -------------------------------------------------------------- */

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
              {
                room
              }
            );
          }

          /* -------------------------------------------------------------- */
          /* Join LIVE                                                       */
          /* -------------------------------------------------------------- */

          if (
            liveParts.action ===
              'join' &&
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
                roomName:
                  room.room_name,
                status:
                  room.status,
                userId:
                  user.id
              }
            );
          }

          /* -------------------------------------------------------------- */
          /* Start LIVE                                                       */
          /* -------------------------------------------------------------- */

          if (
            liveParts.action ===
              'start' &&
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
              room.host_id !==
              user.id
            ) {
              throw fail(
                403,
                'FORBIDDEN',
                'Only the host can start this LIVE room.'
              );
            }

            if (
              room.status ===
              'ended'
            ) {
              throw fail(
                409,
                'LIVE_ENDED',
                'This LIVE session has already ended.'
              );
            }

            /*
             * CRITICAL:
             *
             * The database does NOT become LIVE
             * merely because the frontend pressed
             * the Go LIVE button.
             *
             * LiveKit must first confirm that the
             * host is connected and publishing media.
             */
            await verifyHostPublishing(
              room.room_name,
              user.id
            );

            const {
              data,
              error
            } =
              await client
                .from(
                  'live_sessions'
                )
                .update({
                  status:
                    'live',
                  started_at:
                    room.started_at ||
                    new Date().toISOString()
                })
                .eq(
                  'id',
                  room.id
                )
                .select('*')
                .single();

            if (error) {
              throw error;
            }

            return ok(
              res,
              {
                room:
                  data
              }
            );
          }

          /* -------------------------------------------------------------- */
          /* End LIVE                                                         */
          /* -------------------------------------------------------------- */

          if (
            liveParts.action ===
              'end' &&
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
              room.host_id !==
              user.id
            ) {
              throw fail(
                403,
                'FORBIDDEN',
                'Only the host can end this LIVE room.'
              );
            }

            if (
              room.status ===
              'ended'
            ) {
              return ok(
                res,
                {
                  room
                }
              );
            }

            const {
              data,
              error
            } =
              await client
                .from(
                  'live_sessions'
                )
                .update({
                  status:
                    'ended',
                  ended_at:
                    new Date().toISOString()
                })
                .eq(
                  'id',
                  room.id
                )
                .select('*')
                .single();

            if (error) {
              throw error;
            }

            return ok(
              res,
              {
                room:
                  data
              }
            );
          }

          /* -------------------------------------------------------------- */
          /* Leave LIVE                                                       */
          /* -------------------------------------------------------------- */

          if (
            liveParts.action ===
              'leave' &&
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
              return ok(
                res,
                {
                  left:
                    true,
                  roomId:
                    room.id
                }
              );
            }

            return ok(
              res,
              {
                left:
                  true,
                roomId:
                  room.id,
                userId:
                  user.id
              }
            );
          }
        }

        /* ------------------------------------------------------------------ */
        /* Payments: create PayPal order                                      */
        /* ------------------------------------------------------------------ */

        if (
          pathname ===
            '/api/payments/create-order' &&
          method === 'POST'
        ) {
          const user =
            await requireSupabaseUser(
              req
            );

          const idem =
            requireIdem(req);

          const body =
            await readJson(req);

          const coins =
            Number(
              body.coins
            );

          const client =
            db();

          const pkg =
            await coinPackage(
              client,
              coins
            );

          /*
           * Idempotency:
           * return the original PayPal order
           * if this request was already processed.
           */
          const {
            data: existing
          } =
            await client
              .from(
                'payments'
              )
              .select('*')
              .eq(
                'user_id',
                user.id
              )
              .eq(
                'idempotency_key',
                idem
              )
              .maybeSingle();

          if (
            existing &&
            existing.provider_order_id
          ) {
            const existingOrder =
              await paypal(
                `/v2/checkout/orders/${existing.provider_order_id}`,
                {
                  method:
                    'GET'
                }
              );

            const link =
              (
                existingOrder.links ||
                []
              ).find(
                item =>
                  item.rel ===
                    'approve' ||
                  item.rel ===
                    'payer-action'
              );

            return ok(
              res,
              {
                orderId:
                  existing.provider_order_id,
                approveUrl:
                  link
                    ? link.href
                    : null
              }
            );
          }

          const returnBase =
            PAYPAL_RETURN_URL ||
            FRONTEND_URL.split(
              ','
            )[0] ||
            '';

          const order =
            await paypal(
              '/v2/checkout/orders',
              {
                method:
                  'POST',

                headers: {
                  'PayPal-Request-Id':
                    idem
                },

                body:
                  JSON.stringify({
                    intent:
                      'CAPTURE',

                    purchase_units: [
                      {
                        amount: {
                          currency_code:
                            pkg.currency,

                          value:
                            Number(
                              pkg.price
                            ).toFixed(2)
                        },

                        custom_id:
                          `${user.id}:${pkg.coins}`
                      }
                    ],

                    application_context: {
                      brand_name:
                        'Creator Hub Creator Network',

                      user_action:
                        'PAY_NOW',

                      return_url:
                        returnBase
                          ? `${returnBase}/?paypal=success`
                          : undefined,

                      cancel_url:
                        returnBase
                          ? `${returnBase}/?paypal=cancel`
                          : undefined
                    }
                  })
              }
            );

          const link =
            (
              order.links ||
              []
            ).find(
              item =>
                item.rel ===
                  'approve' ||
                item.rel ===
                  'payer-action'
            );

          const {
            error:
              insertError
          } =
            await client
              .from(
                'payments'
              )
              .insert({
                user_id:
                  user.id,
                provider:
                  'paypal',
                provider_order_id:
                  order.id,
                package_coins:
                  pkg.coins,
                amount:
                  pkg.price,
                currency:
                  pkg.currency,
                status:
                  'created',
                credited:
                  false,
                idempotency_key:
                  idem,
                raw:
                  order
              });

          if (insertError) {
            /*
             * The PayPal order exists, but the local
             * record failed. Do not pretend the purchase
             * succeeded.
             */
            throw insertError;
          }

          return ok(
            res,
            {
              orderId:
                order.id,
              approveUrl:
                link
                  ? link.href
                  : null
            }
          );
        }

        /* ------------------------------------------------------------------ */
        /* Payments: capture PayPal order                                     */
        /* ------------------------------------------------------------------ */

        if (
          pathname ===
            '/api/payments/capture-order' &&
          method === 'POST'
        ) {
          const user =
            await requireSupabaseUser(
              req
            );

          const body =
            await readJson(req);

          const orderId =
            String(
              body.orderId ||
              ''
            ).trim();

          if (!orderId) {
            throw fail(
              400,
              'PAYMENT_FAILED',
              'An orderId is required.'
            );
          }

          const client =
            db();

          const payment =
            await paymentByOrder(
              client,
              orderId
            );

          if (
            payment.user_id !==
            user.id
          ) {
            throw fail(
              403,
              'FORBIDDEN',
              'This payment belongs to another account.'
            );
          }

          if (
            payment.credited
          ) {
            return ok(
              res,
              {
                credited:
                  true,
                status:
                  'completed'
              }
            );
          }

          const capture =
            await paypal(
              `/v2/checkout/orders/${orderId}/capture`,
              {
                method:
                  'POST',

                headers: {
                  'PayPal-Request-Id':
                    `capture:${orderId}`
                },

                body:
                  '{}'
              }
            );

          const captureRecord =
            capture
              ?.purchase_units?.[0]
              ?.payments
              ?.captures?.[0];

          if (
            !captureRecord ||
            captureRecord.status !==
              'COMPLETED'
          ) {
            await client
              .from(
                'payments'
              )
              .update({
                status:
                  'pending',
                raw:
                  capture,
                updated_at:
                  new Date().toISOString()
              })
              .eq(
                'id',
                payment.id
              );

            throw fail(
              402,
              'PAYMENT_VERIFICATION_FAILED',
              'PayPal did not confirm a completed capture.'
            );
          }

          await creditCapture(
            client,
            payment,
            captureRecord.id
          );

          return ok(
            res,
            {
              credited:
                true,
              status:
                'completed'
            }
          );
        }

        /* ------------------------------------------------------------------ */
        /* PayPal webhook                                                      */
        /* ------------------------------------------------------------------ */

        if (
          pathname ===
            '/api/payments/webhook' &&
          method === 'POST'
        ) {
          requireServerConfig([
            'PAYPAL_WEBHOOK_ID'
          ]);

          const event =
            await readJson(req);

          const verification =
            await paypal(
              '/v1/notifications/verify-webhook-signature',
              {
                method:
                  'POST',

                body:
                  JSON.stringify({
                    auth_algo:
                      req.headers[
                        'paypal-auth-algo'
                      ],

                    cert_url:
                      req.headers[
                        'paypal-cert-url'
                      ],

                    transmission_id:
                      req.headers[
                        'paypal-transmission-id'
                      ],

                    transmission_sig:
                      req.headers[
                        'paypal-transmission-sig'
                      ],

                    transmission_time:
                      req.headers[
                        'paypal-transmission-time'
                      ],

                    webhook_id:
                      PAYPAL_WEBHOOK_ID,

                    webhook_event:
                      event
                  })
              }
            );

          if (
            verification.verification_status !==
            'SUCCESS'
          ) {
            throw fail(
              400,
              'WEBHOOK_VERIFICATION_FAILED',
              'PayPal webhook signature verification failed.'
            );
          }

          const client =
            db();

          if (
            event.event_type ===
            'PAYMENT.CAPTURE.COMPLETED'
          ) {
            const capture =
              event.resource ||
              {};

            const orderId =
              capture
                ?.supplementary_data
                ?.related_ids
                ?.order_id;

            if (orderId) {
              const payment =
                await paymentByOrder(
                  client,
                  orderId
                );

              if (
                !payment.credited
              ) {
                await creditCapture(
                  client,
                  payment,
                  capture.id
                );
              }
            }
          }

          return ok(
            res,
            {
              received:
                true
            }
          );
        }

        /* ------------------------------------------------------------------ */
        /* PayPal refund                                                       */
        /* ------------------------------------------------------------------ */

        if (
          pathname ===
            '/api/payments/refund' &&
          method === 'POST'
        ) {
          await requireAdmin(
            req
          );

          const body =
            await readJson(req);

          const captureId =
            String(
              body.captureId ||
              ''
            ).trim();

          if (!captureId) {
            throw fail(
              400,
              'PAYMENT_FAILED',
              'A captureId is required.'
            );
          }

          const client =
            db();

          await paypal(
            `/v2/payments/captures/${captureId}/refund`,
            {
              method:
                'POST',
              body:
                '{}'
            }
          );

          const {
            data: payment,
            error
          } =
            await client
              .from(
                'payments'
              )
              .select('*')
              .eq(
                'provider_capture_id',
                captureId
              )
              .maybeSingle();

          if (error) {
            throw error;
          }

          if (
            payment &&
            payment.status !==
              'refunded'
          ) {
            /*
             * Reverse the credited coins first.
             * If reversal fails, do not falsely report
             * the local payment as fully reconciled.
             */
            const {
              error:
                debitError
            } =
              await client.rpc(
                'debit_coins',
                {
                  p_user:
                    payment.user_id,

                  p_amount:
                    payment.package_coins,

                  p_source:
                    'refund',

                  p_reference:
                    captureId,

                  p_reason:
                    `Refund of order ${payment.provider_order_id}`,

                  p_idempotency_key:
                    `paypal:refund:${captureId}`
                }
              );

            if (debitError) {
              throw fail(
                500,
                'REFUND_RECONCILIATION_FAILED',
                'PayPal refund completed, but the wallet reversal requires reconciliation.'
              );
            }

            const {
              error:
                updateError
            } =
              await client
                .from(
                  'payments'
                )
                .update({
                  status:
                    'refunded',
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
          }

          return ok(
            res,
            {
              refunded:
                true
            }
          );
        }

        /* ------------------------------------------------------------------ */
        /* Wallet balance                                                      */
        /* ------------------------------------------------------------------ */

        if (
          pathname ===
            '/api/wallet/balance' &&
          method === 'GET'
        ) {
          const user =
            await requireSupabaseUser(
              req
            );

          const wallet =
            await walletFor(
              db(),
              user.id
            );

          return ok(
            res,
            wallet
          );
        }

        /* ------------------------------------------------------------------ */
        /* Wallet transactions                                                 */
        /* ------------------------------------------------------------------ */

        if (
          pathname ===
            '/api/wallet/transactions' &&
          method === 'GET'
        ) {
          const user =
            await requireSupabaseUser(
              req
            );

          const limit =
            clampLimit(
              url.searchParams.get(
                'limit'
              ),
              20,
              100
            );

          const {
            data,
            error
          } =
            await db()
              .from(
                'coin_ledger'
              )
              .select(
                'amount,balance_after,source,reason,reference,created_at'
              )
              .eq(
                'user_id',
                user.id
              )
              .order(
                'created_at',
                {
                  ascending:
                    false
                }
              )
              .limit(
                limit
              );

          if (error) {
            throw error;
          }

          return ok(
            res,
            {
              transactions:
                data || []
            }
          );
        }

        /* ------------------------------------------------------------------ */
        /* Wallet deposit                                                      */
        /* ------------------------------------------------------------------ */

        if (
          pathname ===
            '/api/wallet/deposit' &&
          method === 'POST'
        ) {
          const user =
            await requireSupabaseUser(
              req
            );

          const idem =
            requireIdem(req);

          const body =
            await readJson(req);

          const client =
            db();

          const pkg =
            await coinPackage(
              client,
              Number(
                body.coins
              )
            );

          const {
            data: existing
          } =
            await client
              .from(
                'payments'
              )
              .select('*')
              .eq(
                'user_id',
                user.id
              )
              .eq(
                'idempotency_key',
                idem
              )
              .maybeSingle();

          if (
            existing &&
            existing.provider_order_id
          ) {
            return ok(
              res,
              {
                orderId:
                  existing.provider_order_id
              }
            );
          }

          const returnBase =
            PAYPAL_RETURN_URL ||
            FRONTEND_URL.split(
              ','
            )[0] ||
            '';

          const order =
            await paypal(
              '/v2/checkout/orders',
              {
                method:
                  'POST',

                headers: {
                  'PayPal-Request-Id':
                    idem
                },

                body:
                  JSON.stringify({
                    intent:
                      'CAPTURE',

                    purchase_units: [
                      {
                        amount: {
                          currency_code:
                            pkg.currency,

                          value:
                            Number(
                              pkg.price
                            ).toFixed(2)
                        },

                        custom_id:
                          `${user.id}:${pkg.coins}`
                      }
                    ],

                    application_context: {
                      brand_name:
                        'Creator Hub Creator Network',

                      user_action:
                        'PAY_NOW',

                      return_url:
                        returnBase
                          ? `${returnBase}/?paypal=success`
                          : undefined,

                      cancel_url:
                        returnBase
                          ? `${returnBase}/?paypal=cancel`
                          : undefined
                    }
                  })
              }
            );

          const link =
            (
              order.links ||
              []
            ).find(
              item =>
                item.rel ===
                  'approve' ||
                item.rel ===
                  'payer-action'
            );

          const {
            error:
              insertError
          } =
            await client
              .from(
                'payments'
              )
              .insert({
                user_id:
                  user.id,
                provider:
                  'paypal',
                provider_order_id:
                  order.id,
                package_coins:
                  pkg.coins,
                amount:
                  pkg.price,
                currency:
                  pkg.currency,
                status:
                  'created',
                credited:
                  false,
                idempotency_key:
                  idem,
                raw:
                  order
              });

          if (insertError) {
            throw insertError;
          }

          return ok(
            res,
            {
              orderId:
                order.id,
              approveUrl:
                link
                  ? link.href
                  : null
            }
          );
        }

        /* ------------------------------------------------------------------ */
        /* Wallet withdrawal                                                   */
        /* ------------------------------------------------------------------ */

        if (
          pathname ===
            '/api/wallet/withdraw' &&
          method === 'POST'
        ) {
          const user =
            await requireSupabaseUser(
              req
            );

          const idem =
            requireIdem(req);

          const body =
            await readJson(req);

          const amount =
            Math.floor(
              Number(
                body.amount
              )
            );

          if (
            !(
              amount >
              0
            )
          ) {
            throw fail(
              400,
              'INVALID_INPUT',
              'A positive diamond amount is required.'
            );
          }

          const {
            data,
            error
          } =
            await db().rpc(
              'request_diamond_withdrawal',
              {
                p_user:
                  user.id,

                p_amount:
                  amount,

                p_reference:
                  `withdraw:${idem}`
              }
            );

          if (error) {
            throw fail(
              400,
              'WITHDRAWAL_FAILED',
              error.message
            );
          }

          return ok(
            res,
            {
              withdrawal:
                data
            }
          );
        }

        /* ------------------------------------------------------------------ */
        /* Wallet coin purchase                                                */
        /* ------------------------------------------------------------------ */

        if (
          pathname ===
            '/api/wallet/purchase' &&
          method === 'POST'
        ) {
          const user =
            await requireSupabaseUser(
              req
            );

          const idem =
            requireIdem(req);

          const body =
            await readJson(req);

          const amount =
            Math.floor(
              Number(
                body.amount
              )
            );

          if (
            !(
              amount >
              0
            )
          ) {
            throw fail(
              400,
              'INVALID_INPUT',
              'A positive coin amount is required.'
            );
          }

          const {
            data,
            error
          } =
            await db().rpc(
              'debit_coins',
              {
                p_user:
                  user.id,

                p_amount:
                  amount,

                p_source:
                  'purchase',

                p_reference:
                  String(
                    body.reference ||
                    idem
                  ),

                p_reason:
                  String(
                    body.reason ||
                    'In-app purchase'
                  ),

                p_idempotency_key:
                  idem
              }
            );

          if (error) {
            throw fail(
              400,
              'PURCHASE_FAILED',
              error.message
            );
          }

          return ok(
            res,
            {
              wallet:
                data
            }
          );
        }

        /* ------------------------------------------------------------------ */
        /* Gifts                                                                */
        /* ------------------------------------------------------------------ */

        if (
          pathname ===
            '/api/wallet/gift' &&
          method === 'POST'
        ) {
          const user =
            await requireSupabaseUser(
              req
            );

          const idem =
            requireIdem(req);

          const body =
            await readJson(req);

          const recipientId =
            String(
              body.recipientId ||
              ''
            ).trim();

          const giftName =
            String(
              body.gift ||
              ''
            ).trim();

          if (!recipientId) {
            throw fail(
              400,
              'INVALID_INPUT',
              'A gift recipient is required.'
            );
          }

          if (
            recipientId ===
            user.id
          ) {
            throw fail(
              400,
              'INVALID_INPUT',
              'You cannot gift yourself.'
            );
          }

          if (!giftName) {
            throw fail(
              400,
              'INVALID_INPUT',
              'A gift must be selected.'
            );
          }

          const client =
            db();

          const {
            data: gift,
            error:
              giftError
          } =
            await client
              .from(
                'gifts'
              )
              .select(
                'id,name'
              )
              .eq(
                'name',
                giftName
              )
              .eq(
                'active',
                true
              )
              .maybeSingle();

          if (giftError) {
            throw giftError;
          }

          if (!gift) {
            throw fail(
              400,
              'GIFT_UNAVAILABLE',
              'The selected gift is not available.'
            );
          }

          const {
            data,
            error
          } =
            await client.rpc(
              'send_gift',
              {
                p_sender:
                  user.id,

                p_recipient:
                  recipientId,

                p_gift:
                  gift.id,

                p_live:
                  body.liveId ||
                  null,

                p_idempotency_key:
                  idem
              }
            );

          if (error) {
            throw fail(
              400,
              'GIFT_FAILED',
              error.message
            );
          }

          return ok(
            res,
            {
              transaction:
                data
            }
          );
        }

        /* ------------------------------------------------------------------ */
        /* Leagues                                                             */
        /* ------------------------------------------------------------------ */

        if (
          pathname ===
            '/api/leagues/standings' &&
          method === 'GET'
        ) {
          const client =
            db();

          const {
            data: season
          } =
            await client
              .from(
                'league_seasons'
              )
              .select(
                'id,name'
              )
              .eq(
                'status',
                'active'
              )
              .maybeSingle();

          if (!season) {
            return ok(
              res,
              {
                season:
                  null,
                standings:
                  []
              }
            );
          }

          const {
            data,
            error
          } =
            await client
              .from(
                'league_standings'
              )
              .select(
                '*,teams(name,division_code,level)'
              )
              .eq(
                'season_id',
                season.id
              )
              .order(
                'division_code',
                {
                  ascending:
                    true
                }
              )
              .order(
                'position',
                {
                  ascending:
                    true
                }
              );

          if (error) {
            throw error;
          }

          return ok(
            res,
            {
              season,
              standings:
                data || []
            }
          );
        }

        if (
          pathname ===
            '/api/leagues' &&
          method === 'GET'
        ) {
          const {
            data,
            error
          } =
            await db()
              .from(
                'leagues'
              )
              .select('*')
              .order(
                'rank',
                {
                  ascending:
                    true
                }
              );

          if (error) {
            throw error;
          }

          return ok(
            res,
            {
              leagues:
                data || []
            }
          );
        }

        /* ------------------------------------------------------------------ */
        /* Not found                                                           */
        /* ------------------------------------------------------------------ */

        throw fail(
          404,
          'NOT_FOUND',
          `The requested endpoint '${pathname}' does not exist.`
        );
      } catch (error) {
        return errorResponse(
          res,
          error
        );
      }
    }
  );

server.listen(
  PORT,
  '0.0.0.0',
  () => {
    console.log(
      `Creator Hub Creator Network backend listening on port ${PORT} (PayPal ${PAYPAL_ENV}).`
    );
  }
);

export {
  server
};
