import { createHash, randomUUID } from 'node:crypto';

const WRITE_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);
const HEALTH_PATHS = new Set(['/api/health', '/api/livekit/health', '/api/config/public']);
const UUID_SEGMENT = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const SECRET_LIKE_SEGMENT = /^[A-Za-z0-9_-]{32,}$/;

function positiveInteger(value, fallback, max = Number.MAX_SAFE_INTEGER) {
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) && parsed > 0 ? Math.min(parsed, max) : fallback;
}

function httpError(status, code, message) {
  const error = new Error(message);
  error.status = status;
  error.code = code;
  return error;
}

export function normalizeRouteForLogs(pathname) {
  const path = String(pathname || '/').split('?')[0] || '/';
  return path.split('/').map((part) => {
    let candidate = part;
    try { candidate = decodeURIComponent(part); } catch { /* retain the encoded segment */ }
    if (part.length > 128 || UUID_SEGMENT.test(candidate) || /^\d{4,}$/.test(candidate) || SECRET_LIKE_SEGMENT.test(candidate)
        || /^[^/@\s]+@[^/@\s]+\.[^/@\s]+$/.test(candidate)
        || /^\+?[\d(). -]{7,}$/.test(candidate)) return ':id';
    return part;
  }).join('/') || '/';
}

function bearerIdentity(req) {
  const match = /^Bearer\s+(.+)$/i.exec(String(req?.headers?.authorization || '').trim());
  if (!match) return null;
  // Never retain or log the bearer credential itself.
  return `token:${createHash('sha256').update(match[1].trim()).digest('hex').slice(0, 24)}`;
}

function networkIdentity(req, trustProxyHeaders) {
  if (trustProxyHeaders) {
    const forwarded = String(req?.headers?.['x-forwarded-for'] || '').split(',')[0].trim();
    if (forwarded && forwarded.length <= 128 && !/[\r\n]/.test(forwarded)) return `ip:${forwarded}`;
  }
  const remote = String(req?.socket?.remoteAddress || req?.connection?.remoteAddress || 'unknown').slice(0, 128);
  return `ip:${remote}`;
}

function clientIdentity(req, trustProxyHeaders) {
  return bearerIdentity(req) || networkIdentity(req, trustProxyHeaders);
}

function isSensitiveWrite(pathname) {
  return /^\/api\/(?:auth(?:\/|$)|login(?:\/|$)|register(?:\/|$)|wallet(?:\/|$)|payments\/(?!webhook(?:\/|$))|paypal\/(?!webhook(?:\/|$))|payouts(?:\/|$)|creator\/payouts(?:\/|$)|admin\/payouts(?:\/|$)|social\/(?:follows|blocks)(?:\/|$)|livekit\/token(?:\/|$)|live\/rooms$|live\/rooms\/[^/]+\/(?:start|end|join|leave|moderators|settings|recordings|polls|questions|chat-moderation|guests|guest-requests)(?:\/|$))/i.test(pathname);
}

export function createRequestGuard(options = {}) {
  const now = typeof options.now === 'function' ? options.now : Date.now;
  const logger = options.logger || console;
  const windowMs = positiveInteger(options.windowMs ?? process.env.BACKEND_RATE_LIMIT_WINDOW_MS, 60_000, 3_600_000);
  const defaultWriteLimit = positiveInteger(options.defaultWriteLimit ?? process.env.BACKEND_WRITE_RATE_LIMIT, 240, 100_000);
  const sensitiveWriteLimit = positiveInteger(options.sensitiveWriteLimit ?? process.env.BACKEND_SENSITIVE_WRITE_RATE_LIMIT, 45, 10_000);
  // A generous network backstop prevents attackers from evading per-token quotas by rotating fake bearer strings.
  const networkWriteLimit = positiveInteger(options.networkWriteLimit ?? process.env.BACKEND_NETWORK_WRITE_RATE_LIMIT, 6_000, 500_000);
  const networkSensitiveWriteLimit = positiveInteger(options.networkSensitiveWriteLimit ?? process.env.BACKEND_NETWORK_SENSITIVE_WRITE_RATE_LIMIT, 900, 100_000);
  const maxKeys = positiveInteger(options.maxKeys ?? process.env.BACKEND_RATE_LIMIT_MAX_KEYS, 10_000, 100_000);
  const enabled = options.enabled ?? String(process.env.BACKEND_RATE_LIMIT_ENABLED || 'true').toLowerCase() !== 'false';
  const trustProxyHeaders = options.trustProxyHeaders ?? String(process.env.TRUST_PROXY_HEADERS || 'false').toLowerCase() === 'true';
  const buckets = new Map();
  let operations = 0;

  function remember(key, bucket) {
    // Refresh insertion order as an inexpensive LRU approximation.
    buckets.delete(key);
    buckets.set(key, bucket);
    while (buckets.size > maxKeys) buckets.delete(buckets.keys().next().value);
  }

  function prune(currentTime) {
    for (const [key, bucket] of buckets) {
      if (currentTime - bucket.lastSeen > windowMs * 2) buckets.delete(key);
    }
    while (buckets.size > maxKeys) buckets.delete(buckets.keys().next().value);
  }

  function begin(req, res, pathname, method) {
    if (req.__chlRequestId) return req.__chlRequestId;
    const requestId = randomUUID();
    const startedAt = now();
    const safePath = normalizeRouteForLogs(pathname);
    const safeMethod = String(method || req.method || 'GET').toUpperCase();
    req.__chlRequestId = requestId;
    res.setHeader('X-Request-ID', requestId);
    res.setHeader('Access-Control-Expose-Headers', 'X-Request-ID, Retry-After');
    let logged = false;
    const record = (outcome) => {
      if (logged) return;
      logged = true;
      const entry = {
        event: 'http.request.complete',
        requestId,
        method: safeMethod,
        path: safePath,
        status: Number(res.statusCode) || 0,
        durationMs: Math.max(0, now() - startedAt),
      };
      if (outcome === 'aborted') entry.outcome = 'aborted';
      try { (logger.info || logger.log || (() => {})).call(logger, JSON.stringify(entry)); } catch { /* logging must not change request outcomes */ }
    };
    if (typeof res.once === 'function') {
      res.once('finish', () => record('finish'));
      res.once('close', () => { if (!res.writableFinished) record('aborted'); });
    }
    return requestId;
  }

  function check(req, route = {}) {
    const method = String(route.method || req.method || 'GET').toUpperCase();
    const pathname = String(route.pathname || '/').split('?')[0] || '/';
    if (!enabled || !WRITE_METHODS.has(method) || HEALTH_PATHS.has(pathname)) return { allowed: true, skipped: true };

    const currentTime = now();
    const sensitive = isSensitiveWrite(pathname);
    const category = sensitive ? 'sensitive' : 'write';
    const identityCapacity = sensitive ? sensitiveWriteLimit : defaultWriteLimit;
    const networkCapacity = sensitive ? networkSensitiveWriteLimit : networkWriteLimit;
    const identity = clientIdentity(req, trustProxyHeaders);
    const network = networkIdentity(req, trustProxyHeaders);
    const identityKey = `${identity}:${category}`;
    const networkKey = `${network}:network-${category}`;

    function consume(key, capacity) {
      const refillPerMs = capacity / windowMs;
      let bucket = buckets.get(key);
      if (!bucket) bucket = { tokens: capacity, updatedAt: currentTime, lastSeen: currentTime };
      bucket.tokens = Math.min(capacity, bucket.tokens + Math.max(0, currentTime - bucket.updatedAt) * refillPerMs);
      bucket.updatedAt = currentTime;
      bucket.lastSeen = currentTime;
      if (bucket.tokens < 1) {
        remember(key, bucket);
        return { allowed: false, retryAfter: Math.max(1, Math.ceil((1 - bucket.tokens) / refillPerMs / 1000)), limit: capacity, windowMs };
      }
      bucket.tokens -= 1;
      remember(key, bucket);
      return { allowed: true, limit: capacity, remaining: Math.max(0, Math.floor(bucket.tokens)), windowMs };
    }

    const identityDecision = consume(identityKey, identityCapacity);
    const networkDecision = consume(networkKey, networkCapacity);
    operations += 1;
    if (operations % 128 === 0 || buckets.size > maxKeys) prune(currentTime);
    if (!identityDecision.allowed || !networkDecision.allowed) {
      return {
        allowed: false,
        retryAfter: Math.max(identityDecision.retryAfter || 1, networkDecision.retryAfter || 1),
        limit: Math.min(identityCapacity, networkCapacity),
        windowMs,
      };
    }
    return { allowed: true, limit: identityCapacity, remaining: identityDecision.remaining, windowMs };
  }

  return { begin, check, getBucketCount: () => buckets.size };
}

export async function readLimitedBody(req, maxBytes = positiveInteger(process.env.BACKEND_MAX_BODY_BYTES, 1_048_576, 10_485_760)) {
  const limit = positiveInteger(maxBytes, 1_048_576, 10_485_760);
  const rawLength = req?.headers?.['content-length'];
  if (rawLength !== undefined) {
    const contentLength = Number(rawLength);
    if (Number.isFinite(contentLength) && contentLength > limit) {
      try { req.resume?.(); } catch { /* best effort drain */ }
      throw httpError(413, 'PAYLOAD_TOO_LARGE', `Request body exceeds the ${limit}-byte limit.`);
    }
  }

  const chunks = [];
  let size = 0;
  let oversized = false;
  for await (const chunk of req) {
    const bytes = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    size += bytes.length;
    if (size <= limit) chunks.push(bytes);
    else oversized = true;
  }
  if (oversized) throw httpError(413, 'PAYLOAD_TOO_LARGE', `Request body exceeds the ${limit}-byte limit.`);
  return Buffer.concat(chunks, size).toString('utf8');
}


export function sanitizeErrorForLog(value) {
  return String(value || 'Unknown error.')
    .replace(/\bBearer\s+[A-Za-z0-9._~+\/-]+=*/gi, 'Bearer [REDACTED]')
    .replace(/\b(?:authorization|access[_-]?token|refresh[_-]?token|id[_-]?token|client[_-]?secret|service[_-]?role|api[_-]?key|secret)\b\s*[:=]\s*[^,\s;]+/gi, '[CREDENTIAL REDACTED]')
    .replace(/\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi, '[EMAIL REDACTED]')
    .replace(/\+?\d[\d\s().-]{7,}\d/g, '[PHONE REDACTED]')
    .replace(/\b[A-Za-z0-9_-]{48,}\b/g, '[LONG TOKEN REDACTED]')
    .slice(0, 500);
}

export function publicErrorPayload(error, requestId = undefined) {
  const status = Number(error?.status) || Number(error?.statusCode) || 500;
  const candidateCode = String(error?.code || 'INTERNAL_ERROR');
  const code = /^[A-Z0-9_:-]{1,80}$/i.test(candidateCode) ? candidateCode : 'INTERNAL_ERROR';
  const payload = { ok: false, code };
  if (requestId) payload.requestId = String(requestId).slice(0, 80);

  if (status >= 500) {
    payload.error = 'An unexpected server error occurred. Please retry shortly.';
    return payload;
  }

  payload.error = String(error?.message || 'Request failed.').slice(0, 1000);
  if (error?.details !== undefined && error?.details !== null) payload.details = error.details;
  if (error?.hint !== undefined && error?.hint !== null) payload.hint = error.hint;
  return payload;
}
