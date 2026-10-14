// Unit tests for v4.4.0 observability + request-safety helpers.
// Run: node backend/tests/observability.test.js
import assert from "node:assert";
import { Readable } from "node:stream";
import {
  resolveRequestId,
  clientIp,
  logAccess,
  resolveMaxBodyBytes,
  readRawBodyLimited,
  DEFAULT_MAX_BODY_BYTES,
} from "../src/observability.js";

let passed = 0;
function test(name, fn) {
  fn();
  passed += 1;
  console.log("  PASS " + name);
}

// Minimal request stub: a Readable that also carries a headers map.
function reqWithBody(body, headers = {}) {
  const stream = Readable.from([Buffer.from(body)]);
  stream.headers = headers;
  stream.socket = {};
  return stream;
}

console.log("observability.test.js");

test("resolveRequestId reuses a safe client-supplied id", () => {
  const id = resolveRequestId({ headers: { "x-request-id": "abc-123.DEF" } });
  assert.strictEqual(id, "abc-123.DEF");
});

test("resolveRequestId rejects unsafe id and mints a new one", () => {
  const id = resolveRequestId({ headers: { "x-request-id": "bad id with spaces/" } });
  assert.notStrictEqual(id, "bad id with spaces/");
  assert.ok(id.length > 0);
});

test("resolveRequestId mints an id when none provided", () => {
  const id = resolveRequestId({ headers: {} });
  assert.ok(typeof id === "string" && id.length >= 8);
});

test("clientIp prefers first x-forwarded-for hop then socket", () => {
  assert.strictEqual(
    clientIp({ headers: { "x-forwarded-for": "203.0.113.5, 10.0.0.1" }, socket: {} }),
    "203.0.113.5"
  );
  assert.strictEqual(
    clientIp({ headers: {}, socket: { remoteAddress: "198.51.100.7" } }),
    "198.51.100.7"
  );
});

test("logAccess never throws and emits one JSON line", () => {
  const lines = [];
  logAccess({ id: "x", method: "GET", path: "/api/health", status: 200 }, { log: (s) => lines.push(s) });
  assert.strictEqual(lines.length, 1);
  const parsed = JSON.parse(lines[0]);
  assert.strictEqual(parsed.msg, "request");
  assert.strictEqual(parsed.status, 200);
  // circular payload must not throw
  const circular = {};
  circular.self = circular;
  logAccess({ bad: circular }, { log: () => { throw new Error("boom"); } });
});

test("resolveMaxBodyBytes honours env override and falls back to default", () => {
  assert.strictEqual(resolveMaxBodyBytes({ MAX_REQUEST_BODY_BYTES: "2048" }), 2048);
  assert.strictEqual(resolveMaxBodyBytes({}), DEFAULT_MAX_BODY_BYTES);
  assert.strictEqual(resolveMaxBodyBytes({ MAX_REQUEST_BODY_BYTES: "-5" }), DEFAULT_MAX_BODY_BYTES);
});

async function asyncTest(name, fn) {
  await fn();
  passed += 1;
  console.log("  PASS " + name);
}

const run = async () => {
  await asyncTest("readRawBodyLimited returns the full body under the cap", async () => {
    const body = await readRawBodyLimited(reqWithBody('{"a":1}'), 1000);
    assert.strictEqual(body, '{"a":1}');
  });

  await asyncTest("readRawBodyLimited throws tooLarge past the cap", async () => {
    let threw = null;
    try {
      await readRawBodyLimited(reqWithBody("x".repeat(50)), 10);
    } catch (e) {
      threw = e;
    }
    assert.ok(threw && threw.tooLarge === true);
    assert.strictEqual(threw.limit, 10);
  });

  console.log(passed + " passed, 0 failed");
};

run();
