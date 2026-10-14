// Unit tests for the zero-dependency rate limiter and env readiness check.
// Run: node backend/tests/rate-limit.test.js
import assert from "node:assert";
import {
  createRateLimiter,
  rateLimitKeyForRequest,
  pruneRateLimitBuckets,
  __resetRateLimitState,
} from "../src/rate-limit.js";
import { validateEnvironment } from "../src/env-check.js";

let passed = 0;
function test(name, fn) {
  __resetRateLimitState();
  fn();
  passed += 1;
  console.log("  PASS " + name);
}

console.log("rate-limit.test.js");

test("allows requests up to the limit then blocks", () => {
  const limiter = createRateLimiter({ windowMs: 1000, max: 3 });
  const base = 1000;
  assert.strictEqual(limiter("k", base).allowed, true);
  assert.strictEqual(limiter("k", base).allowed, true);
  const third = limiter("k", base);
  assert.strictEqual(third.allowed, true);
  assert.strictEqual(third.remaining, 0);
  const fourth = limiter("k", base);
  assert.strictEqual(fourth.allowed, false);
  assert.strictEqual(fourth.remaining, 0);
});

test("window resets after it elapses", () => {
  const limiter = createRateLimiter({ windowMs: 1000, max: 1 });
  assert.strictEqual(limiter("k", 0).allowed, true);
  assert.strictEqual(limiter("k", 500).allowed, false);
  assert.strictEqual(limiter("k", 1000).allowed, true);
});

test("keys are isolated per client/bucket", () => {
  const limiter = createRateLimiter({ windowMs: 1000, max: 1 });
  assert.strictEqual(limiter("a", 0).allowed, true);
  assert.strictEqual(limiter("b", 0).allowed, true);
  assert.strictEqual(limiter("a", 0).allowed, false);
});

test("rateLimitKeyForRequest derives key from x-forwarded-for then socket", () => {
  const k1 = rateLimitKeyForRequest(
    { headers: { "x-forwarded-for": "203.0.113.9, 10.0.0.1" }, socket: {} },
    "/api/livekit/token"
  );
  assert.strictEqual(k1, "/api/livekit/token|203.0.113.9");
  const k2 = rateLimitKeyForRequest(
    { headers: {}, socket: { remoteAddress: "198.51.100.4" } },
    "/api/payments/paypal/capture-order"
  );
  assert.strictEqual(k2, "/api/payments/paypal/capture-order|198.51.100.4");
});

test("pruneRateLimitBuckets drops only expired buckets", () => {
  const limiter = createRateLimiter({ windowMs: 1000, max: 5 });
  limiter("old", 0);
  limiter("fresh", 5000);
  const remaining = pruneRateLimitBuckets(5500);
  assert.strictEqual(remaining, 1);
});

test("validateEnvironment flags missing required creds", () => {
  const r = validateEnvironment({});
  assert.strictEqual(r.ready, false);
  assert.ok(r.missingRequired.includes("SUPABASE_URL"));
  assert.ok(r.missingRequired.includes("SUPABASE_SERVICE_ROLE_KEY"));
});

test("validateEnvironment ready when required creds present", () => {
  const r = validateEnvironment({
    SUPABASE_URL: "https://x.supabase.co",
    SUPABASE_SERVICE_ROLE_KEY: "svc",
  });
  assert.strictEqual(r.ready, true);
  assert.ok(r.missingRecommended.includes("LIVEKIT_API_KEY"));
});

test("validateEnvironment marks production correctly", () => {
  assert.strictEqual(validateEnvironment({ NODE_ENV: "production" }).isProduction, true);
  assert.strictEqual(validateEnvironment({ NODE_ENV: "development" }).isProduction, false);
});

console.log(passed + " passed, 0 failed");
