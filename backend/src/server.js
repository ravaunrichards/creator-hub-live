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

const PAYPAL_ENV_INPUT = String(
  process.env.PAYPAL_ENV || process.env.PAYPAL_MODE || "sandbox"
).trim().toLowerCase();
const PAYPAL_ENV = ["live", "production", "prod"].includes(PAYPAL_ENV_INPUT)
  ? "live"
  : ["sandbox", "test", ""].includes(PAYPAL_ENV_INPUT)
    ? "sandbox"
    : PAYPAL_ENV_INPUT;

const PAYPAL_CLIENT_ID = process.env.PAYPAL_CLIENT_ID || "";
const PAYPAL_CLIENT_SECRET = process.env.PAYPAL_CLIENT_SECRET || "";
const PAYPAL_WEBHOOK_ID = process.env.PAYPAL_WEBHOOK_ID || "";

const PAYPAL_BASE = PAYPAL_ENV === "live"
  ? "https://api-m.paypal.com"
  : PAYPAL_ENV === "sandbox"
    ? "https://api-m.sandbox.paypal.com"
    : "";

const PAYPAL_RETURN_URL = String(
  process.env.PAYPAL_RETURN_URL ||
    (FRONTEND_URL ? FRONTEND_URL.split(",")[0] : "") ||
    ""
).trim();

function buildPaypalReturnUrl(state) {
  if (!PAYPAL_RETURN_URL) return undefined;
  let target;
  try {
    target = new URL(PAYPAL_RETURN_URL);
  } catch {
    throw fail(503, "PAYPAL_RETURN_URL_INVALID", "PayPal return URL configuration is invalid.");
  }
  const localHost = ["localhost", "127.0.0.1", "::1"].includes(target.hostname);
  if (target.protocol !== "https:" && !(target.protocol === "http:" && localHost)) {
    throw fail(503, "PAYPAL_RETURN_URL_INVALID", "PayPal return URL must use HTTPS (HTTP is allowed only for local testing).");
  }
  // PAYPAL_RETURN_URL is sometimes configured with a page path or tracking
  // query. Normalize it to the frontend SPA root so the return token remains
  // in location.search and the hash route remains /wallet.
  target.pathname = "/";
  target.search = "";
  target.searchParams.set("paypal", state);
  target.hash = "/wallet";
  return target.toString();
}

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
  const configured = FRONTEND_URL.split(",").map((value) => value.trim()).filter(Boolean);
  const allowed = configured.map((value) => {
    try { return new URL(value).origin; } catch { return null; }
  }).filter(Boolean);
  if (allowed.length) return allowed.includes(origin);
  return origin === `http://localhost:${PORT}` || origin === `http://127.0.0.1:${PORT}`;
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
  // These methods are used by authenticated edit/delete and payout-review APIs.
  // Omitting them here makes valid routes fail at the browser's CORS preflight.
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, PUT, PATCH, DELETE, OPTIONS");
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

async function liveGuestSettingsForHost(client, hostId) {
  const { data, error } = await client.from("user_settings").select("live").eq("user_id", hostId).maybeSingle();
  if (error) throw error;
  const saved = data && data.live && typeof data.live === "object" ? data.live : {};
  const guestPermissions = saved.guest_permissions === "host_only" ? "host_only" : "allowed";
  const configuredLimit = Number(saved.max_guests);
  const maxGuests = Number.isSafeInteger(configuredLimit) && configuredLimit >= 0 && configuredLimit <= 8 ? configuredLimit : 8;
  return { guestPermissions, maxGuests };
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
  const restrictedProfile = !!(privacy && typeof privacy === "object" && ["private", "followers"].includes(String(privacy.account || "")));
  const following = (followResult.data || []).length > 0;
  const invited = guestResult.data && ["invited", "accepted"].includes(String(guestResult.data.status));
  const moderator = (moderatorResult.data || []).length > 0;
  if (invited || moderator) return true;
  const audience = ["public", "followers", "private"].includes(String(room.audience)) ? String(room.audience) : "public";
  if (audience === "private") return false;
  if (audience === "followers" || restrictedProfile) return following;
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
  if (!PAYPAL_BASE) throw fail(503, "PAYPAL_ENV_INVALID", "PAYPAL_ENV must be sandbox, test, live, production, or prod.");
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
  let data;
  try {
    data = text ? JSON.parse(text) : {};
  } catch {
    data = {};
  }
  if (!response.ok) {
    const providerCode = String(data.error || "").trim();
    const safeDescription = String(data.error_description || data.message || "").trim().slice(0, 180);
    console.error("[PayPal OAuth rejected]", { status: response.status, environment: PAYPAL_ENV, code: providerCode || undefined, description: safeDescription || undefined });
    const configurationHint = response.status === 401
      ? " Verify PAYPAL_ENV matches the client ID and secret from the same PayPal app; sandbox and live credentials are not interchangeable."
      : " Check the PayPal developer status and backend configuration.";
    throw fail(
      502,
      "PAYMENT_PROVIDER_ERROR",
      `PayPal OAuth failed (${response.status})${providerCode ? `: ${providerCode}` : ""}.${configurationHint}`
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

const CREATOR_TASKS = [
  { key: "live_15_minutes", title: "Go LIVE for 15 minutes", description: "Host a real LIVE session for at least 15 minutes.", metric: "live_minutes", target: 15 },
  { key: "publish_one_post", title: "Publish a post", description: "Share one published post with your community.", metric: "posts", target: 1 },
  { key: "live_30_minutes", title: "Go LIVE for 30 minutes", description: "Build a longer conversation with viewers.", metric: "live_minutes", target: 30 },
  { key: "welcome_three_followers", title: "Welcome 3 new followers", description: "Grow your community through genuine follows.", metric: "followers", target: 3 },
  { key: "live_60_minutes", title: "Go LIVE for 1 hour", description: "Host a real broadcast for a full hour.", metric: "live_minutes", target: 60 },
  { key: "publish_three_posts", title: "Publish 3 posts", description: "Share three pieces of published content.", metric: "posts", target: 3 },
];

const MAX_CUSTOM_COIN_QUANTITY = 50000;

async function coinPriceForAmount(client, coins) {
  if (!Number.isSafeInteger(coins) || coins < 1 || coins > MAX_CUSTOM_COIN_QUANTITY) {
    throw fail(400, "INVALID_COIN_QUANTITY", `Choose a whole-number quantity between 1 and ${MAX_CUSTOM_COIN_QUANTITY.toLocaleString("en-US")} coins.`);
  }
  const exact = await client.from("coin_packages").select("*").eq("coins", coins).eq("active", true).maybeSingle();
  if (exact.error) throw exact.error;
  if (exact.data) {
    const priceUsd = Number(exact.data.price);
    if (!Number.isFinite(priceUsd) || priceUsd <= 0) throw fail(503, "COIN_PACKAGE_PRICE_INVALID", "This coin package has an invalid configured price. Please contact support.");
    // The live database column is `price`; normalize it for PayPal code that
    // consumes `price_usd`. Never return an undefined price to checkout.
    return { ...exact.data, price_usd: priceUsd.toFixed(2), custom: false };
  }

  // Custom quantities use the active 1,000-coin package as the server-side
  // reference rate. Exact packages retain their own administrator-set prices.
  const reference = await client.from("coin_packages").select("coins,price").eq("coins", 1000).eq("active", true).maybeSingle();
  if (reference.error) throw reference.error;
  const referencePrice = Number(reference.data?.price);
  if (!reference.data || Number(reference.data.coins) !== 1000 || !Number.isFinite(referencePrice) || referencePrice <= 0) {
    throw fail(503, "CUSTOM_PURCHASE_NOT_CONFIGURED", "Custom coin purchases are not configured. Use an active coin package until the 1,000-coin reference price is available.");
  }
  const unitPrice = referencePrice / 1000;
  const priceUsd = Math.max(0.01, Math.round(unitPrice * coins * 100) / 100);
  if (!Number.isFinite(priceUsd) || priceUsd > 500) throw fail(400, "COIN_QUANTITY_LIMIT", "This quantity exceeds the supported custom checkout limit.");
  return { coins, price_usd: priceUsd.toFixed(2), currency: "USD", active: true, custom: true };
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
    if (pathname === "/api/teams" || pathname.startsWith("/api/teams/") || pathname === "/api/leagues/standings") {
      const teamHandled = await handleTeamsRoute({
        pathname, method, req, res, url, fail, ok, send, db,
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
          paypal: Boolean(PAYPAL_BASE && PAYPAL_CLIENT_ID && PAYPAL_CLIENT_SECRET && PAYPAL_RETURN_URL),
          walletConversion: Number.isSafeInteger(Number(process.env.CHL_COINS_PER_DIAMOND)) && Number(process.env.CHL_COINS_PER_DIAMOND) >= 1 && Number.isSafeInteger(Number(process.env.CHL_DIAMONDS_PER_COIN)) && Number(process.env.CHL_DIAMONDS_PER_COIN) >= 1,
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
      const participantName = String((profile && profile.display_name) || (profile && profile.username) || "Creator").trim().slice(0, 128);
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
        const guestSettings = await liveGuestSettingsForHost(client, room.host_id);
        return ok(res, { guest: data || null, guestPermissions: guestSettings.guestPermissions, maxGuests: guestSettings.maxGuests });
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
        const guestSettings = await liveGuestSettingsForHost(client, room.host_id);
        return ok(res, { guests: (data || []).map((guest) => ({ ...guest, profile: byId.get(String(guest.user_id)) || null })), guestSettings });
      }

      if (guestParts.action === "request" && method === "POST") {
        if (room.media_mode === "screen") throw fail(409, "SCREEN_LIVE_HAS_NO_GUEST_STAGE", "This broadcast is screen-sharing-only; guest stage requests are disabled.");
        if (room.status !== "live") throw fail(409, "LIVE_NOT_STARTED", "Guest requests open when the host starts the LIVE session.");
        if (hostOwnsRoom) throw fail(400, "HOST_CANNOT_REQUEST_GUEST", "The host already owns this stage.");
        const guestSettings = await liveGuestSettingsForHost(client, room.host_id);
        if (guestSettings.maxGuests === 0) throw fail(403, "GUEST_STAGE_DISABLED", "This host has disabled guest slots and is staying full-screen.");
        if (guestSettings.guestPermissions === "host_only") throw fail(403, "GUEST_REQUESTS_CLOSED", "This host is accepting invited guests only.");
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

      if (guestParts.action === "invite" && method === "POST") {
        if (room.media_mode === "screen") throw fail(409, "SCREEN_LIVE_HAS_NO_GUEST_STAGE", "This broadcast is screen-sharing-only; guests cannot publish to this room.");
        if (!hostOwnsRoom) throw fail(403, "FORBIDDEN", "Only the host can invite a guest.");
        const body = await readJson(req);
        const lookup = String(body.username || body.userId || "").trim().replace(/^@/, "");
        if (!lookup || lookup.length > 200) throw fail(400, "INVALID_GUEST", "Enter a Creator Hub username to invite.");
        let targetQuery = client.from("profiles").select("id,username,display_name,account_status");
        targetQuery = /^[0-9a-f]{8}-[0-9a-f-]{27}$/i.test(lookup) ? targetQuery.eq("id", lookup) : targetQuery.eq("username", lookup);
        const { data: target, error: targetError } = await targetQuery.maybeSingle();
        if (targetError) throw targetError;
        if (!target || target.account_status !== "active") throw fail(404, "GUEST_ACCOUNT_NOT_FOUND", "That active Creator Hub account could not be found.");
        if (String(target.id) === String(user.id)) throw fail(400, "HOST_CANNOT_INVITE_SELF", "The host cannot invite their own account.");
        const blocks = await Promise.all([
          client.from("blocks").select("blocker_id").eq("blocker_id", user.id).eq("blocked_id", target.id).maybeSingle(),
          client.from("blocks").select("blocker_id").eq("blocker_id", target.id).eq("blocked_id", user.id).maybeSingle(),
        ]);
        if (blocks.some((result) => result.error)) throw blocks.find((result) => result.error).error;
        if (blocks.some((result) => result.data)) throw fail(403, "GUEST_INVITE_BLOCKED", "This account cannot be invited to the stage.");
        const guestSettings = await liveGuestSettingsForHost(client, room.host_id);
        const { data: activeRows, error: activeError } = await client.from("live_guests").select("user_id").eq("live_id", room.id).eq("status", "accepted");
        if (activeError) throw activeError;
        const { data: existing, error: existingError } = await client.from("live_guests").select("id,status").eq("live_id", room.id).eq("user_id", target.id).maybeSingle();
        if (existingError) throw existingError;
        if (existing && existing.status === "accepted") throw fail(409, "ALREADY_GUEST", "This creator is already on the guest stage.");
        const alreadyOnStage = (activeRows || []).some((g) => String(g.user_id) === String(target.id));
        if (!alreadyOnStage && (activeRows || []).length >= guestSettings.maxGuests) throw fail(409, "GUEST_STAGE_FULL", "The stage has reached the host's configured guest limit.");
        const now = new Date().toISOString();
        let invited;
        if (existing) {
          const result = await client.from("live_guests").update({ status: "invited", created_at: now, updated_at: now }).eq("id", existing.id).select("id,live_id,user_id,status,created_at").single();
          if (result.error) throw result.error;
          invited = result.data;
        } else {
          const result = await client.from("live_guests").insert({ live_id: room.id, user_id: target.id, status: "invited", updated_at: now }).select("id,live_id,user_id,status,created_at").single();
          if (result.error) throw result.error;
          invited = result.data;
        }
        try {
          const { data: targetSettings, error: targetSettingsError } = await client.from("user_settings").select("notifications").eq("user_id", target.id).maybeSingle();
          if (targetSettingsError) throw targetSettingsError;
          if (!targetSettings || !targetSettings.notifications || targetSettings.notifications.live !== false) {
            const { error: notificationError } = await client.from("notifications").insert({ user_id: target.id, type: "live_guest_invite", actor_id: user.id, data: { live_id: room.id, title: room.title || "Creator Hub Live" } });
            if (notificationError) throw notificationError;
          }
        } catch (notificationError) { console.warn("[LIVE guest] invitation saved but notification could not be created:", notificationError && notificationError.message || notificationError); }
        return ok(res, { guest: invited, invited: true });
      }

      if (guestParts.action === "accept-invitation" && method === "POST") {
        if (room.media_mode === "screen") throw fail(409, "SCREEN_LIVE_HAS_NO_GUEST_STAGE", "This broadcast is screen-sharing-only; guests cannot publish to this room.");
        if (hostOwnsRoom) throw fail(400, "HOST_CANNOT_ACCEPT_INVITATION", "The host cannot accept an invitation to their own room.");
        const guestSettings = await liveGuestSettingsForHost(client, room.host_id);
        const { data: activeRows, error: activeError } = await client.from("live_guests").select("user_id").eq("live_id", room.id).eq("status", "accepted");
        if (activeError) throw activeError;
        if ((activeRows || []).filter((g) => String(g.user_id) !== String(user.id)).length >= guestSettings.maxGuests) throw fail(409, "GUEST_STAGE_FULL", "The stage has reached the host's configured guest limit.");
        const { data, error } = await client.from("live_guests").update({ status: "accepted", joined_at: new Date().toISOString(), updated_at: new Date().toISOString() })
          .eq("live_id", room.id).eq("user_id", user.id).eq("status", "invited")
          .select("id,live_id,user_id,status,slot,mic_on,cam_on,pinned").maybeSingle();
        if (error) throw error;
        if (!data) throw fail(404, "GUEST_INVITATION_NOT_FOUND", "There is no pending invitation for your account in this LIVE room.");
        let publishPermissionUpdated = false;
        try {
          const guestSources = room.media_mode === "audio" ? [2] : [1, 2];
          await liveKitRoomService().updateParticipant(room.room_name, String(user.id), { permission: { canPublish: true, canSubscribe: true, canPublishData: true, canPublishSources: guestSources } });
          publishPermissionUpdated = true;
        } catch (e) { console.info("[LIVE guest] invitation accepted before participant connected; next token will grant publishing:", e && e.message); }
        return ok(res, { guest: data, publishPermissionUpdated });
      }

      if (guestParts.action === "accept" && method === "POST") {
        if (room.media_mode === "screen") throw fail(409, "SCREEN_LIVE_HAS_NO_GUEST_STAGE", "This broadcast is screen-sharing-only; guests cannot publish to this room.");
        if (!hostOwnsRoom) throw fail(403, "FORBIDDEN", "Only the host can accept a guest.");
        const body = await readJson(req);
        const targetId = String(body.userId || guestParts.targetId || "").trim();
        if (!targetId) throw fail(400, "INVALID_GUEST", "A guest user ID is required.");
        const guestSettings = await liveGuestSettingsForHost(client, room.host_id);
        const { data: activeGuestRows, error: activeGuestError } = await client.from("live_guests")
          .select("id,user_id").eq("live_id", room.id).eq("status", "accepted");
        if (activeGuestError) throw activeGuestError;
        const alreadyAccepted = (activeGuestRows || []).filter((guest) => String(guest.user_id) !== String(targetId)).length;
        if (alreadyAccepted >= guestSettings.maxGuests) throw fail(409, "GUEST_STAGE_FULL", "The stage has reached the host's configured guest limit.");
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
        const { data: existingGuest, error: existingGuestError } = await client.from("live_guests")
          .select("id,user_id,status,mic_on,cam_on").eq("live_id", room.id).eq("user_id", targetId).eq("status", "accepted").maybeSingle();
        if (existingGuestError) throw existingGuestError;
        if (!existingGuest) throw fail(404, "GUEST_NOT_FOUND", "The accepted guest was not found.");
        // Mark the guest removed first so the guest's permission-change handler cannot
        // race and re-grant publishing while it refreshes its room grant.
        const { data, error } = await client.from("live_guests").update({ status: "removed", mic_on: false, cam_on: false })
          .eq("live_id", room.id).eq("user_id", targetId).eq("status", "accepted")
          .select("id,user_id,status").maybeSingle();
        if (error) throw error;
        if (!data) throw fail(409, "GUEST_STATE_CHANGED", "The guest stage state changed before removal completed.");
        // Revoke publishing but keep subscription enabled so the person returns to viewer mode.
        try {
          await liveKitRoomService().updateParticipant(room.room_name, targetId, {
            permission: { canPublish: false, canSubscribe: true, canPublishData: true, canPublishSources: [] }
          });
        } catch (e) {
          const { error: rollbackError } = await client.from("live_guests").update({ status: "accepted", mic_on: existingGuest.mic_on, cam_on: existingGuest.cam_on })
            .eq("live_id", room.id).eq("user_id", targetId).eq("status", "removed");
          if (rollbackError) console.error("[LIVE guest] removal rollback failed:", rollbackError.message || rollbackError);
          throw fail(503, "GUEST_STAGE_PERMISSION_UPDATE_FAILED", "Could not return this guest to viewer mode. Please retry.", { details: e && e.message });
        }
        return ok(res, { guest: data, removedFromRoom: false, returnedToViewer: true });
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
        publicHostIds = new Set((profiles.data || []).filter((profile) => (!profile.privacy || typeof profile.privacy !== "object" || !profile.privacy.account || profile.privacy.account === "public")).map((profile) => String(profile.id)));
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

    // Private direct messaging. Conversation creation, membership, unread state,
    // and message writes are performed server-side so clients cannot add arbitrary members.
    const postCommentsRoute = pathname.match(/^\/api\/posts\/([0-9a-f-]{36})\/comments$/i);
    if (postCommentsRoute && method === "POST") {
      const user = await requireSupabaseUser(req);
      const postId = postCommentsRoute[1];
      const body = await readJson(req);
      const commentBody = String(body.body || "").trim();
      if (!commentBody || commentBody.length > 2000) throw fail(400, "INVALID_COMMENT", "Comments must contain between 1 and 2,000 characters.");
      const client = db();
      const { data: post, error: postError } = await client.from("posts").select("id,author_id,audience,allow_comments,is_draft,is_test").eq("id", postId).maybeSingle();
      if (postError) throw postError;
      if (!post || post.is_draft || post.is_test) throw fail(404, "POST_NOT_FOUND", "This published post is unavailable.");
      if (post.allow_comments === false) throw fail(403, "COMMENTS_DISABLED", "The creator has disabled comments on this post.");
      const isAuthor = String(post.author_id) === String(user.id);
      if (!isAuthor) {
        if (post.audience === "private") throw fail(403, "POST_PRIVATE", "This post is private.");
        const [{ data: ownBlock, error: ownBlockError }, { data: incomingBlock, error: incomingBlockError }] = await Promise.all([
          client.from("blocks").select("blocker_id").eq("blocker_id", user.id).eq("blocked_id", post.author_id).maybeSingle(),
          client.from("blocks").select("blocker_id").eq("blocker_id", post.author_id).eq("blocked_id", user.id).maybeSingle(),
        ]);
        if (ownBlockError) throw ownBlockError;
        if (incomingBlockError) throw incomingBlockError;
        if (ownBlock || incomingBlock) throw fail(403, "COMMENT_BLOCKED", "You cannot comment on this creator's post.");
        const [{ data: authorSettings, error: settingsError }, { data: authorProfile, error: authorProfileError }, { data: follow, error: followError }] = await Promise.all([
          client.from("user_settings").select("privacy").eq("user_id", post.author_id).maybeSingle(),
          client.from("profiles").select("privacy").eq("id", post.author_id).maybeSingle(),
          client.from("follows").select("follower_id").eq("follower_id", user.id).eq("followee_id", post.author_id).eq("status", "accepted").maybeSingle(),
        ]);
        if (settingsError) throw settingsError;
        if (authorProfileError) throw authorProfileError;
        if (followError) throw followError;
        const authorPrivacy = authorSettings?.privacy || authorProfile?.privacy || {};
        if (authorPrivacy.comments === "nobody") throw fail(403, "COMMENTS_NOT_ALLOWED", "This creator is not accepting comments.");
        if ((post.audience === "followers" || authorPrivacy.comments === "followers" || authorPrivacy.account === "private") && !follow) throw fail(403, "COMMENTS_FOLLOWERS_ONLY", "Follow this creator before commenting.");
      }
      const { data: inserted, error: insertError } = await client.from("comments").insert({ post_id: postId, author_id: user.id, body: commentBody }).select("id,post_id,author_id,body,created_at").single();
      if (insertError) throw insertError;
      return send(res, 201, { ok: true, comment: inserted });
    }

    if (pathname === "/api/creator/tasks" && method === "GET") {
      const user = await requireSupabaseUser(req);
      const client = db();
      let { data: active, error: activeError } = await client.from("creator_task_cycles").select("id,user_id,cycle_no,task_key,assigned_at,completed_at,progress,target").eq("user_id", user.id).is("completed_at", null).order("cycle_no", { ascending: false }).limit(1).maybeSingle();
      if (activeError) throw activeError;
      if (!active) {
        const { data: latest, error: latestError } = await client.from("creator_task_cycles").select("cycle_no").eq("user_id", user.id).order("cycle_no", { ascending: false }).limit(1).maybeSingle();
        if (latestError) throw latestError;
        const cycleNo = Number(latest?.cycle_no || 0) + 1;
        const task = CREATOR_TASKS[(cycleNo - 1) % CREATOR_TASKS.length];
        const { data: inserted, error: insertError } = await client.from("creator_task_cycles").insert({ user_id: user.id, cycle_no: cycleNo, task_key: task.key, assigned_at: new Date().toISOString(), progress: 0, target: task.target }).select("id,user_id,cycle_no,task_key,assigned_at,completed_at,progress,target").single();
        if (insertError && insertError.code !== "23505") throw insertError;
        if (insertError) {
          const retry = await client.from("creator_task_cycles").select("id,user_id,cycle_no,task_key,assigned_at,completed_at,progress,target").eq("user_id", user.id).is("completed_at", null).order("cycle_no", { ascending: false }).limit(1).maybeSingle();
          if (retry.error) throw retry.error;
          active = retry.data;
        } else active = inserted;
      }
      const definition = CREATOR_TASKS.find((task) => task.key === active.task_key) || CREATOR_TASKS[0];
      let progress = 0;
      if (definition.metric === "live_minutes") {
        const { data: sessions, error: sessionsError } = await client.from("live_sessions").select("started_at,ended_at,status").eq("host_id", user.id).gte("started_at", active.assigned_at).order("started_at", { ascending: true }).limit(500);
        if (sessionsError) throw sessionsError;
        const now = Date.now();
        progress = Math.floor((sessions || []).reduce((sum, session) => {
          const start = new Date(session.started_at || active.assigned_at).getTime();
          const end = session.ended_at ? new Date(session.ended_at).getTime() : session.status === "live" ? now : start;
          return sum + Math.max(0, end - start);
        }, 0) / 60000);
      } else if (definition.metric === "posts") {
        const result = await client.from("posts").select("id", { count: "exact", head: true }).eq("author_id", user.id).eq("is_draft", false).eq("is_test", false).gte("created_at", active.assigned_at);
        if (result.error) throw result.error;
        progress = Number(result.count || 0);
      } else if (definition.metric === "followers") {
        const result = await client.from("follows").select("follower_id", { count: "exact", head: true }).eq("followee_id", user.id).eq("status", "accepted").gte("created_at", active.assigned_at);
        if (result.error) throw result.error;
        progress = Number(result.count || 0);
      }
      progress = Math.min(definition.target, Math.max(0, progress));
      let completedTask = null;
      if (progress >= definition.target) {
        const completedAt = new Date().toISOString();
        const { error: completeError } = await client.from("creator_task_cycles").update({ progress, completed_at: completedAt }).eq("id", active.id).is("completed_at", null);
        if (completeError) throw completeError;
        completedTask = { ...definition, cycleNo: active.cycle_no, progress: definition.target, completedAt };
        const nextCycle = Number(active.cycle_no) + 1;
        const nextDefinition = CREATOR_TASKS[(nextCycle - 1) % CREATOR_TASKS.length];
        const { data: nextActive, error: nextError } = await client.from("creator_task_cycles").insert({ user_id: user.id, cycle_no: nextCycle, task_key: nextDefinition.key, assigned_at: completedAt, progress: 0, target: nextDefinition.target }).select("id,user_id,cycle_no,task_key,assigned_at,completed_at,progress,target").single();
        if (nextError && nextError.code !== "23505") throw nextError;
        active = nextActive || { ...active, cycle_no: nextCycle, task_key: nextDefinition.key, assigned_at: completedAt, progress: 0, target: nextDefinition.target };
      } else {
        const { error: progressError } = await client.from("creator_task_cycles").update({ progress }).eq("id", active.id).is("completed_at", null);
        if (progressError) throw progressError;
        active.progress = progress;
      }
      const activeDefinition = CREATOR_TASKS.find((task) => task.key === active.task_key) || CREATOR_TASKS[0];
      const { data: history, error: historyError } = await client.from("creator_task_cycles").select("cycle_no,task_key,assigned_at,completed_at,progress,target").eq("user_id", user.id).not("completed_at", "is", null).order("completed_at", { ascending: false }).limit(20);
      if (historyError) throw historyError;
      return ok(res, { activeTask: { cycleNo: active.cycle_no, key: activeDefinition.key, title: activeDefinition.title, description: activeDefinition.description, metric: activeDefinition.metric, target: activeDefinition.target, progress: Math.min(activeDefinition.target, Number(active.progress || 0)), assignedAt: active.assigned_at }, completedTask, history: (history || []).map((row) => { const task = CREATOR_TASKS.find((item) => item.key === row.task_key) || CREATOR_TASKS[0]; return { cycleNo: row.cycle_no, key: task.key, title: task.title, progress: row.target, target: row.target, completedAt: row.completed_at }; }) });
    }

    if (pathname === "/api/social/follows" && (method === "POST" || method === "DELETE")) {
      const user = await requireSupabaseUser(req);
      const body = await readJson(req);
      const lookup = String(body.userId || body.username || "").trim().replace(/^@/, "");
      if (!lookup || lookup.length > 200) throw fail(400, "INVALID_FOLLOW_TARGET", "Choose a valid Creator Hub account.");
      const client = db();
      let query = client.from("profiles").select("id,username,display_name,privacy");
      query = /^[0-9a-f]{8}-[0-9a-f-]{27}$/i.test(lookup) ? query.eq("id", lookup) : query.eq("username", lookup);
      const { data: target, error: targetError } = await query.maybeSingle();
      if (targetError) throw targetError;
      if (!target) throw fail(404, "FOLLOW_TARGET_NOT_FOUND", "That Creator Hub account could not be found.");
      if (String(target.id) === String(user.id)) throw fail(400, "CANNOT_FOLLOW_SELF", "You cannot follow your own account.");
      const [{ data: ownBlock, error: ownBlockError }, { data: incomingBlock, error: incomingBlockError }] = await Promise.all([
        client.from("blocks").select("blocker_id").eq("blocker_id", user.id).eq("blocked_id", target.id).maybeSingle(),
        client.from("blocks").select("blocker_id").eq("blocker_id", target.id).eq("blocked_id", user.id).maybeSingle(),
      ]);
      if (ownBlockError) throw ownBlockError;
      if (incomingBlockError) throw incomingBlockError;
      if (ownBlock || incomingBlock) throw fail(403, "FOLLOW_BLOCKED", "This follow is unavailable.");
      if (method === "DELETE") {
        const { error: removeError } = await client.from("follows").delete().eq("follower_id", user.id).eq("followee_id", target.id);
        if (removeError) throw removeError;
        return ok(res, { following: false, requested: false });
      }
      const { data: targetSettings, error: settingsError } = await client.from("user_settings").select("privacy").eq("user_id", target.id).maybeSingle();
      if (settingsError) throw settingsError;
      const privacy = targetSettings?.privacy || target.privacy || {};
      const status = privacy.account === "private" ? "pending" : "accepted";
      const { data: relation, error: followError } = await client.from("follows").upsert({ follower_id: user.id, followee_id: target.id, status }, { onConflict: "follower_id,followee_id" }).select("follower_id,followee_id,status,created_at").single();
      if (followError) throw followError;
      const notificationType = status === "pending" ? "follow_request" : "follow";
      const { error: notificationError } = await client.from("notifications").insert({ user_id: target.id, type: notificationType, actor_id: user.id, data: { follower_id: user.id } });
      if (notificationError) console.warn("[Social] Follow notification failed:", notificationError.message || notificationError);
      return send(res, 201, { following: status === "accepted", requested: status === "pending", status: relation.status });
    }

    const followRequestRoute = pathname.match(/^\/api\/social\/follow-requests\/([0-9a-f-]{36})$/i);
    if (followRequestRoute && (method === "PATCH" || method === "DELETE")) {
      const user = await requireSupabaseUser(req);
      const followerId = followRequestRoute[1];
      const client = db();
      const { data: request, error: requestError } = await client.from("follows").select("follower_id,followee_id,status").eq("follower_id", followerId).eq("followee_id", user.id).eq("status", "pending").maybeSingle();
      if (requestError) throw requestError;
      if (!request) throw fail(404, "FOLLOW_REQUEST_NOT_FOUND", "That follow request is no longer available.");
      if (method === "DELETE") {
        const { error: declineError } = await client.from("follows").delete().eq("follower_id", followerId).eq("followee_id", user.id).eq("status", "pending");
        if (declineError) throw declineError;
        return ok(res, { accepted: false, declined: true });
      }
      const { data: accepted, error: acceptError } = await client.from("follows").update({ status: "accepted" }).eq("follower_id", followerId).eq("followee_id", user.id).eq("status", "pending").select("follower_id,followee_id,status").single();
      if (acceptError) throw acceptError;
      const { error: notificationError } = await client.from("notifications").insert({ user_id: followerId, type: "follow_request_accepted", actor_id: user.id, data: { followee_id: user.id } });
      if (notificationError) console.warn("[Social] Follow acceptance notification failed:", notificationError.message || notificationError);
      return ok(res, { accepted: true, relation: accepted });
    }

    if (pathname === "/api/social/blocks" && (method === "GET" || method === "POST" || method === "DELETE")) {
      const user = await requireSupabaseUser(req);
      const body = method === "GET" ? {} : await readJson(req);
      const lookup = String(body.userId || body.username || url.searchParams.get("userId") || url.searchParams.get("username") || "").trim().replace(/^@/, "");
      if (!lookup || lookup.length > 200) throw fail(400, "INVALID_BLOCK_TARGET", "Choose a valid Creator Hub account.");
      const client = db();
      let query = client.from("profiles").select("id,username,display_name");
      query = /^[0-9a-f]{8}-[0-9a-f-]{27}$/i.test(lookup) ? query.eq("id", lookup) : query.eq("username", lookup);
      const { data: target, error: targetError } = await query.maybeSingle();
      if (targetError) throw targetError;
      if (!target) throw fail(404, "BLOCK_TARGET_NOT_FOUND", "That account could not be found.");
      if (String(target.id) === String(user.id)) throw fail(400, "CANNOT_BLOCK_SELF", "You cannot block your own account.");
      if (method === "GET") {
        const [{ data: ownBlock, error: ownBlockError }, { data: incomingBlock, error: incomingBlockError }] = await Promise.all([
          client.from("blocks").select("blocker_id").eq("blocker_id", user.id).eq("blocked_id", target.id).maybeSingle(),
          client.from("blocks").select("blocker_id").eq("blocker_id", target.id).eq("blocked_id", user.id).maybeSingle(),
        ]);
        if (ownBlockError) throw ownBlockError;
        if (incomingBlockError) throw incomingBlockError;
        return ok(res, { blockedByMe: !!ownBlock, blockedMe: !!incomingBlock });
      }
      if (method === "POST") {
        const { error: insertError } = await client.from("blocks").upsert({ blocker_id: user.id, blocked_id: target.id }, { onConflict: "blocker_id,blocked_id", ignoreDuplicates: true });
        if (insertError) throw insertError;
        const [{ error: ownFollowError }, { error: incomingFollowError }] = await Promise.all([
          client.from("follows").delete().eq("follower_id", user.id).eq("followee_id", target.id),
          client.from("follows").delete().eq("follower_id", target.id).eq("followee_id", user.id),
        ]);
        if (ownFollowError) throw ownFollowError;
        if (incomingFollowError) throw incomingFollowError;
        return ok(res, { blocked: true, userId: target.id, username: target.username });
      }
      const { error: deleteError } = await client.from("blocks").delete().eq("blocker_id", user.id).eq("blocked_id", target.id);
      if (deleteError) throw deleteError;
      return ok(res, { blocked: false, userId: target.id, username: target.username });
    }

    if (pathname === "/api/messages/conversations" && method === "GET") {
      const user = await requireSupabaseUser(req);
      const client = db();
      const { data: ownMemberships, error: ownMembershipError } = await client
        .from("conversation_members")
        .select("conversation_id,last_read_at")
        .eq("user_id", user.id);
      if (ownMembershipError) throw ownMembershipError;
      const ownRows = ownMemberships || [];
      const ids = ownRows.map((row) => row.conversation_id).filter(Boolean);
      if (!ids.length) return ok(res, { conversations: [] });

      const [{ data: conversations, error: conversationError }, { data: members, error: membersError }, { data: messageRows, error: messagesError }] = await Promise.all([
        client.from("conversations").select("id,is_group,title,created_at").in("id", ids),
        client.from("conversation_members").select("conversation_id,user_id,last_read_at").in("conversation_id", ids),
        client.from("messages").select("id,conversation_id,sender_id,body,kind,unsent,created_at").in("conversation_id", ids).order("created_at", { ascending: false }).limit(Math.min(500, Math.max(80, ids.length * 8))),
      ]);
      if (conversationError) throw conversationError;
      if (membersError) throw membersError;
      if (messagesError) throw messagesError;

      const memberRows = members || [];
      const participantIds = [...new Set(memberRows.map((row) => row.user_id).filter((id) => id && id !== user.id))];
      let profiles = [];
      let blockedParticipantIds = new Set();
      if (participantIds.length) {
        const [{ data: profileData, error: profileError }, { data: blockedByMe, error: blockedByMeError }, { data: blockedMe, error: blockedMeError }] = await Promise.all([
          client.from("profiles").select("id,username,display_name,avatar_url").in("id", participantIds),
          client.from("blocks").select("blocked_id").eq("blocker_id", user.id).in("blocked_id", participantIds),
          client.from("blocks").select("blocker_id").eq("blocked_id", user.id).in("blocker_id", participantIds),
        ]);
        if (profileError) throw profileError;
        if (blockedByMeError) throw blockedByMeError;
        if (blockedMeError) throw blockedMeError;
        profiles = profileData || [];
        for (const row of blockedByMe || []) blockedParticipantIds.add(String(row.blocked_id));
        for (const row of blockedMe || []) blockedParticipantIds.add(String(row.blocker_id));
      }
      const profileById = new Map(profiles.map((profile) => [String(profile.id), profile]));
      const readByConversation = new Map(ownRows.map((row) => [String(row.conversation_id), row.last_read_at]));
      const latestByConversation = new Map();
      for (const message of messageRows || []) {
        if (!latestByConversation.has(String(message.conversation_id))) latestByConversation.set(String(message.conversation_id), message);
      }
      const memberGroups = new Map();
      for (const member of memberRows) {
        const key = String(member.conversation_id);
        if (!memberGroups.has(key)) memberGroups.set(key, []);
        memberGroups.get(key).push(member);
      }
      const result = (conversations || []).map((conversation) => {
        const key = String(conversation.id);
        const latest = latestByConversation.get(key) || null;
        const otherMembers = (memberGroups.get(key) || []).filter((member) => String(member.user_id) !== String(user.id));
        const participant = otherMembers.length ? profileById.get(String(otherMembers[0].user_id)) || { id: otherMembers[0].user_id, username: "Account" } : null;
        const lastReadAt = readByConversation.get(key) || null;
        return {
          id: conversation.id,
          title: conversation.title,
          isGroup: Boolean(conversation.is_group),
          createdAt: conversation.created_at,
          lastReadAt,
          participant,
          blocked: otherMembers.some((member) => blockedParticipantIds.has(String(member.user_id))),
          lastMessage: latest ? { id: latest.id, senderId: latest.sender_id, body: latest.unsent ? "Message removed" : latest.body, kind: latest.kind, createdAt: latest.created_at } : null,
          unread: Boolean(latest && String(latest.sender_id) !== String(user.id) && (!lastReadAt || new Date(latest.created_at).getTime() > new Date(lastReadAt).getTime())),
        };
      }).filter((conversation) => !conversation.blocked).map(({ blocked, ...conversation }) => conversation).sort((a, b) => new Date((b.lastMessage && b.lastMessage.createdAt) || b.createdAt).getTime() - new Date((a.lastMessage && a.lastMessage.createdAt) || a.createdAt).getTime());
      return ok(res, { conversations: result });
    }

    if (pathname === "/api/messages/conversations" && method === "POST") {
      const user = await requireSupabaseUser(req);
      const body = await readJson(req);
      const recipientLookup = String(body.recipientId || body.recipient || body.username || "").trim().replace(/^@/, "");
      if (!recipientLookup || recipientLookup.length > 200) throw fail(400, "INVALID_RECIPIENT", "Enter a creator username to start a conversation.");
      if (recipientLookup === String(user.id)) throw fail(400, "INVALID_RECIPIENT", "You cannot message your own account.");
      const client = db();
      let recipientQuery = client.from("profiles").select("id,username,display_name,privacy");
      recipientQuery = /^[0-9a-f]{8}-[0-9a-f-]{27}$/i.test(recipientLookup)
        ? recipientQuery.eq("id", recipientLookup)
        : recipientQuery.eq("username", recipientLookup);
      const { data: recipient, error: recipientError } = await recipientQuery.maybeSingle();
      if (recipientError) throw recipientError;
      if (!recipient) throw fail(404, "RECIPIENT_NOT_FOUND", "That Creator Hub account could not be found.");

      const [{ data: viewerBlock, error: viewerBlockError }, { data: recipientBlock, error: recipientBlockError }] = await Promise.all([
        client.from("blocks").select("blocker_id").eq("blocker_id", user.id).eq("blocked_id", recipient.id).maybeSingle(),
        client.from("blocks").select("blocker_id").eq("blocker_id", recipient.id).eq("blocked_id", user.id).maybeSingle(),
      ]);
      if (viewerBlockError) throw viewerBlockError;
      if (recipientBlockError) throw recipientBlockError;
      if (viewerBlock || recipientBlock) throw fail(403, "MESSAGING_BLOCKED", "This conversation is not available.");

      const { data: recipientSettings, error: settingsError } = await client.from("user_settings").select("privacy").eq("user_id", recipient.id).maybeSingle();
      if (settingsError) throw settingsError;
      const recipientPrivacy = recipientSettings?.privacy || recipient.privacy || {};
      if (recipientPrivacy.messages === "nobody") throw fail(403, "MESSAGING_NOT_ALLOWED", "This creator is not accepting direct messages.");
      if (recipientPrivacy.messages === "followers") {
        const { data: follow, error: followError } = await client.from("follows").select("follower_id").eq("follower_id", user.id).eq("followee_id", recipient.id).eq("status", "accepted").maybeSingle();
        if (followError) throw followError;
        if (!follow) throw fail(403, "MESSAGING_FOLLOWERS_ONLY", "Follow this creator before starting a conversation.");
      }

      const [{ data: ownMembers, error: ownMembersError }, { data: recipientMembers, error: recipientMembersError }] = await Promise.all([
        client.from("conversation_members").select("conversation_id").eq("user_id", user.id),
        client.from("conversation_members").select("conversation_id").eq("user_id", recipient.id),
      ]);
      if (ownMembersError) throw ownMembersError;
      if (recipientMembersError) throw recipientMembersError;
      const recipientConversationIds = new Set((recipientMembers || []).map((row) => String(row.conversation_id)));
      const commonIds = [...new Set((ownMembers || []).map((row) => String(row.conversation_id)).filter((id) => recipientConversationIds.has(id)))];
      if (commonIds.length) {
        const { data: commonConversations, error: commonConversationError } = await client.from("conversations").select("id,is_group").in("id", commonIds).eq("is_group", false);
        if (commonConversationError) throw commonConversationError;
        const usableIds = (commonConversations || []).map((row) => row.id);
        if (usableIds.length) {
          const { data: commonMembers, error: commonMembersError } = await client.from("conversation_members").select("conversation_id,user_id").in("conversation_id", usableIds);
          if (commonMembersError) throw commonMembersError;
          const membersById = new Map();
          for (const row of commonMembers || []) {
            const key = String(row.conversation_id);
            if (!membersById.has(key)) membersById.set(key, new Set());
            membersById.get(key).add(String(row.user_id));
          }
          const existing = usableIds.find((id) => {
            const set = membersById.get(String(id));
            return set && set.size === 2 && set.has(String(user.id)) && set.has(String(recipient.id));
          });
          if (existing) return ok(res, { conversationId: existing, created: false });
        }
      }

      const { data: conversation, error: createConversationError } = await client.from("conversations").insert({ is_group: false, title: null }).select("id").single();
      if (createConversationError) throw createConversationError;
      const { error: membershipInsertError } = await client.from("conversation_members").insert([
        { conversation_id: conversation.id, user_id: user.id },
        { conversation_id: conversation.id, user_id: recipient.id },
      ]);
      if (membershipInsertError) {
        await client.from("conversations").delete().eq("id", conversation.id);
        throw membershipInsertError;
      }
      return send(res, 201, { ok: true, conversationId: conversation.id, created: true, participant: { id: recipient.id, username: recipient.username, displayName: recipient.display_name } });
    }

    const messageRoute = pathname.match(/^\/api\/messages\/conversations\/([0-9a-f-]{36})\/(messages|read)(?:\/([0-9a-f-]{36}))?$/i);
    if (messageRoute) {
      const user = await requireSupabaseUser(req);
      const conversationId = messageRoute[1];
      const action = messageRoute[2];
      const messageId = messageRoute[3] || null;
      if ((action === "messages" && !messageId && method !== "GET" && method !== "POST") || (action === "messages" && messageId && method !== "PATCH" && method !== "DELETE") || (action === "read" && method !== "POST")) {
        throw fail(405, "METHOD_NOT_ALLOWED", "This messaging action does not support that method.");
      }
      const client = db();
      const { data: membership, error: membershipError } = await client.from("conversation_members").select("conversation_id,last_read_at").eq("conversation_id", conversationId).eq("user_id", user.id).maybeSingle();
      if (membershipError) throw membershipError;
      if (!membership) throw fail(404, "CONVERSATION_NOT_FOUND", "This conversation is unavailable.");
      const { data: otherMemberRows, error: otherMemberError } = await client.from("conversation_members").select("user_id").eq("conversation_id", conversationId).neq("user_id", user.id);
      if (otherMemberError) throw otherMemberError;
      for (const other of otherMemberRows || []) {
        const [{ data: outgoingBlock, error: outgoingBlockError }, { data: incomingBlock, error: incomingBlockError }] = await Promise.all([
          client.from("blocks").select("blocker_id").eq("blocker_id", user.id).eq("blocked_id", other.user_id).maybeSingle(),
          client.from("blocks").select("blocker_id").eq("blocker_id", other.user_id).eq("blocked_id", user.id).maybeSingle(),
        ]);
        if (outgoingBlockError) throw outgoingBlockError;
        if (incomingBlockError) throw incomingBlockError;
        if (outgoingBlock || incomingBlock) throw fail(403, "MESSAGING_BLOCKED", "This conversation is not available.");
      }

      if (action === "read") {
        const now = new Date().toISOString();
        const { error } = await client.from("conversation_members").update({ last_read_at: now }).eq("conversation_id", conversationId).eq("user_id", user.id);
        if (error) throw error;
        return ok(res, { markedRead: true, lastReadAt: now });
      }

      if (method === "GET") {
        const now = new Date().toISOString();
        const { error: readError } = await client.from("conversation_members").update({ last_read_at: now }).eq("conversation_id", conversationId).eq("user_id", user.id);
        if (readError) throw readError;
        const [{ data: messages, error: messagesError }, { data: memberRows, error: membersError }, { data: conversation, error: conversationError }] = await Promise.all([
          client.from("messages").select("id,conversation_id,sender_id,body,kind,media,reply_to,unsent,edited_at,created_at").eq("conversation_id", conversationId).order("created_at", { ascending: true }).limit(100),
          client.from("conversation_members").select("conversation_id,user_id,last_read_at").eq("conversation_id", conversationId),
          client.from("conversations").select("id,is_group,title,created_at").eq("id", conversationId).maybeSingle(),
        ]);
        if (messagesError) throw messagesError;
        if (membersError) throw membersError;
        if (conversationError) throw conversationError;
        const participantIds = [...new Set((memberRows || []).map((row) => row.user_id))];
        const { data: profiles, error: profilesError } = participantIds.length
          ? await client.from("profiles").select("id,username,display_name,avatar_url").in("id", participantIds)
          : { data: [], error: null };
        if (profilesError) throw profilesError;
        return ok(res, {
          conversation,
          participants: profiles || [],
          messages: (messages || []).map((message) => ({ ...message, body: message.unsent ? "Message removed" : message.body, own: String(message.sender_id) === String(user.id) })),
          lastReadAt: now,
        });
      }

      if (messageId) {
        const { data: existingMessage, error: existingMessageError } = await client.from("messages").select("id,conversation_id,sender_id,body,kind,unsent,created_at,edited_at").eq("id", messageId).eq("conversation_id", conversationId).maybeSingle();
        if (existingMessageError) throw existingMessageError;
        if (!existingMessage || String(existingMessage.sender_id) !== String(user.id)) throw fail(404, "MESSAGE_NOT_FOUND", "That message is unavailable or you cannot change it.");
        if (existingMessage.unsent) throw fail(409, "MESSAGE_ALREADY_REMOVED", "This message has already been removed.");
        if (method === "DELETE") {
          const { data: removed, error: removeError } = await client.from("messages").update({ body: null, unsent: true, edited_at: new Date().toISOString() }).eq("id", messageId).eq("sender_id", user.id).select("id,unsent,edited_at").single();
          if (removeError) throw removeError;
          return ok(res, { message: { ...removed, body: "Message removed" } });
        }
        if (existingMessage.kind !== "text") throw fail(400, "MESSAGE_NOT_EDITABLE", "Only text messages can be edited.");
        if (Date.now() - new Date(existingMessage.created_at).getTime() > 15 * 60 * 1000) throw fail(403, "MESSAGE_EDIT_WINDOW_EXPIRED", "Text messages can be edited for 15 minutes after sending.");
        const editBody = await readJson(req);
        const editedBody = String(editBody.body || "").trim();
        if (!editedBody) throw fail(400, "EMPTY_MESSAGE", "A message cannot be empty.");
        if (editedBody.length > 5000) throw fail(400, "MESSAGE_TOO_LONG", "Messages can contain up to 5,000 characters.");
        const editedAt = new Date().toISOString();
        const { data: edited, error: editError } = await client.from("messages").update({ body: editedBody, edited_at: editedAt }).eq("id", messageId).eq("sender_id", user.id).select("id,conversation_id,sender_id,body,kind,unsent,edited_at,created_at").single();
        if (editError) throw editError;
        return ok(res, { message: { ...edited, own: true } });
      }

      const body = await readJson(req);
      const messageBody = String(body.body || "").trim();
      if (!messageBody) throw fail(400, "EMPTY_MESSAGE", "Type a message before sending.");
      if (messageBody.length > 5000) throw fail(400, "MESSAGE_TOO_LONG", "Messages can contain up to 5,000 characters.");
      const { data: inserted, error: insertError } = await client.from("messages").insert({ conversation_id: conversationId, sender_id: user.id, body: messageBody, kind: "text" }).select("id,conversation_id,sender_id,body,kind,edited_at,created_at").single();
      if (insertError) throw insertError;
      const { data: recipientRows, error: recipientLookupError } = await client.from("conversation_members").select("user_id").eq("conversation_id", conversationId).neq("user_id", user.id);
      if (recipientLookupError) throw recipientLookupError;
      const recipient = (recipientRows || [])[0];
      if (recipient?.user_id) {
        const { data: recipientSettings, error: recipientSettingsError } = await client.from("user_settings").select("notifications").eq("user_id", recipient.user_id).maybeSingle();
        if (recipientSettingsError) console.warn("[Messaging] Notification preference lookup failed:", recipientSettingsError.message || recipientSettingsError);
        if (!recipientSettingsError && (!recipientSettings?.notifications || recipientSettings.notifications.messages !== false)) {
          const { error: notificationError } = await client.from("notifications").insert({ user_id: recipient.user_id, type: "message", actor_id: user.id, data: { conversation_id: conversationId, message_id: inserted.id } });
          if (notificationError) console.warn("[Messaging] Notification creation failed:", notificationError.message || notificationError);
        }
      }
      const now = new Date().toISOString();
      await client.from("conversation_members").update({ last_read_at: now }).eq("conversation_id", conversationId).eq("user_id", user.id);
      return send(res, 201, { ok: true, message: { ...inserted, own: true } });
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
      if (!PAYPAL_RETURN_URL) {
        throw fail(503, "PAYPAL_RETURN_URL_REQUIRED", "Set FRONTEND_URL or PAYPAL_RETURN_URL before enabling PayPal checkout.");
      }
      const client = db();
      const { data: existingPayment, error: existingError } = await client
        .from("payments")
        .select("*")
        .eq("idempotency_key", idempotencyKey)
        .maybeSingle();
      if (existingError) throw existingError;
      if (existingPayment) {
        if (String(existingPayment.user_id) !== String(user.id) || Number(existingPayment.package_coins) !== coins) {
          throw fail(
            409,
            "IDEMPOTENCY_CONFLICT",
            "This idempotency key is already associated with a different account or coin amount. Start a new checkout."
          );
        }
        if (existingPayment.status === "completed" || existingPayment.credited) {
          return ok(res, {
            orderId: existingPayment.provider_order_id,
            status: "completed",
            coins: existingPayment.package_coins,
            amount: Number(existingPayment.amount),
            custom: !existingPayment.package_id,
            alreadyCompleted: true,
            credited: true,
          });
        }
        const savedLinks = existingPayment.metadata && Array.isArray(existingPayment.metadata.links) ? existingPayment.metadata.links : [];
        const savedApproval = savedLinks.find((link) => link && link.rel === "approve" && typeof link.href === "string");
        if (!savedApproval) throw fail(409, "PAYMENT_APPROVAL_LINK_MISSING", "This pending checkout has no PayPal approval link. Start a fresh checkout.");
        return ok(res, {
          orderId: existingPayment.provider_order_id,
          status: existingPayment.status,
          coins: existingPayment.package_coins,
          amount: Number(existingPayment.amount),
          custom: !existingPayment.package_id,
          approveUrl: savedApproval.href,
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
                // Keep the PayPal order token in location.search and use the
                // SPA hash route for the wallet page; normalize paths/queries.
                return_url: buildPaypalReturnUrl("success"),
                cancel_url: buildPaypalReturnUrl("cancelled"),
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
      const approvalLink = Array.isArray(order.links)
        ? order.links.find((link) => link && link.rel === "approve" && typeof link.href === "string")
        : null;
      if (!approvalLink || !approvalLink.href) {
        throw fail(502, "PAYMENT_PROVIDER_ERROR", "PayPal did not return the approval link needed to continue checkout.");
      }

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
        approveUrl: approvalLink.href,
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
      const capturedAmount = Number(successfulCapture?.amount?.value);
      const capturedCurrency = String(successfulCapture?.amount?.currency_code || "").toUpperCase();
      const expectedAmount = Number(payment.amount);
      const expectedCurrency = String(payment.currency || "").toUpperCase();
      if (
        captureResponse.status === "COMPLETED" && successfulCapture && captureId &&
        Number.isFinite(capturedAmount) && Number.isFinite(expectedAmount) &&
        Math.round(capturedAmount * 100) === Math.round(expectedAmount * 100) &&
        capturedCurrency && capturedCurrency === expectedCurrency
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

    if (pathname === "/api/payments/paypal/info" && method === "DELETE") {
      const user = await requireSupabaseUser(req);
      const { error } = await db().from("paypal_payout_info").delete().eq("user_id", user.id);
      if (error) {
        const normalized = normalizeExternalError(error);
        throw fail(503, "PAYPAL_INFO_REMOVE_FAILED", normalized.message || "The saved PayPal payout email could not be removed.");
      }
      // Submitted payout requests keep their own email snapshot and are not changed.
      return ok(res, { removed: true, message: "Saved PayPal payout email removed. Pending requests are unchanged." });
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

    // Active coin packages are read from the authoritative catalogue. `price`
    // is the actual database column; expose one normalized `priceUsd` field.
    if (pathname === "/api/wallet/packages" && method === "GET") {
      await requireSupabaseUser(req);
      const { data, error } = await db().from("coin_packages")
        .select("id,coins,price,currency,active,sort")
        .eq("active", true).order("sort", { ascending: true }).order("coins", { ascending: true });
      if (error) throw error;
      const packages = (data || []).map((item) => ({
        id: item.id, coins: Number(item.coins), priceUsd: Number(item.price),
        currency: String(item.currency || "USD"), sort: Number(item.sort || 0),
      })).filter((item) => Number.isSafeInteger(item.coins) && item.coins > 0 && Number.isFinite(item.priceUsd) && item.priceUsd > 0);
      return ok(res, { packages });
    }

    // A conversion rate is a deliberate platform setting, never inferred from
    // a gift price or payout. Keep conversion unavailable until configured.
    if (pathname === "/api/wallet/conversion-config" && method === "GET") {
      await requireSupabaseUser(req);
      const coinsPerDiamond = Number(process.env.CHL_COINS_PER_DIAMOND);
      const diamondsPerCoin = Number(process.env.CHL_DIAMONDS_PER_COIN);
      const configured = Number.isSafeInteger(coinsPerDiamond) && coinsPerDiamond >= 1 && coinsPerDiamond <= 1000000
        && Number.isSafeInteger(diamondsPerCoin) && diamondsPerCoin >= 1 && diamondsPerCoin <= 1000000;
      return ok(res, {
        enabled: configured,
        coinsPerDiamond: configured ? coinsPerDiamond : null,
        diamondsPerCoin: configured ? diamondsPerCoin : null,
        reason: configured ? null : "WALLET_CONVERSION_RATE_NOT_CONFIGURED",
      });
    }

    if (pathname === "/api/wallet/convert" && method === "POST") {
      const user = await requireSupabaseUser(req);
      const idempotencyKey = requireIdem(req);
      const body = await readJson(req);
      const direction = String(body.direction || "");
      const amount = Number(body.amount);
      const coinsPerDiamond = Number(process.env.CHL_COINS_PER_DIAMOND);
      const diamondsPerCoin = Number(process.env.CHL_DIAMONDS_PER_COIN);
      if (!Number.isSafeInteger(coinsPerDiamond) || coinsPerDiamond < 1 || coinsPerDiamond > 1000000
          || !Number.isSafeInteger(diamondsPerCoin) || diamondsPerCoin < 1 || diamondsPerCoin > 1000000) {
        throw fail(503, "WALLET_CONVERSION_RATE_NOT_CONFIGURED", "Wallet conversion is unavailable until both platform exchange rates are configured.");
      }
      if (!["coins_to_diamonds", "diamonds_to_coins"].includes(direction)) throw fail(400, "INVALID_CONVERSION_DIRECTION", "Choose coins to diamonds or diamonds to coins.");
      if (!Number.isSafeInteger(amount) || amount < 1 || amount > 1000000000) throw fail(400, "INVALID_CONVERSION_AMOUNT", "Enter a whole-number amount from 1 to 1,000,000,000.");
      const requiredMultiple = direction === "coins_to_diamonds" ? coinsPerDiamond : diamondsPerCoin;
      const unitName = direction === "coins_to_diamonds" ? "Coin" : "Diamond";
      if (amount % requiredMultiple !== 0) throw fail(400, "CONVERSION_AMOUNT_MULTIPLE_REQUIRED", `${unitName} amounts must be a multiple of ${requiredMultiple.toLocaleString("en-US")} for this exchange rate.`);
      const { data, error } = await db().rpc("convert_wallet_currency", {
        p_user_id: user.id, p_direction: direction, p_amount: amount,
        p_coins_per_diamond: coinsPerDiamond, p_diamonds_per_coin: diamondsPerCoin,
        p_idempotency_key: idempotencyKey,
      });
      if (error) {
        const normalized = normalizeExternalError(error);
        const msg = String(normalized.message || "");
        if (/insufficient coins/i.test(msg)) throw fail(400, "INSUFFICIENT_COINS", "You do not have enough coins for this conversion.");
        if (/insufficient diamonds/i.test(msg)) throw fail(400, "INSUFFICIENT_DIAMONDS", "You do not have enough diamonds for this conversion.");
        throw fail(400, "WALLET_CONVERSION_FAILED", normalized.message || "The conversion could not be completed.");
      }
      return ok(res, { conversion: data, coinBalance: data && data.coinBalance, diamondBalance: data && data.diamondBalance });
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
