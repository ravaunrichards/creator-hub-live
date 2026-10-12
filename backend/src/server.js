import "dotenv/config";
import http from "node:http";
import { URL } from "node:url";
import { createClient } from "@supabase/supabase-js";
import {
  createLiveKitToken,
  validateRoomName,
  livekitHealth,
  verifyHostPublishing,
} from "./livekit-token.js";

// ============================================================================
// Crash Handlers for Render Deployment Visibility
// ============================================================================
process.on("uncaughtException", (err) => {
  console.error("[Fatal] Uncaught Exception:", err);
  process.exit(1);
});

process.on("unhandledRejection", (reason, promise) => {
  console.error("[Fatal] Unhandled Rejection at:", promise, "reason:", reason);
  process.exit(1);
});

// ============================================================================
// Creator Hub Creator Network - Backend HTTP API
// ============================================================================

const PORT = Number(process.env.PORT || 3000);

const FRONTEND_URL = String(
  process.env.FRONTEND_URL || process.env.NEXT_PUBLIC_APP_URL || ""
).replace(/\/$/, "");

const SUPABASE_URL =
  process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || "";

const SUPABASE_ANON_KEY =
  process.env.SUPABASE_ANON_KEY ||
  process.env.SUPABASE_KEY ||
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
  "";

const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || "";

const PAYPAL_ENV = String(
  process.env.PAYPAL_ENV || process.env.PAYPAL_MODE || "sandbox"
).toLowerCase();

const PAYPAL_CLIENT_ID = process.env.PAYPAL_CLIENT_ID || "";
const PAYPAL_CLIENT_SECRET = process.env.PAYPAL_CLIENT_SECRET || "";
const PAYPAL_WEBHOOK_ID = process.env.PAYPAL_WEBHOOK_ID || "";

const PAYPAL_BASE =
  PAYPAL_ENV === "live"
    ? "https://api-m.paypal.com"
    : "https://api-m.sandbox.paypal.com";

const PAYPAL_RETURN_URL = String(
  process.env.PAYPAL_RETURN_URL ||
    (FRONTEND_URL ? FRONTEND_URL.split(",")[0] : "") ||
    ""
).replace(/\/$/, "");

const LIVEKIT_URL = String(process.env.LIVEKIT_URL || "").trim();

// ============================================================================
// Generic helpers
// ============================================================================

function fail(status, code, message, details = undefined) {
  const error = new Error(String(message || "Request failed."));
  error.status = Number(status) || 500;
  error.code = String(code || "INTERNAL_ERROR");
  if (details !== undefined) error.details = details;
  return error;
}

function secureHeaders(extra = {}) {
  return {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
    "X-Content-Type-Options": "nosniff",
    "X-Frame-Options": "DENY",
    "Referrer-Policy": "no-referrer",
    ...extra,
  };
}

function send(res, status, body, extra = {}) {
  if (res.headersSent) return;
  res.writeHead(status, secureHeaders(extra));
  res.end(JSON.stringify(body));
}

function ok(res, body = {}) {
  return send(res, 200, { ok: true, ...body });
}

// ============================================================================
// Supabase & External Error Normalization
// ============================================================================

function normalizeExternalError(error) {
  if (!error) {
    return {
      message: "Unknown error.",
      code: undefined,
      details: undefined,
      hint: undefined,
      name: undefined,
    };
  }

  // Native Error instances must be handled before the generic object branch.
  // Otherwise their useful message/name fields can be normalized incorrectly.
  if (error instanceof Error) {
    return {
      message: error.message || "Unknown error.",
      code: error.code,
      details: error.details,
      hint: error.hint,
      name: error.name,
    };
  }

  if (typeof error === "object") {
    let serialized;
    try {
      serialized = JSON.stringify(error);
    } catch {
      serialized = String(error);
    }

    return {
      message:
        error.message ||
        error.error_description ||
        error.details ||
        error.hint ||
        serialized ||
        "Unknown error.",
      code: error.code || error.status || "INTERNAL_ERROR",
      details: error.details || null,
      hint: error.hint || null,
      name: error.name || "ExternalError",
    };
  }

  return {
    message: String(error),
    code: undefined,
    details: undefined,
    hint: undefined,
    name: undefined,
  };
}

function errorResponse(res, error) {
  const normalized = normalizeExternalError(error);
  const status = Number(error?.status) || Number(error?.statusCode) || 500;
  const code = error?.code || normalized.code || "INTERNAL_ERROR";

  console.error("[Creator Hub Backend Error]", {
    status,
    code,
    message: normalized.message,
    details: normalized.details,
    hint: normalized.hint,
    name: normalized.name,
  });

  if (status >= 500) {
    return send(res, status, {
      ok: false,
      code,
      error: normalized.message || "Internal server error.",
      details: normalized.details || undefined,
    });
  }

  return send(res, status, {
    ok: false,
    code,
    error: normalized.message || "Request failed.",
    details: normalized.details || undefined,
    hint: normalized.hint || undefined,
  });
}

function allowedOrigin(origin) {
  if (!origin) return true;
  const list = FRONTEND_URL.split(",")
    .map((value) => value.trim())
    .filter(Boolean);
  if (list.length) return list.includes(origin);
  return (
    origin === `http://localhost:${PORT}` ||
    origin === `http://127.0.0.1:${PORT}`
  );
}

function applyCors(req, res) {
  const origin = req.headers.origin;
  if (origin && allowedOrigin(origin))
    res.setHeader("Access-Control-Allow-Origin", origin);
  res.setHeader("Vary", "Origin");
  res.setHeader(
    "Access-Control-Allow-Headers",
    [
      "Authorization",
      "Content-Type",
      "Idempotency-Key",
      "PayPal-Request-Id",
      "X-Requested-With",
    ].join(", ")
  );
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, PUT, OPTIONS");
}

async function readRawBody(req) {
  let raw = "";
  for await (const chunk of req) raw += chunk;
  return raw;
}

async function readJson(req) {
  const raw = await readRawBody(req);
  if (!raw.trim()) return {};
  try {
    return JSON.parse(raw);
  } catch {
    throw fail(400, "INVALID_JSON", "Request body must be valid JSON.");
  }
}

function requireServerConfig(keys) {
  const aliases = {
    SUPABASE_URL,
    SUPABASE_ANON_KEY,
    SUPABASE_SERVICE_ROLE_KEY,
    PAYPAL_CLIENT_ID,
    PAYPAL_CLIENT_SECRET,
    PAYPAL_WEBHOOK_ID,
    LIVEKIT_URL,
  };
  const missing = keys.filter((key) => {
    const value = Object.prototype.hasOwnProperty.call(aliases, key)
      ? aliases[key]
      : process.env[key];
    return !value;
  });
  if (missing.length) {
    throw fail(
      503,
      "REQUIRES_CONFIGURATION",
      "Backend configuration is incomplete.",
      { missing }
    );
  }
}

function db() {
  requireServerConfig(["SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY"]);
  return createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

function clampLimit(value, defaultValue, maximum) {
  const number = Number(value);
  if (!Number.isFinite(number) || number <= 0) return defaultValue;
  return Math.min(Math.floor(number), maximum);
}

function requireIdem(req) {
  const key = String(req.headers["idempotency-key"] || "").trim();
  if (!key || key.length < 16 || key.length > 200) {
    throw fail(
      400,
      "PAYMENT_DUPLICATE",
      "A unique Idempotency-Key with 16-200 characters is required."
    );
  }
  return key;
}

// ============================================================================
// Authentication & Profiles
// ============================================================================

async function requireSupabaseUser(req) {
  requireServerConfig(["SUPABASE_URL", "SUPABASE_ANON_KEY"]);
  const authorization = req.headers.authorization || "";
  if (!authorization.startsWith("Bearer ")) {
    throw fail(401, "AUTH_REQUIRED", "Authentication required.");
  }
  const token = authorization.slice(7).trim();
  if (!token) throw fail(401, "AUTH_REQUIRED", "Authentication required.");

  const authClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const { data, error } = await authClient.auth.getUser(token);
  if (error) {
    console.warn("[Creator Hub Auth Error]", normalizeExternalError(error));
    throw fail(401, "AUTH_REQUIRED", "Invalid or expired Supabase session.");
  }
  if (!data?.user)
    throw fail(401, "AUTH_REQUIRED", "Invalid or expired Supabase session.");
  return data.user;
}

async function profileFor(user) {
  const client = db();
  const { data, error } = await client
    .from("profiles")
    .select("id,username,display_name,is_admin")
    .eq("id", user.id)
    .maybeSingle();
  if (error) {
    const normalized = normalizeExternalError(error);
    throw fail(500, "PROFILE_LOOKUP_FAILED", normalized.message, {
      code: normalized.code,
      details: normalized.details,
    });
  }
  return data || { id: user.id, is_admin: false };
}

// ============================================================================
// LIVE helpers
// ============================================================================

function liveRoomParts(pathname) {
  const match = pathname.match(
    /^\/api\/live\/rooms(?:\/([^/]+))?(?:\/(join|start|end|leave|chat))?\/?$/
  );
  if (!match) return null;
  let id = null;
  if (match[1]) {
    try {
      id = decodeURIComponent(match[1]);
    } catch {
      throw fail(400, "INVALID_ROOM", "The LIVE room ID is malformed.");
    }
  }
  return { id, action: match[2] || null };
}

function validateLiveRoomId(id) {
  const value = String(id || "").trim();
  if (!value) throw fail(400, "INVALID_ROOM", "A LIVE room ID is required.");
  return value;
}

async function liveRoomById(client, id) {
  const roomId = validateLiveRoomId(id);
  const { data, error } = await client
    .from("live_sessions")
    .select("*")
    .eq("id", roomId)
    .maybeSingle();
  if (error) {
    const normalized = normalizeExternalError(error);
    throw fail(500, "LIVE_ROOM_LOOKUP_FAILED", normalized.message, {
      code: normalized.code,
      details: normalized.details,
    });
  }
  if (!data) throw fail(404, "LIVE_ROOM_NOT_FOUND", "LIVE room not found.");
  return data;
}

async function isRoomModerator(client, liveId, userId) {
  const { data, error } = await client
    .from("live_room_moderators")
    .select("user_id")
    .eq("live_id", liveId)
    .eq("user_id", userId)
    .maybeSingle();
  if (error) throw error;
  return !!data;
}

async function canPublishLive(client, room, userId) {
  if (room.status === "ended") return false;
  if (String(room.host_id) === String(userId)) return true;
  const { data, error } = await client
    .from("live_guests")
    .select("id")
    .eq("live_id", room.id)
    .eq("user_id", userId)
    .eq("status", "accepted")
    .maybeSingle();
  if (error) throw error;
  return !!data;
}

async function updateLivePresence(client, roomId, userId) {
  const now = new Date().toISOString();
  const { error: upsertError } = await client
    .from("live_viewer_presence")
    .upsert(
      { live_id: roomId, user_id: userId, last_seen_at: now },
      { onConflict: "live_id,user_id" }
    );
  if (upsertError) throw upsertError;
  const cutoff = new Date(Date.now() - 75_000).toISOString();
  const { data, error } = await client
    .from("live_viewer_presence")
    .select("user_id")
    .eq("live_id", roomId)
    .gte("last_seen_at", cutoff);
  if (error) throw error;
  const { data: roomInfo, error: roomInfoError } = await client
    .from("live_sessions").select("host_id,status").eq("id", roomId).maybeSingle();
  if (roomInfoError) throw roomInfoError;
  const { data: acceptedGuests, error: guestError } = await client
    .from("live_guests").select("user_id").eq("live_id", roomId).eq("status", "accepted");
  if (guestError) throw guestError;
  const participants = new Set([String(roomInfo && roomInfo.host_id || ""), ...(acceptedGuests || []).map((g) => String(g.user_id))]);
  const viewerCount = Array.isArray(data) ? data.filter((row) => !participants.has(String(row.user_id))).length : 0;
  const { error: updateError } = await client
    .from("live_sessions")
    .update({ viewer_count: viewerCount, updated_at: now })
    .eq("id", roomId);
  if (updateError) throw updateError;
  return viewerCount;
}

async function listRoomProfiles(client, rows, key) {
  const ids = [...new Set((rows || []).map((row) => row[key]).filter(Boolean))];
  if (!ids.length) return {};
  const { data, error } = await client
    .from("profiles")
    .select("id,username,display_name,avatar_url")
    .in("id", ids);
  if (error) throw error;
  return Object.fromEntries((data || []).map((profile) => [String(profile.id), profile]));
}

function validateLiveRoomName(roomName) {
  const value = String(roomName || "").trim();
  if (!validateRoomName(value))
    throw fail(400, "INVALID_ROOM", "The LIVE room name is invalid.");
  return value;
}

// ============================================================================
// PayPal API
// ============================================================================

async function paypalToken() {
  requireServerConfig(["PAYPAL_CLIENT_ID", "PAYPAL_CLIENT_SECRET"]);
  const auth = Buffer.from(
    `${PAYPAL_CLIENT_ID}:${PAYPAL_CLIENT_SECRET}`
  ).toString("base64");
  const response = await fetch(`${PAYPAL_BASE}/v1/oauth2/token`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${auth}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: "grant_type=client_credentials",
  });
  const text = await response.text();
  if (!response.ok) {
    throw fail(
      502,
      "PAYMENT_PROVIDER_ERROR",
      `PayPal OAuth failed (${response.status}).`
    );
  }
  let data;
  try {
    data = JSON.parse(text);
  } catch {
    throw fail(
      502,
      "PAYMENT_PROVIDER_ERROR",
      "PayPal OAuth returned an invalid response."
    );
  }
  if (!data.access_token)
    throw fail(
      502,
      "PAYMENT_PROVIDER_ERROR",
      "PayPal did not return an access token."
    );
  return data.access_token;
}

async function paypal(path, options = {}) {
  const token = await paypalToken();
  const headers = {
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json",
    ...(options.headers || {}),
  };
  const response = await fetch(`${PAYPAL_BASE}${path}`, {
    ...options,
    headers,
  });
  const text = await response.text();
  let data = {};
  try {
    data = text ? JSON.parse(text) : {};
  } catch {
    data = {};
  }
  if (!response.ok) {
    throw fail(
      502,
      "PAYMENT_PROVIDER_ERROR",
      data?.message || `PayPal request failed (${response.status}).`,
      {
        paypalStatus: response.status,
        body: data,
      }
    );
  }
  return data;
}

async function verifyPaypalWebhookSignature({ rawBody, headers }) {
  requireServerConfig([
    "PAYPAL_CLIENT_ID",
    "PAYPAL_CLIENT_SECRET",
    "PAYPAL_WEBHOOK_ID",
  ]);
  let event;
  try {
    event = JSON.parse(rawBody);
  } catch {
    throw fail(
      400,
      "PAYPAL_WEBHOOK_INVALID",
      "PayPal webhook body must be valid JSON."
    );
  }
  const verification = await paypal(
    "/v1/notifications/verify-webhook-signature",
    {
      method: "POST",
      body: JSON.stringify({
        auth_algo: headers["paypal-auth-algo"],
        cert_url: headers["paypal-cert-url"],
        transmission_id: headers["paypal-transmission-id"],
        transmission_sig: headers["paypal-transmission-sig"],
        transmission_time: headers["paypal-transmission-time"],
        webhook_id: PAYPAL_WEBHOOK_ID,
        webhook_event: event,
      }),
    }
  );
  if (verification.verification_status !== "SUCCESS") {
    throw fail(
      400,
      "PAYPAL_WEBHOOK_INVALID",
      "PayPal webhook signature verification failed."
    );
  }
  return event;
}

async function paymentByOrder(client, orderId) {
  const { data, error } = await client
    .from("payments")
    .select("*")
    .eq("provider_order_id", orderId)
    .maybeSingle();
  if (error) throw error;
  if (!data) throw fail(404, "PAYMENT_FAILED", "Payment order was not found.");
  return data;
}

async function creditCapture(client, payment, captureId) {
  if (!captureId)
    throw fail(
      502,
      "PAYMENT_VERIFICATION_FAILED",
      "PayPal capture ID was not returned."
    );
  const idempotencyKey = `paypal:capture:${captureId}`;
  const { error } = await client.rpc("credit_coins", {
    p_user: payment.user_id,
    p_amount: payment.package_coins,
    p_source: "paypal",
    p_provider: "paypal",
    p_reference: captureId,
    p_reason: `PayPal coin purchase ${payment.provider_order_id}`,
    p_idempotency_key: idempotencyKey,
  });
  if (error) throw error;

  const { error: updateError } = await client
    .from("payments")
    .update({
      provider_capture_id: captureId,
      status: "completed",
      credited: true,
      updated_at: new Date().toISOString(),
    })
    .eq("id", payment.id);
  if (updateError) throw updateError;
  return true;
}

async function coinPackage(client, coins) {
  const { data, error } = await client
    .from("coin_packages")
    .select("*")
    .eq("coins", coins)
    .eq("active", true)
    .maybeSingle();
  if (error) throw error;
  if (!data)
    throw fail(
      400,
      "INVALID_PACKAGE",
      "The requested coin package is not available."
    );
  return data;
}

// ============================================================================
// Wallet Helpers
// ============================================================================

async function ensureWallet(client, userId) {
  const { error } = await client
    .from("wallets")
    .upsert(
      { user_id: userId },
      { onConflict: "user_id", ignoreDuplicates: true }
    );
  if (error) throw error;
}

async function walletFor(client, userId) {
  await ensureWallet(client, userId);
  const { data, error } = await client
    .from("wallets")
    .select("coin_balance,diamond_balance,lifetime_gifts_sent")
    .eq("user_id", userId)
    .maybeSingle();
  if (error) throw error;
  return (
    data || { coin_balance: 0, diamond_balance: 0, lifetime_gifts_sent: 0 }
  );
}

// ============================================================================
// LIVE chat profile decoration
// ============================================================================

async function attachChatSenderProfiles(client, messages) {
  const rows = Array.isArray(messages) ? messages : [];
  const senderIds = [
    ...new Set(rows.map((message) => message.sender_id).filter(Boolean)),
  ];
  if (!senderIds.length)
    return rows.map((message) => ({
      ...message,
      username: null,
      display_name: null,
      senderName: "Participant",
    }));

  const { data: profiles, error } = await client
    .from("profiles")
    .select("id,username,display_name")
    .in("id", senderIds);
  if (error) {
    const normalized = normalizeExternalError(error);
    throw fail(500, "LIVE_CHAT_PROFILE_LOOKUP_FAILED", normalized.message, {
      code: normalized.code,
      details: normalized.details,
    });
  }

  const byId = new Map(
    (profiles || []).map((profile) => [String(profile.id), profile])
  );
  return rows.map((message) => {
    const profile = byId.get(String(message.sender_id)) || null;
    const username = profile?.username || null;
    const displayName = profile?.display_name || null;
    return {
      ...message,
      username,
      display_name: displayName,
      senderName: displayName || username || "Participant",
    };
  });
}

// ============================================================================
// HTTP Router
// ============================================================================

const server = http.createServer(async (req, res) => {
  applyCors(req, res);
  const url = new URL(req.url, `http://${req.headers.host || "localhost"}`);
  const pathname = url.pathname.replace(/\/+$/, "") || "/";
  const method = req.method;

  if (method === "OPTIONS") {
    res.writeHead(204, secureHeaders());
    return res.end();
  }

  try {
    // Infrastructure & Health
    if (pathname === "/api/health" && method === "GET") {
      return ok(res, {
        status: "operational",
        livekit: livekitHealth(),
        time: new Date().toISOString(),
      });
    }
    if (pathname === "/api/livekit/health" && method === "GET") {
      return ok(res, { livekit: livekitHealth() });
    }

    // Public Configuration
    if (pathname === "/api/config/public" && method === "GET") {
      return ok(res, {
        frontendUrl: FRONTEND_URL || null,
        livekitUrl: LIVEKIT_URL || null,
        paypalEnvironment: PAYPAL_ENV,
        features: {
          livekit: livekitHealth().configured,
          paypal: Boolean(PAYPAL_CLIENT_ID && PAYPAL_CLIENT_SECRET),
        },
      });
    }

    // LiveKit Token Generation
    if (pathname === "/api/livekit/token" && method === "POST") {
      const user = await requireSupabaseUser(req);
      const body = await readJson(req);
      const client = db();
      let roomName = null;
      let canPublish = false;
      const roomId = body.roomId ? String(body.roomId).trim() : null;

      if (roomId) {
        const room = await liveRoomById(client, roomId);
        roomName = String(room.room_name).trim();
        canPublish = await canPublishLive(client, room, user.id);
      } else if (body.roomName && String(body.roomName).trim()) {
        roomName = String(body.roomName).trim();
        const { data: room, error } = await client
          .from("live_sessions")
          .select("id,host_id,room_name,status")
          .eq("room_name", roomName)
          .maybeSingle();
        if (error) throw error;
        if (!room)
          throw fail(404, "LIVE_ROOM_NOT_FOUND", "LIVE room not found.");
        canPublish = await canPublishLive(client, room, user.id);
      } else {
        throw fail(400, "INVALID_ROOM", "A valid LIVE room is required.");
      }

      const token = await createLiveKitToken({
        userId: user.id,
        roomName,
        canPublish,
        ttlSeconds: body.ttlSeconds,
      });
      return ok(res, {
        token,
        serverUrl: LIVEKIT_URL,
        canPublish,
        roomName,
        identity: user.id,
      });
    }

    // LIVE Rooms - List
    if (pathname === "/api/live/rooms" && method === "GET") {
      const client = db();
      const limit = clampLimit(url.searchParams.get("limit"), 30, 100);
      const { data, error } = await client
        .from("live_sessions")
        .select("id,host_id,title,category,status,viewer_count,started_at")
        .eq("status", "live")
        .order("started_at", { ascending: false })
        .limit(limit);
      if (error) {
        const normalized = normalizeExternalError(error);
        throw fail(500, "LIVE_ROOMS_QUERY_FAILED", normalized.message, {
          code: normalized.code,
          details: normalized.details,
        });
      }
      return ok(res, { rooms: data || [] });
    }

    // LIVE Room - Create
    if (pathname === "/api/live/rooms" && method === "POST") {
      const user = await requireSupabaseUser(req);
      const body = await readJson(req);
      const title = String(body.title || "")
        .trim()
        .slice(0, 200);
      if (!title)
        throw fail(400, "INVALID_INPUT", "A stream title is required.");
      const client = db();
      const randomId = globalThis.crypto?.randomUUID?.();
      const roomName = ("chl_" + (randomId || Date.now().toString(36))).replace(
        /-/g,
        ""
      );
      const insertData = {
        host_id: user.id,
        room_name: roomName,
        title,
        category: body.category
          ? String(body.category).trim().slice(0, 60)
          : null,
        status: "pending",
      };
      const { data, error } = await client
        .from("live_sessions")
        .insert(insertData)
        .select("*")
        .single();
      if (error) {
        const normalized = normalizeExternalError(error);
        throw fail(500, "LIVE_ROOM_CREATION_FAILED", normalized.message, {
          code: normalized.code,
          details: normalized.details,
        });
      }
      return ok(res, data);
    }

    // LIVE room tools: guests, moderators, presence, taps and share counts.
    const roomToolMatch = pathname.match(/^\/api\/live\/rooms\/([^/]+)\/(guests|moderators|interactions|presence)(?:\/([^/]+))?$/);
    if (roomToolMatch) {
      const user = await requireSupabaseUser(req);
      let roomId;
      let targetId = null;
      try {
        roomId = decodeURIComponent(roomToolMatch[1]);
        targetId = roomToolMatch[3] ? decodeURIComponent(roomToolMatch[3]) : null;
      } catch {
        throw fail(400, "INVALID_ROOM", "The LIVE room ID is malformed.");
      }
      const tool = roomToolMatch[2];
      const client = db();
      const room = await liveRoomById(client, roomId);
      const isHost = String(room.host_id) === String(user.id);
      const isModerator = isHost ? false : await isRoomModerator(client, room.id, user.id);
      const canManage = isHost || isModerator;

      if (tool === "presence" && method === "POST") {
        if (room.status === "ended") throw fail(409, "LIVE_ENDED", "This LIVE session has ended.");
        const viewerCount = await updateLivePresence(client, room.id, user.id);
        return ok(res, { viewerCount, serverTime: new Date().toISOString() });
      }

      if (tool === "interactions" && method === "GET") {
        const { data, error } = await client.from("live_interaction_totals")
          .select("kind,total").eq("live_id", room.id);
        if (error) throw error;
        const totals = { taps: 0, shares: 0 };
        (data || []).forEach((row) => {
          if (row.kind === "tap") totals.taps = Number(row.total || 0);
          if (row.kind === "share") totals.shares = Number(row.total || 0);
        });
        return ok(res, totals);
      }
      if (tool === "interactions" && method === "POST") {
        const body = await readJson(req);
        const kind = String(body.kind || "");
        if (kind !== "tap" && kind !== "share") throw fail(400, "INVALID_INTERACTION_KIND", "Interaction must be tap or share.");
        const { data, error } = await client.rpc("record_live_interaction", {
          p_live: room.id, p_user: user.id, p_kind: kind
        });
        if (error) {
          const message = String(error.message || "");
          if (message.includes("INTERACTION_RATE_LIMITED")) throw fail(429, "INTERACTION_RATE_LIMITED", "Please slow down for a moment.");
          if (message.includes("LIVE_NOT_ACTIVE")) throw fail(409, "LIVE_NOT_ACTIVE", "This LIVE room is not active.");
          throw error;
        }
        const { data: totalsRows, error: totalsError } = await client.from("live_interaction_totals")
          .select("kind,total").eq("live_id", room.id);
        if (totalsError) throw totalsError;
        const totals = { taps: 0, shares: 0 };
        (totalsRows || []).forEach((row) => {
          if (row.kind === "tap") totals.taps = Number(row.total || 0);
          if (row.kind === "share") totals.shares = Number(row.total || 0);
        });
        return ok(res, { interaction: data, ...totals });
      }

      if (tool === "guests" && method === "GET" && !targetId) {
        let query = client.from("live_guests")
          .select("id,live_id,user_id,status,slot,mic_on,cam_on,pinned,joined_at")
          .eq("live_id", room.id).order("slot", { ascending: true });
        if (!canManage) query = query.eq("user_id", user.id);
        const { data, error } = await query;
        if (error) throw error;
        const rows = data || [];
        const profiles = await listRoomProfiles(client, rows, "user_id");
        return ok(res, { guests: rows.map((guest) => ({ ...guest, profile: profiles[String(guest.user_id)] || null })) });
      }
      if (tool === "guests" && method === "POST" && !targetId) {
        if (!canManage) throw fail(403, "FORBIDDEN", "Only the host or an assigned moderator can invite guests.");
        if (room.status === "ended") throw fail(409, "LIVE_ENDED", "This LIVE session has ended.");
        const body = await readJson(req);
        const username = String(body.username || "").trim().replace(/^@/, "");
        const requestedId = String(body.userId || "").trim();
        if (!username && !requestedId) throw fail(400, "INVALID_INPUT", "Enter the creator's username.");
        let profileQuery = client.from("profiles").select("id,username,display_name,avatar_url");
        profileQuery = username ? profileQuery.eq("username", username) : profileQuery.eq("id", requestedId);
        const { data: target, error: targetError } = await profileQuery.maybeSingle();
        if (targetError) throw targetError;
        if (!target) throw fail(404, "CREATOR_NOT_FOUND", "No Creator Hub account was found for that username.");
        if (String(target.id) === String(room.host_id)) throw fail(400, "INVALID_GUEST", "The host is already in the room.");
        const { data: existing, error: existingError } = await client.from("live_guests")
          .select("id,status").eq("live_id", room.id).eq("user_id", target.id).maybeSingle();
        if (existingError) throw existingError;
        if (existing && existing.status === "accepted") throw fail(409, "GUEST_ALREADY_JOINED", "This creator is already a guest.");
        const guestRecord = { live_id: room.id, user_id: target.id, status: "invited", slot: null };
        const { data, error } = await client.from("live_guests").upsert(guestRecord, { onConflict: "live_id,user_id" })
          .select("id,live_id,user_id,status,slot,mic_on,cam_on,pinned,joined_at").single();
        if (error) throw error;
        return ok(res, { guest: { ...data, profile: target } });
      }
      if (tool === "guests" && method === "PATCH" && targetId) {
        const { data: guest, error: guestError } = await client.from("live_guests")
          .select("id,live_id,user_id,status,mic_on,cam_on,pinned").eq("id", targetId).eq("live_id", room.id).maybeSingle();
        if (guestError) throw guestError;
        if (!guest) throw fail(404, "GUEST_NOT_FOUND", "Guest invitation was not found.");
        const body = await readJson(req);
        const action = String(body.action || "");
        const isInvitee = String(guest.user_id) === String(user.id);
        const updates = {};
        if (["accept", "reject"].includes(action)) {
          if (!isInvitee || guest.status !== "invited") throw fail(403, "FORBIDDEN", "Only the invited creator can accept or reject this invitation.");
          updates.status = action === "accept" ? "accepted" : "rejected";
          if (action === "accept") { updates.joined_at = new Date().toISOString(); updates.slot = null; }
        } else if (["remove", "leave"].includes(action)) {
          if (action === "remove" && !canManage) throw fail(403, "FORBIDDEN", "Only the host or a moderator can remove a guest.");
          if (action === "leave" && !isInvitee) throw fail(403, "FORBIDDEN", "You can only leave your own guest slot.");
          updates.status = action === "remove" ? "removed" : "left";
          updates.slot = null;
        } else if (["micOn", "camOn", "pinned"].some((key) => Object.prototype.hasOwnProperty.call(body, key))) {
          if (!canManage && (!isInvitee || guest.status !== "accepted")) throw fail(403, "FORBIDDEN", "Only the host, moderators, or the accepted guest can change these controls.");
          if (typeof body.micOn === "boolean") updates.mic_on = body.micOn;
          if (typeof body.camOn === "boolean") updates.cam_on = body.camOn;
          if (typeof body.pinned === "boolean") {
            if (!canManage) throw fail(403, "FORBIDDEN", "Only the host or a moderator can pin a guest.");
            updates.pinned = body.pinned;
          }
        } else {
          throw fail(400, "INVALID_GUEST_ACTION", "Choose accept, reject, remove, leave, or a supported guest control.");
        }
        const { data, error } = await client.from("live_guests").update(updates).eq("id", guest.id).eq("live_id", room.id)
          .select("id,live_id,user_id,status,slot,mic_on,cam_on,pinned,joined_at").single();
        if (error) throw error;
        return ok(res, { guest: data });
      }

      if (tool === "moderators" && method === "GET" && !targetId) {
        const { data, error } = await client.from("live_room_moderators")
          .select("live_id,user_id,assigned_by,created_at").eq("live_id", room.id).order("created_at", { ascending: true });
        if (error) throw error;
        const rows = data || [];
        const profiles = await listRoomProfiles(client, rows, "user_id");
        return ok(res, { moderators: rows.map((mod) => ({ ...mod, profile: profiles[String(mod.user_id)] || null })) });
      }
      if (tool === "moderators" && method === "POST" && !targetId) {
        if (!isHost) throw fail(403, "FORBIDDEN", "Only the host can add moderators.");
        const body = await readJson(req);
        const username = String(body.username || "").trim().replace(/^@/, "");
        if (!username) throw fail(400, "INVALID_INPUT", "Enter the moderator's username.");
        const { data: target, error: targetError } = await client.from("profiles")
          .select("id,username,display_name,avatar_url").eq("username", username).maybeSingle();
        if (targetError) throw targetError;
        if (!target) throw fail(404, "CREATOR_NOT_FOUND", "No Creator Hub account was found for that username.");
        if (String(target.id) === String(room.host_id)) throw fail(400, "INVALID_MODERATOR", "The host already has room-owner permissions.");
        const { data, error } = await client.from("live_room_moderators")
          .upsert({ live_id: room.id, user_id: target.id, assigned_by: user.id }, { onConflict: "live_id,user_id" })
          .select("live_id,user_id,assigned_by,created_at").single();
        if (error) throw error;
        return ok(res, { moderator: { ...data, profile: target } });
      }
      if (tool === "moderators" && method === "DELETE" && targetId) {
        if (!isHost) throw fail(403, "FORBIDDEN", "Only the host can remove moderators.");
        if (targetId === String(room.host_id)) throw fail(400, "INVALID_MODERATOR", "The host cannot be removed from their own room.");
        const { error } = await client.from("live_room_moderators").delete().eq("live_id", room.id).eq("user_id", targetId);
        if (error) throw error;
        return ok(res, { removed: true, userId: targetId });
      }
    }

    // LIVE Room Actions
    const liveParts = liveRoomParts(pathname);
    if (liveParts && liveParts.id) {
      const client = db();
      if (!liveParts.action && method === "GET") {
        const room = await liveRoomById(client, liveParts.id);
        return ok(res, room);
      }

      if (liveParts.action === "join" && method === "POST") {
        const user = await requireSupabaseUser(req);
        const room = await liveRoomById(client, liveParts.id);
        if (room.status === "ended")
          throw fail(409, "LIVE_ENDED", "This LIVE session has ended.");
        const isHost = String(room.host_id) === String(user.id);
        const canPublish = await canPublishLive(client, room, user.id);
        const viewerCount = await updateLivePresence(client, room.id, user.id);
        return ok(res, {
          joined: true,
          roomId: room.id,
          status: room.status,
          roomName: room.room_name,
          isHost,
          canPublish,
          viewerCount,
        });
      }

      if (liveParts.action === "leave" && method === "POST") {
        const user = await requireSupabaseUser(req);
        const room = await liveRoomById(client, liveParts.id);
        const { error } = await client.from("live_viewer_presence")
          .delete().eq("live_id", room.id).eq("user_id", user.id);
        if (error) throw error;
        const cutoff = new Date(Date.now() - 75_000).toISOString();
        const { data: active, error: activeError } = await client.from("live_viewer_presence")
          .select("user_id").eq("live_id", room.id).gte("last_seen_at", cutoff);
        if (activeError) throw activeError;
        const { data: acceptedGuests, error: guestsError } = await client.from("live_guests")
          .select("user_id").eq("live_id", room.id).eq("status", "accepted");
        if (guestsError) throw guestsError;
        const nonViewers = new Set([String(room.host_id), ...(acceptedGuests || []).map((g) => String(g.user_id))]);
        const viewerCount = (active || []).filter((row) => !nonViewers.has(String(row.user_id))).length;
        const { error: updateError } = await client.from("live_sessions")
          .update({ viewer_count: viewerCount, updated_at: new Date().toISOString() }).eq("id", room.id);
        if (updateError) throw updateError;
        return ok(res, { left: true, viewerCount });
      }

      if (liveParts.action === "start" && method === "POST") {
        const user = await requireSupabaseUser(req);
        const room = await liveRoomById(client, liveParts.id);
        if (String(room.host_id) !== String(user.id)) {
          throw fail(
            403,
            "FORBIDDEN",
            "Only the host can start this LIVE session."
          );
        }
        if (room.status === "ended")
          throw fail(409, "LIVE_ENDED", "This LIVE session has already ended.");

        // Only mark the database LIVE after LiveKit confirms this host has
        // published both camera and microphone tracks in the expected room.
        await verifyHostPublishing(
          validateLiveRoomName(room.room_name),
          user.id
        );
        const { data, error } = await client
          .from("live_sessions")
          .update({
            status: "live",
            started_at: room.started_at || new Date().toISOString(),
            updated_at: new Date().toISOString(),
          })
          .eq("id", room.id)
          .select("*")
          .single();
        if (error) {
          const normalized = normalizeExternalError(error);
          throw fail(500, "LIVE_ROOM_START_FAILED", normalized.message, {
            code: normalized.code,
            details: normalized.details,
          });
        }
        return ok(res, data);
      }

      if (liveParts.action === "end" && method === "POST") {
        const user = await requireSupabaseUser(req);
        const room = await liveRoomById(client, liveParts.id);
        if (String(room.host_id) !== String(user.id)) {
          throw fail(
            403,
            "FORBIDDEN",
            "Only the host can end this LIVE session."
          );
        }
        const { data, error } = await client
          .from("live_sessions")
          .update({
            status: "ended",
            ended_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          })
          .eq("id", room.id)
          .select("*")
          .single();
        if (error) {
          const normalized = normalizeExternalError(error);
          throw fail(500, "LIVE_ROOM_END_FAILED", normalized.message, {
            code: normalized.code,
            details: normalized.details,
          });
        }
        return ok(res, data);
      }

      if (liveParts.action === "leave" && method === "POST") {
        await requireSupabaseUser(req);
        const room = await liveRoomById(client, liveParts.id);
        return ok(res, { left: true, roomId: room.id, status: room.status });
      }
    }

    // PayPal Payments - Create Order
    if (pathname === "/api/payments/paypal/create-order" && method === "POST") {
      const user = await requireSupabaseUser(req);
      const idempotencyKey = requireIdem(req);
      const body = await readJson(req);
      const coins = Number(body.coins);
      if (!Number.isSafeInteger(coins) || coins <= 0) {
        throw fail(400, "INVALID_PACKAGE", "A valid coin package is required.");
      }
      const client = db();
      const pkg = await coinPackage(client, coins);
      const { data: existingPayment, error: existingError } = await client
        .from("payments")
        .select("*")
        .eq("idempotency_key", idempotencyKey)
        .maybeSingle();
      if (existingError) throw existingError;
      if (existingPayment) {
        if (String(existingPayment.user_id) !== String(user.id)) {
          throw fail(
            409,
            "IDEMPOTENCY_CONFLICT",
            "This idempotency key is already associated with another account."
          );
        }
        return ok(res, {
          orderId: existingPayment.provider_order_id,
          status: existingPayment.status,
          coins: existingPayment.package_coins,
          amount: Number(existingPayment.amount),
        });
      }

      const amountUsd = Number(pkg.price_usd).toFixed(2);
      const payload = {
        intent: "CAPTURE",
        purchase_units: [
          {
            reference_id: `pkg_${pkg.coins}`,
            description: `${pkg.coins} Creator Coins`,
            amount: { currency_code: "USD", value: amountUsd },
          },
        ],
        application_context: {
          user_action: "PAY_NOW",
          ...(PAYPAL_RETURN_URL
            ? {
                return_url: `${PAYPAL_RETURN_URL}/wallet?success=true`,
                cancel_url: `${PAYPAL_RETURN_URL}/wallet?canceled=true`,
              }
            : {}),
        },
      };
      const order = await paypal("/v2/checkout/orders", {
        method: "POST",
        headers: { "PayPal-Request-Id": idempotencyKey },
        body: JSON.stringify(payload),
      });
      const orderId = order.id;
      if (!orderId)
        throw fail(
          502,
          "PAYMENT_PROVIDER_ERROR",
          "PayPal did not return an order ID."
        );

      const { error: insertError } = await client.from("payments").insert({
        user_id: user.id,
        provider: "paypal",
        provider_order_id: orderId,
        package_id: pkg.id,
        package_coins: pkg.coins,
        amount: amountUsd,
        currency: "USD",
        status: "pending",
        idempotency_key: idempotencyKey,
        metadata: order,
      });
      if (insertError) {
        const normalized = normalizeExternalError(insertError);
        throw fail(500, "PAYMENT_RECORD_FAILED", normalized.message);
      }
      return ok(res, {
        orderId,
        status: "pending",
        coins: pkg.coins,
        amount: Number(amountUsd),
      });
    }

    // PayPal Payments - Capture Order
    if (
      pathname === "/api/payments/paypal/capture-order" &&
      method === "POST"
    ) {
      const user = await requireSupabaseUser(req);
      const body = await readJson(req);
      const orderId = String(body.orderId || "").trim();
      if (!orderId)
        throw fail(400, "INVALID_INPUT", "A PayPal order ID is required.");
      const client = db();
      const payment = await paymentByOrder(client, orderId);
      if (String(payment.user_id) !== String(user.id)) {
        throw fail(403, "FORBIDDEN", "You do not own this payment order.");
      }
      if (payment.status === "completed" || payment.credited) {
        return ok(res, {
          captured: true,
          coins: payment.package_coins,
          status: "completed",
        });
      }
      const captureResponse = await paypal(
        `/v2/checkout/orders/${encodeURIComponent(orderId)}/capture`,
        {
          method: "POST",
          headers: payment.idempotency_key
            ? { "PayPal-Request-Id": payment.idempotency_key }
            : {},
        }
      );
      const captureUnits =
        captureResponse?.purchase_units?.[0]?.payments?.captures || [];
      const successfulCapture = captureUnits.find(
        (capture) => capture.status === "COMPLETED"
      );
      const captureId = successfulCapture?.id || null;
      if (
        captureResponse.status === "COMPLETED" &&
        successfulCapture &&
        captureId
      ) {
        await creditCapture(client, payment, captureId);
        return ok(res, {
          captured: true,
          coins: payment.package_coins,
          status: "completed",
        });
      }
      throw fail(
        502,
        "PAYMENT_CAPTURE_FAILED",
        `PayPal capture did not complete successfully (status: ${
          captureResponse.status || "unknown"
        }).`
      );
    }

    // PayPal Payout Info Management
    if (pathname === "/api/payments/paypal/info" && method === "GET") {
      const user = await requireSupabaseUser(req);
      const client = db();
      const { data, error } = await client
        .from("paypal_payout_info")
        .select("paypal_email,is_verified,created_at,updated_at")
        .eq("user_id", user.id)
        .maybeSingle();
      if (error) {
        const normalized = normalizeExternalError(error);
        throw fail(500, "PAYPAL_INFO_LOOKUP_FAILED", normalized.message);
      }
      return ok(res, {
        paypalEmail: data?.paypal_email || null,
        isVerified: data?.is_verified || false,
        updatedAt: data?.updated_at || null,
      });
    }

    if (pathname === "/api/payments/paypal/info" && method === "PUT") {
      const user = await requireSupabaseUser(req);
      const body = await readJson(req);
      const paypalEmail = String(body.paypalEmail || body.email || "")
        .trim()
        .toLowerCase();
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!paypalEmail || !emailRegex.test(paypalEmail)) {
        throw fail(
          400,
          "INVALID_INPUT",
          "A valid PayPal email address is required."
        );
      }
      const client = db();
      const { data, error } = await client
        .from("paypal_payout_info")
        .upsert(
          {
            user_id: user.id,
            paypal_email: paypalEmail,
            updated_at: new Date().toISOString(),
          },
          { onConflict: "user_id" }
        )
        .select("paypal_email,is_verified,updated_at")
        .single();
      if (error) {
        const normalized = normalizeExternalError(error);
        throw fail(500, "PAYPAL_INFO_SAVE_FAILED", normalized.message);
      }
      return ok(res, {
        saved: true,
        paypalEmail: data.paypal_email,
        isVerified: data.is_verified,
        updatedAt: data.updated_at,
      });
    }

    // PayPal Webhook - signature verification + idempotent credit
    if (pathname === "/api/payments/webhook" && method === "POST") {
      const rawBody = await readRawBody(req);
      let event;
      try {
        event = await verifyPaypalWebhookSignature({
          rawBody,
          headers: req.headers,
        });
      } catch (error) {
        if (error?.code === "PAYPAL_WEBHOOK_INVALID") throw error;
        throw fail(
          error?.status || 400,
          error?.code || "PAYPAL_WEBHOOK_INVALID",
          error?.message || "PayPal webhook could not be verified."
        );
      }
      if (event.event_type === "PAYMENT.CAPTURE.COMPLETED") {
        const captureId = String(event.resource?.id || "").trim();
        const orderId = String(
          event.resource?.supplementary_data?.related_ids?.order_id ||
            event.resource?.custom_id ||
            ""
        ).trim();
        if (!captureId || !orderId) {
          throw fail(
            400,
            "PAYPAL_WEBHOOK_INVALID",
            "PayPal capture webhook is missing order/capture identifiers."
          );
        }
        const client = db();
        const payment = await paymentByOrder(client, orderId);
        if (!payment.credited) await creditCapture(client, payment, captureId);
      }
      return ok(res, { received: true, eventType: event.event_type || null });
    }

    // LIVE room chat — persisted real messages only
    const chatParts = liveRoomParts(pathname);
    if (
      chatParts &&
      chatParts.id &&
      chatParts.action === "chat" &&
      method === "POST"
    ) {
      const user = await requireSupabaseUser(req);
      const client = db();
      const room = await liveRoomById(client, chatParts.id);
      if (room.status === "ended")
        throw fail(409, "LIVE_ENDED", "This LIVE session has ended.");
      const body = await readJson(req);
      const message = String(body.body || "")
        .trim()
        .slice(0, 1000);
      if (!message)
        throw fail(400, "INVALID_MESSAGE", "A message is required.");
      const { data, error } = await client
        .from("live_chat_messages")
        .insert({ live_id: room.id, sender_id: user.id, body: message })
        .select("id,live_id,sender_id,body,created_at")
        .single();
      if (error) throw error;
      const [decorated] = await attachChatSenderProfiles(client, [data]);
      return ok(res, decorated);
    }

    if (
      chatParts &&
      chatParts.id &&
      chatParts.action === "chat" &&
      method === "GET"
    ) {
      await requireSupabaseUser(req);
      const room = await liveRoomById(db(), chatParts.id);
      const client = db();
      const { data, error } = await client
        .from("live_chat_messages")
        .select("id,live_id,sender_id,body,created_at")
        .eq("live_id", room.id)
        .order("created_at", { ascending: true })
        .limit(100);
      if (error) throw error;
      const messages = await attachChatSenderProfiles(client, data || []);
      return ok(res, { messages });
    }

    // Gifter progress is computed from the server-side gift ledger, never client counters.
    if (pathname === "/api/gifter/progress" && method === "GET") {
      const user = await requireSupabaseUser(req);
      const client = db();
      const { data: progress, error } = await client
        .from("gifter_progress")
        .select("user_id,eligible_coins_spent,gifts_sent,distinct_gift_types,yard_gifts_sent,yard_distinct_gift_types,gifter_level,level_title,badge_category,updated_at")
        .eq("user_id", user.id)
        .maybeSingle();
      if (error) {
        const normalized = normalizeExternalError(error);
        throw fail(500, "GIFTER_PROGRESS_LOOKUP_FAILED", normalized.message, {
          code: normalized.code,
          details: normalized.details,
        });
      }
      const current = progress || {
        user_id: user.id, eligible_coins_spent: 0, gifts_sent: 0,
        distinct_gift_types: 0, yard_gifts_sent: 0, yard_distinct_gift_types: 0,
        gifter_level: 0, level_title: "Newcomer", badge_category: "Visiting Supporter"
      };
      const { data: currentLevel, error: currentLevelError } = await client
        .from("gifter_level_thresholds")
        .select("level,coin_threshold,emoji,title,badge_category")
        .eq("level", Number(current.gifter_level || 0))
        .maybeSingle();
      if (currentLevelError) throw currentLevelError;
      const { data: nextLevel, error: nextLevelError } = await client
        .from("gifter_level_thresholds")
        .select("level,coin_threshold,emoji,title,badge_category")
        .gt("level", Number(current.gifter_level || 0))
        .order("level", { ascending: true })
        .limit(1)
        .maybeSingle();
      if (nextLevelError) throw nextLevelError;
      const { data: achievementRows, error: achievementError } = await client
        .from("gifter_achievement_definitions")
        .select("code,name,description,criteria")
        .order("code", { ascending: true });
      if (achievementError) throw achievementError;
      const achievements = (achievementRows || []).filter((item) => {
        const criteria = item.criteria || {};
        return (!criteria.giftCount || Number(current.gifts_sent) >= Number(criteria.giftCount)) &&
          (!criteria.variety || Number(current.distinct_gift_types) >= Number(criteria.variety)) &&
          (!criteria.yardGiftCount || Number(current.yard_gifts_sent) >= Number(criteria.yardGiftCount)) &&
          (!criteria.yardVariety || Number(current.yard_distinct_gift_types) >= Number(criteria.yardVariety));
      }).map(({ code, name, description }) => ({ code, name, description }));
      const spent = Number(current.eligible_coins_spent || 0);
      const floor = Number(currentLevel && currentLevel.coin_threshold || 0);
      const next = nextLevel ? Number(nextLevel.coin_threshold) : null;
      const percent = next == null ? 100 : Math.max(0, Math.min(100,
        Math.round(((spent - floor) / Math.max(1, next - floor)) * 100)));
      return ok(res, {
        progress: {
          ...current,
          eligible_coins_spent: spent,
          gifts_sent: Number(current.gifts_sent || 0),
          distinct_gift_types: Number(current.distinct_gift_types || 0),
          yard_gifts_sent: Number(current.yard_gifts_sent || 0),
          yard_distinct_gift_types: Number(current.yard_distinct_gift_types || 0),
          current_level_threshold: floor,
          next_level: nextLevel || null,
          level_progress_percent: percent,
          level_emoji: currentLevel && currentLevel.emoji || "🌱",
          achievements
        }
      });
    }

    // Gift catalogue — active records from the server-owned catalogue.
    if (pathname === "/api/gifts" && method === "GET") {
      await requireSupabaseUser(req);
      const client = db();
      const { data, error } = await client
        .from("gifts")
        .select("id,name,category,emoji,catalog_order,animation_key,sound_key,coin_price,diamond_value,active")
        .eq("active", true)
        .order("catalog_order", { ascending: true })
        .order("coin_price", { ascending: true });
      if (error) {
        const normalized = normalizeExternalError(error);
        throw fail(500, "GIFTS_LOOKUP_FAILED", normalized.message, {
          code: normalized.code,
          details: normalized.details,
        });
      }
      const gifts = (data || []).map((gift) => ({
        id: gift.id,
        name: gift.name,
        category: gift.category,
        emoji: gift.emoji || "🎁",
        catalogOrder: Number(gift.catalog_order || 0),
        animationKey: gift.animation_key || gift.rarity || "everyday",
        soundKey: gift.sound_key || "soft",
        coinPrice: gift.coin_price == null ? null : Number(gift.coin_price),
        diamondValue: gift.diamond_value == null ? null : Number(gift.diamond_value),
        active: Boolean(gift.active),
      }));
      return ok(res, { gifts });
    }

    // Wallet transactions and gifts — server-authoritative only
    if (pathname === "/api/wallet/transactions" && method === "GET") {
      const user = await requireSupabaseUser(req);
      const client = db();
      const limit = clampLimit(url.searchParams.get("limit"), 20, 100);
      const { data, error } = await client
        .from("coin_ledger")
        .select(
          "id,amount,balance_before,balance_after,source,provider,reference,reason,created_at"
        )
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(limit);
      if (error) throw error;
      return ok(res, { transactions: data || [] });
    }

    if (pathname === "/api/wallet/gift" && method === "POST") {
      const user = await requireSupabaseUser(req);
      const idem = String(req.headers["idempotency-key"] || "").trim();
      if (!idem || idem.length < 16 || idem.length > 200) {
        throw fail(
          400,
          "GIFT_IDEMPOTENCY_REQUIRED",
          "A unique Idempotency-Key is required."
        );
      }
      const body = await readJson(req);
      const recipientId = String(body.recipientId || "").trim();
      const giftName = String(body.gift || "").trim();
      const liveId = body.liveId ? String(body.liveId).trim() : null;
      const quantity = body.quantity == null ? 1 : Number(body.quantity);
      if (!Number.isInteger(quantity) || quantity < 1 || quantity > 10) {
        throw fail(400, "INVALID_GIFT_QUANTITY", "Choose a gift quantity between 1 and 10.");
      }
      if (!recipientId || !giftName)
        throw fail(
          400,
          "INVALID_GIFT",
          "Gift recipient and gift are required."
        );
      if (recipientId === String(user.id))
        throw fail(400, "INVALID_GIFT", "You cannot gift yourself.");
      const client = db();
      if (liveId) {
        const room = await liveRoomById(client, liveId);
        if (room.status !== "live") throw fail(409, "LIVE_NOT_ACTIVE", "Gifts can only be sent to an active LIVE room.");
        if (String(room.host_id) !== recipientId) throw fail(400, "INVALID_GIFT_RECIPIENT", "A LIVE gift must target this room's host.");
      }
      const { data: gift, error: giftError } = await client
        .from("gifts")
        .select("id,name,coin_price,diamond_value")
        .eq("name", giftName)
        .eq("active", true)
        .maybeSingle();
      if (giftError) throw giftError;
      if (!gift)
        throw fail(404, "GIFT_NOT_FOUND", "The selected gift is unavailable.");
      if (Number(gift.diamond_value || 0) <= 0) {
        throw fail(503, "GIFT_PAYOUT_NOT_CONFIGURED", "Creator diamond conversion is not configured for this gift yet. No coins were charged.");
      }
      const { data, error } = quantity === 1
        ? await client.rpc("send_gift", {
            p_sender: user.id, p_recipient: recipientId, p_gift: gift.id,
            p_live: liveId, p_idempotency_key: idem,
          })
        : await client.rpc("send_gift_combo", {
            p_sender: user.id, p_recipient: recipientId, p_gift: gift.id,
            p_live: liveId, p_idempotency_key: idem, p_quantity: quantity,
          });
      if (error) {
        const msg = String(error.message || "");
        if (msg.includes("INVALID_GIFT_QUANTITY")) throw fail(400, "INVALID_GIFT_QUANTITY", "Choose between 1 and 10 gifts.");
        if (msg.includes("INSUFFICIENT_COINS")) throw fail(402, "INSUFFICIENT_COINS", "There are not enough coins for this gift quantity.");
        throw error;
      }
      return ok(res, {
        transaction: quantity === 1 ? data : null,
        transactions: quantity === 1 ? [data] : data,
        quantity,
        gift: {
          id: gift.id,
          name: gift.name,
          coinPrice: gift.coin_price == null ? null : Number(gift.coin_price),
          diamondValue: gift.diamond_value == null ? null : Number(gift.diamond_value),
        },
      });
    }

    // Wallet Balance
    if (
      (pathname === "/api/wallet" || pathname === "/api/wallet/balance") &&
      method === "GET"
    ) {
      const user = await requireSupabaseUser(req);
      const client = db();
      const wallet = await walletFor(client, user.id);
      return ok(res, {
        coinBalance: wallet.coin_balance,
        diamondBalance: wallet.diamond_balance,
        lifetimeGiftsSent: wallet.lifetime_gifts_sent,
      });
    }

    // 404 Fallback
    return send(res, 404, {
      ok: false,
      code: "NOT_FOUND",
      error: "Route not found.",
    });
  } catch (error) {
    return errorResponse(res, error);
  }
});

server.listen(PORT, () => {
  console.log(`[Creator Hub Backend] Running successfully on port ${PORT}`);
});
