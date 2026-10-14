// ============================================================================
// Observability & request-safety helpers (v4.4.0 hardening)
// ----------------------------------------------------------------------------
// Zero-dependency utilities that make the backend operable and resilient in
// production:
//   * per-request correlation IDs (X-Request-Id)
//   * structured JSON access logging (one line per request)
//   * a hard request-body size cap to prevent memory-exhaustion DoS
//
// None of these weaken the existing server-side authority model; they are
// cross-cutting operational concerns only. No secret values are ever logged.
// ============================================================================

import { randomUUID } from "node:crypto";

const REQUEST_ID_PATTERN = /^[\w.-]{1,128}$/;

// Reuse a client-supplied X-Request-Id when it is a safe, bounded token so a
// trace can be followed across a proxy; otherwise mint a fresh UUID.
export function resolveRequestId(req) {
  const incoming = req && req.headers && req.headers["x-request-id"];
  if (typeof incoming === "string" && REQUEST_ID_PATTERN.test(incoming)) {
    return incoming;
  }
  try {
    return randomUUID();
  } catch {
    return "req-" + Date.now().toString(36) + "-" + Math.random().toString(36).slice(2, 10);
  }
}

export function clientIp(req) {
  const forwarded = String((req && req.headers && req.headers["x-forwarded-for"]) || "")
    .split(",")[0]
    .trim();
  if (forwarded) return forwarded;
  if (req && req.socket && req.socket.remoteAddress) return req.socket.remoteAddress;
  return "unknown";
}

// Emit a single structured JSON access-log line. Logging must never throw and
// break a response, so it is fully guarded.
export function logAccess(entry, logger = console) {
  try {
    logger.log(
      JSON.stringify({
        t: new Date().toISOString(),
        level: "info",
        msg: "request",
        ...entry,
      })
    );
  } catch {
    /* never let logging interfere with request handling */
  }
}

export const DEFAULT_MAX_BODY_BYTES = 1_000_000; // 1 MB

export function resolveMaxBodyBytes(env = process.env) {
  const value = Number(env.MAX_REQUEST_BODY_BYTES);
  return Number.isFinite(value) && value > 0 ? value : DEFAULT_MAX_BODY_BYTES;
}

// Read a request body into a UTF-8 string with a hard byte cap. Throws an error
// tagged `tooLarge` as soon as the cap is exceeded, so an abusive upload is cut
// off instead of being buffered to exhaustion.
export async function readRawBodyLimited(req, limit = DEFAULT_MAX_BODY_BYTES) {
  let size = 0;
  const chunks = [];
  for await (const chunk of req) {
    const buf = typeof chunk === "string" ? Buffer.from(chunk) : chunk;
    size += buf.length;
    if (size > limit) {
      const err = new Error("Request body too large.");
      err.tooLarge = true;
      err.limit = limit;
      throw err;
    }
    chunks.push(buf);
  }
  return Buffer.concat(chunks).toString("utf8");
}
