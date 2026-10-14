// ============================================================================
// Zero-dependency in-memory rate limiter (v4.3.0 hardening)
// ----------------------------------------------------------------------------
// Protects abuse-prone, cost-bearing endpoints (LiveKit token minting, PayPal
// order create/capture, destructive account actions) from brute-force and
// accidental retry storms. Keyed per client + bucket with a fixed window.
//
// This is a defence-in-depth layer, NOT a substitute for the server-side
// authority already enforced on each route. Webhooks are intentionally NOT
// rate limited here so legitimate PayPal retries are never dropped.
//
// For multi-instance / horizontally-scaled deployments, back this with a shared
// store (e.g. Redis INCR + EXPIRE) using the same key scheme; see
// docs/RECOMMENDATIONS-4.3.0.md.
// ============================================================================

const buckets = new Map();

function clientKey(req) {
  const forwarded = String((req && req.headers && req.headers["x-forwarded-for"]) || "")
    .split(",")[0]
    .trim();
  if (forwarded) return forwarded;
  if (req && req.socket && req.socket.remoteAddress) return req.socket.remoteAddress;
  return "unknown";
}

// Build a limiter with a fixed window. Returns a function that, given a key,
// records one hit and reports whether the caller is still within the limit.
export function createRateLimiter(options = {}) {
  const windowMs = Number(options.windowMs) > 0 ? Number(options.windowMs) : 60000;
  const max = Number(options.max) > 0 ? Number(options.max) : 30;
  return function consume(key, now = Date.now()) {
    let bucket = buckets.get(key);
    if (!bucket || now >= bucket.reset) {
      bucket = { count: 0, reset: now + windowMs };
      buckets.set(key, bucket);
    }
    bucket.count += 1;
    const allowed = bucket.count <= max;
    const remaining = Math.max(0, max - bucket.count);
    const resetMs = Math.max(0, bucket.reset - now);
    return { allowed, remaining, limit: max, resetMs };
  };
}

export function rateLimitKeyForRequest(req, bucketName) {
  return String(bucketName) + "|" + clientKey(req);
}

// Opportunistic cleanup so the Map cannot grow unbounded for one-off clients.
export function pruneRateLimitBuckets(now = Date.now()) {
  for (const [key, bucket] of buckets) {
    if (now >= bucket.reset) buckets.delete(key);
  }
  return buckets.size;
}

// Exposed for unit tests only.
export function __resetRateLimitState() {
  buckets.clear();
}
