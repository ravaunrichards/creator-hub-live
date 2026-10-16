import "dotenv/config";
import http from "node:http";
import { RoomServiceClient } from "livekit-server-sdk";
import { URL } from "node:url";
import { handleTeamsRoute } from "./teams-routes.js";
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
// Creator Hub Live - Backend HTTP API
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

async function requireAdminUser(req) {
  const user = await requireSupabaseUser(req);
  const profile = await profileFor(user);
  if (!profile.is_admin) throw fail(403, "ADMIN_REQUIRED", "Administrator access is required.");
  return { ...user, is_admin: true };
}

// ============================================================================
// LIVE helpers
// ============================================================================

function liveKitRoomService() {
  const apiKey = process.env.LIVEKIT_API_KEY;
  const apiSecret = process.env.LIVEKIT_API_SECRET;
  if (!LIVEKIT_URL || !apiKey || !apiSecret) {
    throw fail(503, "LIVEKIT_NOT_CONFIGURED", "LiveKit room controls are not configured.");
  }
  const serviceUrl = LIVEKIT_URL.replace(/^wss:/i, "https:").replace(/^ws:/i, "http:");
  return new RoomServiceClient(serviceUrl, apiKey, apiSecret);
}

function liveGuestParts(pathname) {
  const match = pathname.match(/^\/api\/live\/rooms\/([^/]+)\/guests(?:\/([^/]+)(?:\/([^/]+))?)?\/?$/);
  if (!match) return null;
  let roomId;
  try { roomId = decodeURIComponent(match[1]); }
  catch { throw fail(400, "INVALID_ROOM", "The LIVE room ID is malformed."); }
  return { roomId, action: match[2] || null, targetId: match[3] ? decodeURIComponent(match[3]) : null };
}

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

// Service-role database access bypasses browser RLS, so verify LIVE audience
// access before returning room details or minting a LiveKit token.
async function canAccessLiveRoom(client, room, user) {
  if (!room || !user || !user.id) return false;
  const viewerId = String(user.id);
  const hostId = String(room.host_id || "");
  if (viewerId === hostId) return true;
  if (room.status !== "live" || !hostId) return false;

  const [blockedByViewer, blockedByHost] = await Promise.all([
    client.from("blocks").select("blocker_id").eq("blocker_id", viewerId).eq("blocked_id", hostId).limit(1),
    client.from("blocks").select("blocker_id").eq("blocker_id", hostId).eq("blocked_id", viewerId).limit(1),
  ]);
  if (blockedByViewer.error || blockedByHost.error) throw fail(503, "LIVE_ACCESS_CHECK_FAILED", "Could not verify LIVE access. Please try again.");
  if ((blockedByViewer.data || []).length || (blockedByHost.data || []).length) return false;

  const [profileResult, guestResult, moderatorResult, followResult] = await Promise.all([
    client.from("profiles").select("privacy").eq("id", hostId).maybeSingle(),
    client.from("live_guests").select("status").eq("live_id", room.id).eq("user_id", viewerId).maybeSingle(),
    client.from("live_room_moderators").select("user_id").eq("live_id", room.id).eq("user_id", viewerId).limit(1),
    client.from("follows").select("status").eq("follower_id", viewerId).eq("followee_id", hostId).eq("status", "accepted").limit(1),
  ]);
  if (profileResult.error || guestResult.error || moderatorResult.error || followResult.error) {
    throw fail(503, "LIVE_ACCESS_CHECK_FAILED", "Could not verify LIVE access. Please try again.");
  }
  const privacy = profileResult.data && profileResult.data.privacy;
  const privateProfile = !!(privacy && typeof privacy === "object" && privacy.account === "private");
  const following = (followResult.data || []).length > 0;
  const invited = guestResult.data && ["invited", "accepted"].includes(String(guestResult.data.status));
  const moderator = (moderatorResult.data || []).length > 0;
  if (invited || moderator) return true;
  const audience = ["public", "followers", "private"].includes(String(room.audience)) ? String(room.audience) : "public";
  if (audience === "private") return false;
  if (audience === "followers" || privateProfile) return following;
  return true;
}

async function assertLiveRoomAccess(client, room, user) {
  if (!(await canAccessLiveRoom(client, room, user))) {
    throw fail(404, "LIVE_ROOM_UNAVAILABLE", "This LIVE is private, unavailable, or you do not have permission to view it.");
  }
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

const MAX_CUSTOM_COIN_QUANTITY = 50000;

async function coinPriceForAmount(client, coins) {
  if (!Number.isSafeInteger(coins) || coins < 1 || coins > MAX_CUSTOM_COIN_QUANTITY) {
    throw fail(400, "INVALID_COIN_QUANTITY", `Choose a whole-number quantity between 1 and ${MAX_CUSTOM_COIN_QUANTITY.toLocaleString("en-US")} coins.`);
  }
  const exact = await client.from("coin_packages").select("*").eq("coins", coins).eq("active", true).maybeSingle();
  if (exact.error) throw exact.error;
  if (exact.data) return { ...exact.data, custom: false };

  // Custom quantities use the active 1,000-coin package as the server-side
  // reference rate. Existing exact packages retain their own published price.
  const reference = await client.from("coin_packages").select("coins,price_usd").eq("coins", 1000).eq("active", true).maybeSingle();
  if (reference.error) throw reference.error;
  if (!reference.data || Number(reference.data.coins) !== 1000 || !Number.isFinite(Number(reference.data.price_usd)) || Number(reference.data.price_usd) <= 0) {
    throw fail(503, "CUSTOM_PURCHASE_NOT_CONFIGURED", "Custom coin purchases are not configured. Keep using the available coin packages until an administrator configures the 1,000-coin reference price.");
  }
  const unitPrice = Number(reference.data.price_usd) / 1000;
  const priceUsd = Math.max(0.01, Math.round(unitPrice * coins * 100) / 100);
  if (!Number.isFinite(priceUsd) || priceUsd > 500) throw fail(400, "COIN_QUANTITY_LIMIT", "This quantity exceeds the supported custom checkout limit.");
  return { coins, price_usd: priceUsd.toFixed(2), active: true, custom: true };
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
    // The Teams API implementation already lives in its own module. Route
    // matching must be wired here before the fallback 404 so the existing
    // Teams page's /api/teams requests are not treated as unknown endpoints.
    if (pathname === "/api/teams" || pathname.startsWith("/api/teams/")) {
      const teamHandled = await handleTeamsRoute({
        pathname, method, req, res, url, fail, ok, db,
        requireSupabaseUser, readJson, normalizeExternalError,
      });
      // The route module sends responses through ok()/send(), whose return
      // value is intentionally undefined; writableEnded is the reliable signal.
      if (teamHandled || res.writableEnded) return;
    }

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
      let isHost = false;
      let mediaMode = "video";
      let liveRoom = null;
      const roomId = body.roomId ? String(body.roomId).trim() : null;

      if (roomId) {
        const room = await liveRoomById(client, roomId);
        liveRoom = room;
        roomName = String(room.room_name).trim();
        mediaMode = ["video", "audio", "screen"].includes(String(room.media_mode)) ? String(room.media_mode) : "video";
        isHost = String(room.host_id) === String(user.id);
        canPublish = isHost;
        if (!canPublish) {
          const { data: guest, error: guestError } = await client
            .from("live_guests").select("status")
            .eq("live_id", room.id).eq("user_id", user.id).maybeSingle();
          if (guestError) throw guestError;
          canPublish = !!guest && guest.status === "accepted";
        }
      } else if (body.roomName && String(body.roomName).trim()) {
        roomName = String(body.roomName).trim();
        const { data: room, error } = await client
          .from("live_sessions")
          .select("id,host_id,room_name,status,media_mode,audience")
          .eq("room_name", roomName)
          .maybeSingle();
        if (error) throw error;
        if (!room)
          throw fail(404, "LIVE_ROOM_NOT_FOUND", "LIVE room not found.");
        liveRoom = room;
        mediaMode = ["video", "audio", "screen"].includes(String(room.media_mode)) ? String(room.media_mode) : "video";
        isHost = String(room.host_id) === String(user.id);
        canPublish = isHost;
        if (!canPublish) {
          const { data: guest, error: guestError } = await client
            .from("live_guests").select("status")
            .eq("live_id", room.id).eq("user_id", user.id).maybeSingle();
          if (guestError) throw guestError;
          canPublish = !!guest && guest.status === "accepted";
        }
      } else {
        throw fail(400, "INVALID_ROOM", "A valid LIVE room is required.");
      }
      await assertLiveRoomAccess(client, liveRoom, user);
      if (mediaMode === "screen" && !isHost) canPublish = false;

      const { data: profile, error: profileError } = await client.from("profiles")
        .select("username,display_name").eq("id", user.id).maybeSingle();
      if (profileError) throw profileError;
      const participantName = String((profile && profile.display_name) || (profile && profile.username) || "Account name unavailable").trim().slice(0, 128);
      const token = await createLiveKitToken({
        userId: user.id,
        roomName,
        canPublish,
        participantName,
        mediaMode,
        isHost,
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

    // LIVE guest workflow. Requests and host decisions are stored in the DB;
    // accepted guests receive server-authorized LiveKit publish permissions.
    const guestParts = liveGuestParts(pathname);
    if (guestParts) {
      const user = await requireSupabaseUser(req);
      const client = db();
      const room = await liveRoomById(client, guestParts.roomId);
      if (room.status === "ended") throw fail(409, "LIVE_ENDED", "This LIVE session has ended.");
      const hostOwnsRoom = String(room.host_id) === String(user.id);

      if (guestParts.action === "status" && method === "GET") {
        const { data, error } = await client.from("live_guests")
          .select("id,live_id,user_id,status,slot,mic_on,cam_on,pinned,joined_at,created_at")
          .eq("live_id", room.id).eq("user_id", user.id).maybeSingle();
        if (error) throw error;
        return ok(res, { guest: data || null });
      }

      if (!guestParts.action && method === "GET") {
        if (!hostOwnsRoom) throw fail(403, "FORBIDDEN", "Only the host can view the guest request queue.");
        const { data, error } = await client.from("live_guests")
          .select("id,live_id,user_id,status,slot,mic_on,cam_on,pinned,joined_at,created_at")
          .eq("live_id", room.id).in("status", ["requested", "invited", "accepted"])
          .order("created_at", { ascending: true });
        if (error) throw error;
        const ids = [...new Set((data || []).map((g) => g.user_id).filter(Boolean))];
        let profiles = [];
        if (ids.length) {
          const result = await client.from("profiles").select("id,username,display_name,avatar_url").in("id", ids);
          if (result.error) throw result.error;
          profiles = result.data || [];
        }
        const byId = new Map(profiles.map((profile) => [String(profile.id), profile]));
        return ok(res, { guests: (data || []).map((guest) => ({ ...guest, profile: byId.get(String(guest.user_id)) || null })) });
      }

      if (guestParts.action === "request" && method === "POST") {
        if (room.media_mode === "screen") throw fail(409, "SCREEN_LIVE_HAS_NO_GUEST_STAGE", "This broadcast is screen-sharing-only; guest stage requests are disabled.");
        if (hostOwnsRoom) throw fail(400, "HOST_CANNOT_REQUEST_GUEST", "The host already owns this stage.");
        const { data: existing, error: existingError } = await client.from("live_guests")
          .select("id,status").eq("live_id", room.id).eq("user_id", user.id).maybeSingle();
        if (existingError) throw existingError;
        if (existing && existing.status === "accepted") throw fail(409, "ALREADY_GUEST", "You are already an accepted guest.");
        if (existing) {
          const { data, error } = await client.from("live_guests").update({ status: "requested", created_at: new Date().toISOString() })
            .eq("id", existing.id).select("id,status").single();
          if (error) throw error;
          return ok(res, { request: data });
        }
        const { data, error } = await client.from("live_guests")
          .insert({ live_id: room.id, user_id: user.id, status: "requested" })
          .select("id,status").single();
        if (error) throw error;
        return ok(res, { request: data });
      }

      if (guestParts.action === "accept" && method === "POST") {
        if (room.media_mode === "screen") throw fail(409, "SCREEN_LIVE_HAS_NO_GUEST_STAGE", "This broadcast is screen-sharing-only; guests cannot publish to this room.");
        if (!hostOwnsRoom) throw fail(403, "FORBIDDEN", "Only the host can accept a guest.");
        const body = await readJson(req);
        const targetId = String(body.userId || guestParts.targetId || "").trim();
        if (!targetId) throw fail(400, "INVALID_GUEST", "A guest user ID is required.");
        const { data: activeGuestRows, error: activeGuestError } = await client.from("live_guests")
          .select("id,user_id").eq("live_id", room.id).eq("status", "accepted");
        if (activeGuestError) throw activeGuestError;
        const alreadyAccepted = (activeGuestRows || []).filter((guest) => String(guest.user_id) !== String(targetId)).length;
        if (alreadyAccepted >= 8) throw fail(409, "GUEST_STAGE_FULL", "The stage supports the host and up to eight guests.");
        const { data, error } = await client.from("live_guests")
          .update({ status: "accepted", joined_at: new Date().toISOString() })
          .eq("live_id", room.id).eq("user_id", targetId).in("status", ["requested", "invited", "accepted"])
          .select("id,live_id,user_id,status,slot,mic_on,cam_on,pinned").maybeSingle();
        if (error) throw error;
        if (!data) throw fail(404, "GUEST_REQUEST_NOT_FOUND", "No pending guest request was found.");
        // Update an already connected viewer in-place; never disconnect the room.
        let publishPermissionUpdated = false;
        try {
          const guestSources = room.media_mode === "audio" ? [2] : [1, 2];
          await liveKitRoomService().updateParticipant(room.room_name, targetId, {
            permission: { canPublish: true, canSubscribe: true, canPublishData: true, canPublishSources: guestSources }
          });
          publishPermissionUpdated = true;
        } catch (e) {
          // A not-yet-connected guest is fine: their next token uses the accepted row.
          console.info("[LIVE guest] permission update deferred until participant connects:", e && e.message);
        }
        return ok(res, { guest: data, publishPermissionUpdated });
      }

      if (guestParts.action === "reject" && method === "POST") {
        if (!hostOwnsRoom) throw fail(403, "FORBIDDEN", "Only the host can reject a guest.");
        const body = await readJson(req);
        const targetId = String(body.userId || guestParts.targetId || "").trim();
        if (!targetId) throw fail(400, "INVALID_GUEST", "A guest user ID is required.");
        const { data, error } = await client.from("live_guests").update({ status: "rejected" })
          .eq("live_id", room.id).eq("user_id", targetId).eq("status", "requested")
          .select("id,user_id,status").maybeSingle();
        if (error) throw error;
        if (!data) throw fail(404, "GUEST_REQUEST_NOT_FOUND", "No pending guest request was found.");
        return ok(res, { guest: data });
      }

      if (guestParts.action === "mute-track" && method === "POST") {
        if (!hostOwnsRoom) throw fail(403, "FORBIDDEN", "Only the host can control a guest track.");
        const body = await readJson(req);
        const targetId = String(body.userId || "").trim();
        const trackSid = String(body.trackSid || "").trim();
        if (!targetId || !trackSid || trackSid.length > 128) throw fail(400, "INVALID_TRACK", "A valid guest and track are required.");
        const { data: guest, error: guestError } = await client.from("live_guests")
          .select("status").eq("live_id", room.id).eq("user_id", targetId).maybeSingle();
        if (guestError) throw guestError;
        if (!guest || guest.status !== "accepted") throw fail(404, "GUEST_NOT_FOUND", "This participant is not an accepted guest.");
        const service = liveKitRoomService();
        let participant;
        try { participant = await service.getParticipant(room.room_name, targetId); }
        catch (_) { throw fail(404, "GUEST_NOT_CONNECTED", "The guest is not connected to this LIVE room."); }
        const published = Array.isArray(participant.tracks) ? participant.tracks : [];
        if (!published.some((track) => String(track.sid || "") === trackSid)) throw fail(403, "TRACK_NOT_OWNED", "That track does not belong to this guest.");
        const muted = body.muted === true;
        await service.mutePublishedTrack(room.room_name, targetId, trackSid, muted);
        return ok(res, { userId: targetId, trackSid, muted });
      }

      if (guestParts.action === "remove" && method === "POST") {
        if (!hostOwnsRoom) throw fail(403, "FORBIDDEN", "Only the host can remove a guest.");
        const body = await readJson(req);
        const targetId = String(body.userId || guestParts.targetId || "").trim();
        if (!targetId || targetId === String(room.host_id)) throw fail(400, "INVALID_GUEST", "A valid guest user ID is required.");
        const { data, error } = await client.from("live_guests").update({ status: "removed" })
          .eq("live_id", room.id).eq("user_id", targetId).eq("status", "accepted")
          .select("id,user_id,status").maybeSingle();
        if (error) throw error;
        if (!data) throw fail(404, "GUEST_NOT_FOUND", "The accepted guest was not found.");
        try { await liveKitRoomService().removeParticipant(room.room_name, targetId); }
        catch (e) { console.info("[LIVE guest] participant already disconnected:", e && e.message); }
        return ok(res, { guest: data, removedFromRoom: true });
      }

      if (guestParts.action === "leave" && method === "POST") {
        if (hostOwnsRoom) throw fail(400, "HOST_CANNOT_LEAVE_AS_GUEST", "The host cannot leave their own room as a guest.");
        const { data, error } = await client.from("live_guests").update({ status: "left" })
          .eq("live_id", room.id).eq("user_id", user.id).eq("status", "accepted")
          .select("id,status").maybeSingle();
        if (error) throw error;
        try {
          await liveKitRoomService().updateParticipant(room.room_name, String(user.id), {
            permission: { canPublish: false, canSubscribe: true, canPublishData: true, canPublishSources: [] }
          });
        } catch (e) { console.info("[LIVE guest] publish permission revoke deferred:", e && e.message); }
        return ok(res, { guest: data || null, roomConnectionPreserved: true });
      }

      throw fail(404, "LIVE_GUEST_ROUTE_NOT_FOUND", "LIVE guest action not found.");
    }

    // LIVE Rooms - List
    if (pathname === "/api/live/rooms" && method === "GET") {
      const client = db();
      const limit = clampLimit(url.searchParams.get("limit"), 30, 100);
      const { data, error } = await client
        .from("live_sessions")
        .select("id,host_id,title,category,media_mode,audience,status,viewer_count,started_at,ended_at")
        .eq("status", "live")
        .eq("audience", "public")
        .is("ended_at", null)
        .order("started_at", { ascending: false })
        .limit(limit);
      if (error) {
        const normalized = normalizeExternalError(error);
        throw fail(500, "LIVE_ROOMS_QUERY_FAILED", normalized.message, {
          code: normalized.code,
          details: normalized.details,
        });
      }
      const rooms = data || [];
      const hostIds = [...new Set(rooms.map((room) => room.host_id).filter(Boolean))];
      let publicHostIds = new Set();
      if (hostIds.length) {
        const profiles = await client.from("profiles").select("id,privacy").in("id", hostIds);
        if (profiles.error) throw profiles.error;
        publicHostIds = new Set((profiles.data || []).filter((profile) => !(profile.privacy && typeof profile.privacy === "object" && profile.privacy.account === "private")).map((profile) => String(profile.id)));
      }
      return ok(res, { rooms: rooms.filter((room) => publicHostIds.has(String(room.host_id))) });
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
      const mediaMode = String(body.mediaMode || "video").trim().toLowerCase();
      if (!["video", "audio", "screen"].includes(mediaMode)) {
        throw fail(400, "INVALID_MEDIA_MODE", "Choose video, audio-only, or screen-sharing LIVE.");
      }
      const client = db();
      let audience = String(body.audience || "").trim().toLowerCase();
      if (!audience) {
        const settingsResult = await client.from("user_settings").select("live").eq("user_id", user.id).maybeSingle();
        if (settingsResult.error) throw settingsResult.error;
        audience = String(settingsResult.data && settingsResult.data.live && settingsResult.data.live.audience || "public").trim().toLowerCase();
      }
      if (!["public", "followers", "private"].includes(audience)) {
        throw fail(400, "INVALID_LIVE_AUDIENCE", "Choose a public, followers-only, or private LIVE audience.");
      }
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
        media_mode: mediaMode,
        audience,
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

    // LIVE Room Actions
    const liveParts = liveRoomParts(pathname);
    if (liveParts && liveParts.id) {
      const client = db();
      if (!liveParts.action && method === "GET") {
        const user = await requireSupabaseUser(req);
        const room = await liveRoomById(client, liveParts.id);
        await assertLiveRoomAccess(client, room, user);
        return ok(res, room);
      }

      if (liveParts.action === "join" && method === "POST") {
        const user = await requireSupabaseUser(req);
        const room = await liveRoomById(client, liveParts.id);
        await assertLiveRoomAccess(client, room, user);
        if (room.status === "ended")
          throw fail(409, "LIVE_ENDED", "This LIVE session has ended.");
        const isHost = String(room.host_id) === String(user.id);
        let canPublish = isHost;
        if (!isHost) {
          const { data: guest, error: guestError } = await client
            .from("live_guests").select("status")
            .eq("live_id", room.id).eq("user_id", user.id).maybeSingle();
          if (guestError) throw guestError;
          canPublish = !!guest && guest.status === "accepted";
        }
        if (room.media_mode === "screen" && !isHost) canPublish = false;
        return ok(res, {
          joined: true,
          roomId: room.id,
          status: room.status,
          roomName: room.room_name,
          isHost,
          canPublish,
        });
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

        // Only mark the database LIVE after LiveKit confirms the media required
        // by this room's authoritative mode has actually been published.
        await verifyHostPublishing(
          validateLiveRoomName(room.room_name),
          user.id,
          room.media_mode || "video"
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

    // Server-authoritative coin quote for custom quantities. The client never
    // submits the payable amount; the same pricing helper is used at checkout.
    if (pathname === "/api/payments/coin-quote" && method === "GET") {
      await requireSupabaseUser(req);
      const coins = Number(url.searchParams.get("coins"));
      if (!Number.isSafeInteger(coins) || coins < 1 || coins > MAX_CUSTOM_COIN_QUANTITY) {
        throw fail(400, "INVALID_COIN_QUANTITY", `Choose a whole-number quantity between 1 and ${MAX_CUSTOM_COIN_QUANTITY.toLocaleString("en-US")} coins.`);
      }
      const quote = await coinPriceForAmount(db(), coins);
      return ok(res, { coins, amountUsd: Number(quote.price_usd).toFixed(2), custom: !!quote.custom, currency: "USD", maxCoins: MAX_CUSTOM_COIN_QUANTITY });
    }

    // PayPal Payments - Create Order
    if (pathname === "/api/payments/paypal/create-order" && method === "POST") {
      const user = await requireSupabaseUser(req);
      const idempotencyKey = requireIdem(req);
      const body = await readJson(req);
      const coins = Number(body.coins);
      if (!Number.isSafeInteger(coins) || coins < 1 || coins > MAX_CUSTOM_COIN_QUANTITY) {
        throw fail(400, "INVALID_COIN_QUANTITY", `Choose a whole-number quantity between 1 and ${MAX_CUSTOM_COIN_QUANTITY.toLocaleString("en-US")} coins.`);
      }
      const client = db();
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
          custom: !existingPayment.package_id,
        });
      }

      const pkg = await coinPriceForAmount(client, coins);
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
                // This SPA uses hash routes but reads the provider's `token`
                // from location.search, so keep the query before the hash.
                return_url: `${PAYPAL_RETURN_URL}/?paypal=success#/wallet`,
                cancel_url: `${PAYPAL_RETURN_URL}/?paypal=cancelled#/wallet`,
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
        package_id: pkg.id || null,
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
        custom: !!pkg.custom,
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

    // Creator diamond payout requests. Diamond reservation and review are atomic DB RPCs.
    if (pathname === "/api/payouts" && method === "GET") {
      const user = await requireSupabaseUser(req);
      const client = db();
      const limit = clampLimit(url.searchParams.get("limit"), 20, 100);
      const { data, error } = await client.from("diamond_payout_requests")
        .select("id,diamond_amount,status,paypal_email,fiat_amount,fiat_currency,admin_note,payment_reference,created_at,updated_at,paid_at,rejected_at")
        .eq("user_id", user.id).order("created_at", { ascending: false }).limit(limit);
      if (error) throw error;
      return ok(res, { requests: data || [] });
    }

    if (pathname === "/api/payouts" && method === "POST") {
      const user = await requireSupabaseUser(req);
      const idem = requireIdem(req);
      const body = await readJson(req);
      const amount = Number(body.diamondAmount);
      if (!Number.isSafeInteger(amount) || amount <= 0 || amount > 1000000000) {
        throw fail(400, "INVALID_DIAMOND_AMOUNT", "Enter a whole-number diamond amount greater than zero.");
      }
      const client = db();
      const { data: payoutInfo, error: infoError } = await client.from("paypal_payout_info")
        .select("paypal_email").eq("user_id", user.id).maybeSingle();
      if (infoError) throw fail(503, "PAYOUT_SETUP_UNAVAILABLE", "PayPal payout settings are unavailable. Please try again later.");
      const email = String(payoutInfo?.paypal_email || "").trim().toLowerCase();
      if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        throw fail(400, "PAYPAL_PAYOUT_NOT_CONFIGURED", "Save a valid PayPal email in Payment Settings before requesting a payout.");
      }
      const { data, error } = await client.rpc("request_diamond_payout", {
        p_user_id: user.id,
        p_diamond_amount: amount,
        p_paypal_email: email,
        p_idempotency_key: idem,
      });
      if (error) {
        if (/insufficient diamonds/i.test(error.message || "")) throw fail(400, "INSUFFICIENT_DIAMONDS", "You do not have enough available diamonds for this request.");
        throw error;
      }
      return send(res, 201, { ok: true, request: data, message: "Payout request submitted. The fiat amount is not calculated until an authorized administrator confirms it." });
    }

    if (pathname === "/api/admin/payouts" && method === "GET") {
      await requireAdminUser(req);
      const client = db();
      const status = String(url.searchParams.get("status") || "").trim();
      const limit = clampLimit(url.searchParams.get("limit"), 50, 100);
      let query = client.from("diamond_payout_requests")
        .select("id,user_id,diamond_amount,status,paypal_email,fiat_amount,fiat_currency,admin_note,payment_reference,created_at,updated_at,paid_at,rejected_at")
        .order("created_at", { ascending: false }).limit(limit);
      if (status && ["pending", "approved", "rejected", "paid"].includes(status)) query = query.eq("status", status);
      const { data, error } = await query;
      if (error) throw error;
      return ok(res, { requests: data || [] });
    }

    const adminPayoutMatch = pathname.match(/^\/api\/admin\/payouts\/([0-9a-f-]{36})$/i);
    if (adminPayoutMatch && method === "PATCH") {
      const admin = await requireAdminUser(req);
      const body = await readJson(req);
      const action = String(body.action || "").trim().toLowerCase();
      if (!["approve", "reject", "mark_paid"].includes(action)) throw fail(400, "INVALID_PAYOUT_ACTION", "Action must be approve, reject, or mark_paid.");
      const fiatAmount = body.fiatAmount == null || body.fiatAmount === "" ? null : Number(body.fiatAmount);
      if (action === "approve" && (!Number.isFinite(fiatAmount) || fiatAmount <= 0 || Math.round(fiatAmount * 100) !== fiatAmount * 100)) {
        throw fail(400, "FIAT_AMOUNT_REQUIRED", "Enter the exact administrator-confirmed fiat amount, to two decimal places.");
      }
      const currency = String(body.fiatCurrency || "").trim().toUpperCase();
      if (action === "approve" && !/^[A-Z]{3}$/.test(currency)) throw fail(400, "FIAT_CURRENCY_REQUIRED", "Enter a valid three-letter fiat currency code.");
      const paymentReference = String(body.paymentReference || "").trim();
      if (action === "mark_paid" && (paymentReference.length < 3 || paymentReference.length > 200)) throw fail(400, "PAYMENT_REFERENCE_REQUIRED", "Enter the PayPal transaction/reference ID after sending the payout.");
      const client = db();
      const { data, error } = await client.rpc("admin_review_diamond_payout", {
        p_request_id: adminPayoutMatch[1], p_admin_id: admin.id, p_action: action,
        p_fiat_amount: action === "approve" ? fiatAmount : null,
        p_fiat_currency: action === "approve" ? currency : null,
        p_admin_note: String(body.adminNote || "").trim().slice(0, 1000) || null,
        p_payment_reference: action === "mark_paid" ? paymentReference : null,
      });
      if (error) {
        const message = error.message || "Payout review failed.";
        if (/not found/i.test(message)) throw fail(404, "PAYOUT_NOT_FOUND", "Payout request not found.");
        if (/already|status|transition/i.test(message)) throw fail(409, "PAYOUT_STATE_CONFLICT", message);
        throw error;
      }
      return ok(res, { request: data, message: action === "reject" ? "Request rejected and diamonds refunded by the server ledger." : action === "approve" ? "Fiat amount confirmed. Send the PayPal payout separately, then mark it paid with its PayPal reference." : "Payout marked paid and audit recorded." });
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

    // Gift catalogue — authenticated and sourced from active database records
    if (pathname === "/api/gifts" && method === "GET") {
      await requireSupabaseUser(req);
      const client = db();
      const { data, error } = await client
        .from("gifts")
        .select("id,name,coin_price,diamond_value,active")
        .eq("active", true)
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
        coinPrice: gift.coin_price == null ? null : Number(gift.coin_price),
        diamondValue:
          gift.diamond_value == null ? null : Number(gift.diamond_value),
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
      if (!recipientId || !giftName)
        throw fail(
          400,
          "INVALID_GIFT",
          "Gift recipient and gift are required."
        );
      if (recipientId === String(user.id))
        throw fail(400, "INVALID_GIFT", "You cannot gift yourself.");
      const client = db();
      const { data: gift, error: giftError } = await client
        .from("gifts")
        .select("id,name,coin_price,diamond_value")
        .eq("name", giftName)
        .eq("active", true)
        .maybeSingle();
      if (giftError) throw giftError;
      if (!gift)
        throw fail(404, "GIFT_NOT_FOUND", "The selected gift is unavailable.");
      const { data, error } = await client.rpc("send_gift", {
        p_sender: user.id,
        p_recipient: recipientId,
        p_gift: gift.id,
        p_live: liveId,
        p_idempotency_key: idem,
      });
      if (error) throw error;
      return ok(res, {
        transaction: data,
        gift: {
          id: gift.id,
          name: gift.name,
          coinPrice: gift.coin_price == null ? null : Number(gift.coin_price),
          diamondValue:
            gift.diamond_value == null ? null : Number(gift.diamond_value),
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
