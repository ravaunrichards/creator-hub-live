import "dotenv/config";
import http from "node:http";
import { URL } from "node:url";
import { createClient } from "@supabase/supabase-js";
import { handleTeamsRoute } from "./teams-routes.js";
import { handleCreatorLeagueRoute } from "./creator-leagues.js";
import { handleTeamLeagueRoute } from "./team-leagues.js";
import { handlePayoutRoute } from "./payout-routes.js";
import { normalizePayPalEnvironment, readEnvironmentSetting } from "./paypal-env.js";
import {
  createLiveKitToken,
  validateRoomName,
  livekitHealth,
  verifyHostPublishing,
} from "./livekit-token.js";
import { handleLiveRoomExperience } from "./live-room-experience.js";
import { createRateLimiter, rateLimitKeyForRequest, pruneRateLimitBuckets } from "./rate-limit.js";
import { assertEnvironmentReady, validateEnvironment } from "./env-check.js";
import {
  resolveRequestId,
  clientIp,
  logAccess,
  resolveMaxBodyBytes,
  readRawBodyLimited,
} from "./observability.js";

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

const BACKEND_RELEASE = "4.4.0";
const PORT = Number(process.env.PORT || 3000);

// ----------------------------------------------------------------------------
// Abuse protection (v4.3.0): fixed-window rate limiter for cost-bearing /
// destructive POST endpoints. Webhooks are intentionally excluded so PayPal
// retries are never dropped. Disable with RATE_LIMIT_DISABLED=true.
// ----------------------------------------------------------------------------
const sensitiveRateLimiter = createRateLimiter({
  windowMs: Number(process.env.RATE_LIMIT_WINDOW_MS) || 60000,
  max: Number(process.env.RATE_LIMIT_MAX) || 30,
});
const RATE_LIMITED_POST_ROUTES = new Set([
  "/api/livekit/token",
  "/api/payments/paypal/create-order",
  "/api/payments/paypal/capture-order",
  "/api/account/deactivate",
]);

// Hard request-body cap (v4.4.0): abusive uploads are cut off instead of being
// buffered to memory exhaustion. Tunable via MAX_REQUEST_BODY_BYTES.
const MAX_BODY_BYTES = resolveMaxBodyBytes();

// Periodically drop expired rate-limit buckets so the in-memory map cannot grow
// unbounded for one-off clients. Unref'd so it never keeps the process alive.
const rateLimitPruneTimer = setInterval(() => {
  pruneRateLimitBuckets();
}, 5 * 60 * 1000);
if (typeof rateLimitPruneTimer.unref === "function") rateLimitPruneTimer.unref();

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

const PAYPAL_ENV_CONFIG = normalizePayPalEnvironment(
  readEnvironmentSetting(process.env, "PAYPAL_ENV"),
  readEnvironmentSetting(process.env, "PAYPAL_MODE"),
  readEnvironmentSetting(process.env, "PAYPAL_ENVIRONMENT")
);
const PAYPAL_ENV_RAW = PAYPAL_ENV_CONFIG.raw;
const PAYPAL_ENV = PAYPAL_ENV_CONFIG.environment;

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
    // HSTS: enforce HTTPS for a year incl. subdomains once served over TLS.
    // Harmless over plain HTTP (browsers ignore it on non-HTTPS responses).
    "Strict-Transport-Security": "max-age=31536000; includeSubDomains",
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
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, PUT, PATCH, DELETE, OPTIONS");
}

async function readRawBody(req) {
  try {
    return await readRawBodyLimited(req, MAX_BODY_BYTES);
  } catch (error) {
    if (error && error.tooLarge) {
      throw fail(413, "PAYLOAD_TOO_LARGE", "Request body exceeds the allowed size.", {
        limitBytes: error.limit,
      });
    }
    throw error;
  }
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
  const adminDb = db();
  const profileState = await adminDb.from("profiles").select("account_status").eq("id", data.user.id).maybeSingle();
  if (profileState.error) {
    const normalized = normalizeExternalError(profileState.error);
    throw fail(503, "ACCOUNT_STATUS_LOOKUP_FAILED",
      normalized.code === "PGRST204" || normalized.code === "PGRST205" || normalized.code === "42703"
        ? "Account lifecycle schema is not ready. Review and apply database migration 0024 before enabling account lifecycle controls."
        : normalized.message,
      { databaseCode: normalized.code || undefined });
  }
  if (!profileState.data)
    throw fail(403, "ACCOUNT_NOT_ACTIVE", "No active Creator Hub profile exists for this account.");
  if (profileState.data.account_status !== "active")
    throw fail(403, "ACCOUNT_DEACTIVATED", "This account is deactivated. Contact platform support for reactivation.");
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
  if (PAYPAL_ENV === "invalid") {
    throw fail(
      500,
      "PAYPAL_ENV_INVALID",
      `Invalid PayPal environment setting ${JSON.stringify(PAYPAL_ENV_RAW)}. Set the backend variable PAYPAL_ENV to live or sandbox (production is also accepted). PAYPAL_MODE and PAYPAL_ENVIRONMENT are supported aliases.`
    );
  }
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
  let data;
  try {
    data = JSON.parse(text);
  } catch {
    data = null;
  }
  if (!response.ok) {
    if (response.status === 401) {
      throw fail(
        502,
        "PAYPAL_OAUTH_AUTH_FAILED",
        "PayPal rejected the configured client credentials. Confirm PAYPAL_ENV and use a Client ID and Secret from the same PayPal environment."
      );
    }
    throw fail(
      502,
      "PAYMENT_PROVIDER_ERROR",
      `PayPal OAuth failed (${response.status}).`
    );
  }
  if (!data) {
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
    .eq("currency", "USD")
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

  // Per-request correlation id + structured access log (v4.4.0 observability).
  const requestStartedAt = Date.now();
  const requestId = resolveRequestId(req);
  res.setHeader("X-Request-Id", requestId);
  res.on("finish", () => {
    logAccess({
      id: requestId,
      method,
      path: pathname,
      status: res.statusCode,
      durationMs: Date.now() - requestStartedAt,
      ip: clientIp(req),
    });
  });

  if (method === "OPTIONS") {
    res.writeHead(204, secureHeaders());
    return res.end();
  }

  // Rate-limit cost-bearing / destructive POSTs (defence-in-depth; the route
  // handlers still enforce full server-side authority).
  if (
    method === "POST" &&
    RATE_LIMITED_POST_ROUTES.has(pathname) &&
    process.env.RATE_LIMIT_DISABLED !== "true"
  ) {
    const verdict = sensitiveRateLimiter(rateLimitKeyForRequest(req, pathname));
    res.setHeader("X-RateLimit-Limit", String(verdict.limit));
    res.setHeader("X-RateLimit-Remaining", String(verdict.remaining));
    if (!verdict.allowed) {
      return send(
        res,
        429,
        {
          ok: false,
          code: "RATE_LIMITED",
          error: "Too many requests. Please slow down and retry shortly.",
        },
        { "Retry-After": String(Math.ceil(verdict.resetMs / 1000)) }
      );
    }
  }

  try {
    // Account lifecycle controls — require a fresh, verified Supabase user and a
    // literal confirmation phrase. These actions use the backend service role,
    // never a service key delivered to the browser.
    if (pathname === "/api/account/deactivate" && method === "POST") {
      const user = await requireSupabaseUser(req);
      const body = await readJson(req);
      if (body.confirm !== "DEACTIVATE") throw fail(400, "CONFIRMATION_REQUIRED", "Send confirm: DEACTIVATE to continue.");
      const client = db();
      const updated = await client.from("profiles").update({ account_status: "deactivated", deactivated_at: new Date().toISOString(), updated_at: new Date().toISOString() }).eq("id", user.id).select("id").maybeSingle();
      if (updated.error || !updated.data) {
        const normalized = normalizeExternalError(updated.error);
        throw fail(503, "ACCOUNT_DEACTIVATION_FAILED", normalized.message || "The account status could not be updated.", { databaseCode: normalized.code || undefined });
      }
      const banned = await client.auth.admin.updateUserById(user.id, { ban_duration: "876000h" });
      if (banned.error) {
        await client.from("profiles").update({ account_status: "active", deactivated_at: null, updated_at: new Date().toISOString() }).eq("id", user.id);
        const normalized = normalizeExternalError(banned.error);
        throw fail(503, "ACCOUNT_DEACTIVATION_FAILED", normalized.message || "The authentication provider did not confirm deactivation; the database status was rolled back.");
      }
      return ok(res, { deactivated: true, accountId: user.id, message: "Account deactivated and future authentication blocked. Existing signed tokens may remain valid until expiry." });
    }
    if (pathname === "/api/account" && method === "DELETE") {
      const user = await requireSupabaseUser(req);
      const body = await readJson(req);
      if (body.confirm !== "DELETE") throw fail(400, "CONFIRMATION_REQUIRED", "Send confirm: DELETE to permanently delete this account.");
      const client = db();
      const deleted = await client.auth.admin.deleteUser(user.id);
      if (deleted.error) {
        const normalized = normalizeExternalError(deleted.error);
        throw fail(503, "ACCOUNT_DELETION_FAILED", normalized.message || "The authentication provider could not delete this account.");
      }
      return ok(res, { deleted: true, accountId: user.id, message: "The authentication account was deleted. Related application records follow the installed database foreign-key deletion rules." });
    }

    // Teams API — connected to the same authenticated server and service-role client.
    if (await handleTeamsRoute({
      pathname, method, req, res, url,
      fail, ok, db, requireSupabaseUser, readJson, normalizeExternalError
    })) return;

    // Creator payout history/request and admin payout processing use the existing
    // diamond withdrawal ledger; no parallel or fictitious `payouts` table.
    if (await handlePayoutRoute({
      pathname, method, req, res,
      fail, ok, db, requireSupabaseUser, profileFor, readJson, normalizeExternalError
    })) return;

    // Infrastructure & Health
    if (pathname === "/api/health" && method === "GET") {
      const envReport = validateEnvironment();
      return ok(res, {
        status: "operational",
        backendRelease: BACKEND_RELEASE,
        livekit: livekitHealth(),
        uptimeSeconds: Math.round(process.uptime()),
        env: {
          ready: envReport.ready,
          missingRequired: envReport.missingRequired,
          missingRecommended: envReport.missingRecommended,
        },
        time: new Date().toISOString(),
      });
    }
    if (pathname === "/api/livekit/health" && method === "GET") {
      return ok(res, { livekit: livekitHealth() });
    }

    // Public Configuration
    if (pathname === "/api/config/public" && method === "GET") {
      return ok(res, {
        backendRelease: BACKEND_RELEASE,
        frontendUrl: FRONTEND_URL || null,
        livekitUrl: LIVEKIT_URL || null,
        paypalEnvironment: PAYPAL_ENV,
        features: {
          livekit: livekitHealth().configured,
          paypal: Boolean(PAYPAL_CLIENT_ID && PAYPAL_CLIENT_SECRET && PAYPAL_ENV !== "invalid"),
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
        canPublish = String(room.host_id) === String(user.id);
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
        canPublish = String(room.host_id) === String(user.id);
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
        const canPublish = String(room.host_id) === String(user.id);
        return ok(res, {
          joined: true,
          roomId: room.id,
          status: room.status,
          roomName: room.room_name,
          isHost: canPublish,
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
      if (!PAYPAL_RETURN_URL) {
        throw fail(503, "PAYPAL_RETURN_URL_REQUIRED", "Set FRONTEND_URL on the backend to the deployed website origin. The return URL is sent by the server when it creates the PayPal order; it is not entered in the PayPal app credentials screen.");
      }
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
        const existingApproveUrl = Array.isArray(existingPayment.metadata?.links)
          ? existingPayment.metadata.links.find((link) => ["approve", "payer-action"].includes(link.rel))?.href
          : null;
        return ok(res, {
          orderId: existingPayment.provider_order_id,
          approveUrl: existingApproveUrl,
          status: existingPayment.status,
          coins: existingPayment.package_coins,
          amount: Number(existingPayment.amount),
        });
      }

      // The canonical coin_packages schema uses `price`, not `price_usd`.
      // Keep the amount server-authoritative and reject malformed catalog rows
      // before contacting PayPal (Number(undefined).toFixed() previously sent NaN).
      const packagePrice = Number(pkg.price);
      if (!Number.isFinite(packagePrice) || packagePrice <= 0 || !Number.isSafeInteger(Number(pkg.coins))) {
        throw fail(503, "COIN_PACKAGE_CONFIG_INVALID", "The selected USD coin package has an invalid price or coin count. Review public.coin_packages before enabling checkout.");
      }
      const amountUsd = packagePrice.toFixed(2);
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
          // PayPal return/cancel URLs are supplied per Order API request.
          // They are not a field in the PayPal Developer App credentials page.
          // Keep query parameters before the hash for the browser's capture flow.
          return_url: `${PAYPAL_RETURN_URL}/?paypal=success#/wallet`,
          cancel_url: `${PAYPAL_RETURN_URL}/?paypal=cancel#/wallet`,
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
      const approveUrl = Array.isArray(order.links)
        ? order.links.find((link) => ["approve", "payer-action"].includes(link.rel))?.href
        : null;
      if (!approveUrl)
        throw fail(
          502,
          "PAYMENT_PROVIDER_ERROR",
          "PayPal did not return a checkout approval link."
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
        approveUrl,
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
        const missingSchema = ["PGRST204", "PGRST205", "42P01", "42703"].includes(String(normalized.code || ""));
        throw fail(missingSchema ? 503 : 500, "PAYPAL_INFO_LOOKUP_FAILED",
          missingSchema
            ? `PayPal payout settings schema is not ready. Review database/diagnostics/league_schema_preflight.sql and migration 0019_league_operations_and_payouts.sql before changing the database. ${normalized.message || ""}`.trim()
            : normalized.message,
          { databaseCode: normalized.code || undefined, databaseMessage: normalized.message || undefined });
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
        const missingSchema = ["PGRST204", "PGRST205", "42P01", "42703"].includes(String(normalized.code || ""));
        throw fail(missingSchema ? 503 : 500, "PAYPAL_INFO_SAVE_FAILED",
          missingSchema
            ? `PayPal payout settings schema is not ready. Review database/diagnostics/league_schema_preflight.sql and migration 0019_league_operations_and_payouts.sql before changing the database. ${normalized.message || ""}`.trim()
            : normalized.message,
          { databaseCode: normalized.code || undefined, databaseMessage: normalized.message || undefined });
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

    // Gift catalogue — authenticated and sourced from active database records.
    // The full catalogue projection is returned so the frontend can render the
    // correct category, emoji, price, artwork, animation and sound for every
    // gift. Previously only id/name/coin_price/diamond_value/active were
    // selected, which stripped graphic_url, animation_url, sound_url, category,
    // emoji and the catalogue ordering fields the client depends on. Only
    // columns that exist in the real schema (migrations 0003/0027/0029) are
    // requested, and the catalogue is ordered by its approved sort order.
    if (pathname === "/api/gifts" && method === "GET") {
      await requireSupabaseUser(req);
      const client = db();
      const { data, error } = await client
        .from("gifts")
        .select(
          "id,name,category,emoji,asset_key,graphic_url,animation_url,sound_url,coin_price,diamond_value,rarity,sort_order,active"
        )
        .eq("active", true)
        .order("sort_order", { ascending: true, nullsFirst: false })
        .order("coin_price", { ascending: true })
        .order("name", { ascending: true });
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
        category: gift.category || null,
        emoji: gift.emoji || null,
        assetKey: gift.asset_key || null,
        graphicUrl: gift.graphic_url || null,
        animationUrl: gift.animation_url || null,
        soundUrl: gift.sound_url || null,
        rarity: gift.rarity || null,
        catalogOrder: gift.sort_order == null ? null : Number(gift.sort_order),
        coinPrice: gift.coin_price == null ? null : Number(gift.coin_price),
        diamondValue:
          gift.diamond_value == null ? null : Number(gift.diamond_value),
        active: Boolean(gift.active),
      }));
      return ok(res, { gifts });
    }

    // Public, server-read coin package catalogue. Only active USD packages are
    // offered because the current checkout creates USD-denominated PayPal orders.
    if (pathname === "/api/wallet/packages" && method === "GET") {
      const client = db();
      const { data, error } = await client
        .from("coin_packages")
        .select("id,coins,price,currency,sort")
        .eq("active", true)
        .eq("currency", "USD")
        .order("sort", { ascending: true })
        .order("coins", { ascending: true });
      if (error) {
        const normalized = normalizeExternalError(error);
        throw fail(503, "COIN_PACKAGE_LOOKUP_FAILED", normalized.message, {
          databaseCode: normalized.code || undefined,
        });
      }
      const packages = (data || []).map((pkg) => ({
        id: pkg.id,
        coins: Number(pkg.coins),
        price: Number(pkg.price),
        currency: "USD",
      })).filter((pkg) => Number.isSafeInteger(pkg.coins) && pkg.coins > 0 && Number.isFinite(pkg.price) && pkg.price > 0);
      return ok(res, { packages });
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
        .select("id,name,category,emoji,asset_key,graphic_url,animation_url,sound_url,coin_price,diamond_value")
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
          category: gift.category || null,
          emoji: gift.emoji || null,
          assetKey: gift.asset_key || null,
          graphicUrl: gift.graphic_url || null,
          animationUrl: gift.animation_url || null,
          soundUrl: gift.sound_url || null,
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

    // Existing team division/season standings API. Kept separate from creator-created leagues.
    if (await handleTeamLeagueRoute({
      pathname, method, req, res, fail, ok, db, requireSupabaseUser, profileFor, readJson, normalizeExternalError
    })) return;

    // Creator-specific league API. Kept separate from the existing team division/standings system.
    const handledCreatorLeague = await handleCreatorLeagueRoute({
      req, res, pathname, method,
      deps: { requireSupabaseUser, db, readJson, ok, send, paypal, paypalReturnUrl: PAYPAL_RETURN_URL, paypalEnv: PAYPAL_ENV }
    });
    if (handledCreatorLeague !== false) return;

    // LIVE room experience routes — participants, guests, battle, polls,
    // questions, moderators, analytics, recordings, settings, chat-moderation
    // and reactions, plus the recording-cleanup maintenance endpoint. These are
    // implemented in live-room-experience.js (handleLiveRoomExperience) but were
    // never imported or invoked here, so every one of them fell through to the
    // 404 handler below. Wire the handler into the authenticated server using
    // the same shared helpers the other route modules receive.
    if (
      await handleLiveRoomExperience({
        pathname,
        method,
        req,
        res,
        url,
        fail,
        ok,
        send,
        db,
        requireSupabaseUser,
        readJson,
        normalizeExternalError,
        liveRoomById,
      })
    ) {
      return;
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

// Validate environment before accepting traffic. In production this throws on
// missing required credentials so we never serve a half-configured backend.
assertEnvironmentReady(process.env, console);

server.listen(PORT, () => {
  console.log(`[Creator Hub Backend] Running successfully on port ${PORT}`);
});

// Graceful shutdown (v4.4.0): stop accepting new connections, drain in-flight
// requests, then exit. A bounded timer forces exit if draining stalls, so
// orchestrators (e.g. Render) get a clean, timely rollover.
function gracefulShutdown(signal) {
  console.log(`[Creator Hub Backend] Received ${signal}; shutting down gracefully...`);
  server.close(() => {
    console.log("[Creator Hub Backend] All connections drained. Exiting cleanly.");
    process.exit(0);
  });
  const forceTimer = setTimeout(() => {
    console.error("[Creator Hub Backend] Shutdown timed out; forcing exit.");
    process.exit(1);
  }, 10000);
  if (typeof forceTimer.unref === "function") forceTimer.unref();
}
process.on("SIGTERM", () => gracefulShutdown("SIGTERM"));
process.on("SIGINT", () => gracefulShutdown("SIGINT"));
