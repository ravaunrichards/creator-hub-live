import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import {
  createRequestGuard,
  normalizeRouteForLogs,
  publicErrorPayload,
  readLimitedBody,
  sanitizeErrorForLog,
} from '../src/production-hardening.js';

function request({method='POST', pathname='/api/anything', authorization='', remoteAddress='203.0.113.9', headers={}}={}) {
  return { method, url: pathname, headers: { ...(authorization ? { authorization } : {}), ...headers }, socket: { remoteAddress } };
}

// Request log paths retain endpoint identity but remove query strings and opaque IDs.
assert.equal(normalizeRouteForLogs('/api/live/rooms/7a3f12b7-53c9-4c0b-9d99-b7ec299d2344/chat?secret=1'), '/api/live/rooms/:id/chat');
assert.equal(normalizeRouteForLogs('/api/wallet/transactions?limit=100'), '/api/wallet/transactions');
assert.equal(normalizeRouteForLogs('/api/private/by-email/alice@example.com'), '/api/private/by-email/:id');
assert.equal(normalizeRouteForLogs('/api/private/by-email/alice%40example.com'), '/api/private/by-email/:id');
assert.equal(normalizeRouteForLogs('/api/private/phone/+1-876-555-0113'), '/api/private/phone/:id');

// 5xx payloads never expose raw database/provider errors or internal details.
const publicError = publicErrorPayload({
  status: 503,
  code: 'SUPABASE_SCHEMA_ERROR',
  message: 'relation private_table does not exist; access token is not to be shown',
  details: { databaseMessage: 'private_table missing' },
  hint: 'internal schema detail',
}, 'request-123');
assert.deepEqual(publicError, {
  ok: false,
  code: 'SUPABASE_SCHEMA_ERROR',
  requestId: 'request-123',
  error: 'An unexpected server error occurred. Please retry shortly.',
});
const clientError = publicErrorPayload({status:400,code:'INVALID_MESSAGE',message:'A message is required.'}, 'request-456');
assert.equal(clientError.error, 'A message is required.');
assert.equal(clientError.requestId, 'request-456');
const sanitizedLog = sanitizeErrorForLog('provider failed with Bearer eyJabc.secret.token, client_secret=super-secret-value, user jane@example.com, phone +1-876-555-0113');
assert.equal(sanitizedLog.includes('eyJabc.secret.token'), false);
assert.equal(sanitizedLog.includes('super-secret-value'), false);
assert.equal(sanitizedLog.includes('jane@example.com'), false);
assert.equal(sanitizedLog.includes('+1-876-555-0113'), false);

// Sensitive write endpoints use a tighter bucket and return a useful retry delay.
let time = 1_700_000_000_000;
const guard = createRequestGuard({ now: () => time, defaultWriteLimit: 3, sensitiveWriteLimit: 2, windowMs: 60_000, logger: { info() {} } });
const authReq = request({ authorization: 'Bearer user-A-token', pathname: '/api/wallet/gift' });
assert.equal(guard.check(authReq, {pathname:'/api/wallet/gift',method:'POST'}).allowed, true);
assert.equal(guard.check(authReq, {pathname:'/api/wallet/gift',method:'POST'}).allowed, true);
const limited = guard.check(authReq, {pathname:'/api/wallet/gift',method:'POST'});
assert.equal(limited.allowed, false);
assert.ok(limited.retryAfter >= 1);
assert.equal(guard.check(request({authorization:'Bearer user-B-token',pathname:'/api/wallet/gift'}), {pathname:'/api/wallet/gift',method:'POST'}).allowed, true);

// Rotating arbitrary bearer strings cannot evade the per-network backstop.
const antiRotateGuard = createRequestGuard({ now: () => time, defaultWriteLimit: 100, sensitiveWriteLimit: 100, networkWriteLimit: 100, networkSensitiveWriteLimit: 2, windowMs: 60_000, logger: { info() {} } });
assert.equal(antiRotateGuard.check(request({authorization:'Bearer random-A',remoteAddress:'198.51.100.8'}), {pathname:'/api/wallet/gift',method:'POST'}).allowed, true);
assert.equal(antiRotateGuard.check(request({authorization:'Bearer random-B',remoteAddress:'198.51.100.8'}), {pathname:'/api/wallet/gift',method:'POST'}).allowed, true);
assert.equal(antiRotateGuard.check(request({authorization:'Bearer random-C',remoteAddress:'198.51.100.8'}), {pathname:'/api/wallet/gift',method:'POST'}).allowed, false);
const trustedProxyGuard = createRequestGuard({ now: () => time, defaultWriteLimit: 1, sensitiveWriteLimit: 1, networkWriteLimit: 2, networkSensitiveWriteLimit: 2, windowMs: 60_000, trustProxyHeaders: true, logger: {info(){}} });
assert.equal(trustedProxyGuard.check(request({authorization:'Bearer proxy-A',headers:{'x-forwarded-for':'203.0.113.20'},remoteAddress:'10.0.0.8'}), {pathname:'/api/wallet/gift',method:'POST'}).allowed, true);
assert.equal(trustedProxyGuard.check(request({authorization:'Bearer proxy-B',headers:{'x-forwarded-for':'203.0.113.20'},remoteAddress:'10.0.0.9'}), {pathname:'/api/wallet/gift',method:'POST'}).allowed, true);
assert.equal(trustedProxyGuard.check(request({authorization:'Bearer proxy-C',headers:{'x-forwarded-for':'203.0.113.21'},remoteAddress:'10.0.0.8'}), {pathname:'/api/wallet/gift',method:'POST'}).allowed, true);
const boundedGuard = createRequestGuard({ now: () => time, maxKeys: 8, defaultWriteLimit: 100, networkWriteLimit: 1000, logger: {info(){}} });
for (let i = 0; i < 80; i += 1) boundedGuard.check(request({authorization:`Bearer rotating-token-${i}`,remoteAddress:`198.51.100.${i % 20 + 1}`}), {pathname:'/api/community/post',method:'POST'});
assert.ok(boundedGuard.getBucketCount() <= 8, 'rate-limit bucket storage must stay within the configured bound');

// Read-only paths and preflights do not consume a write budget.
const readGuard = createRequestGuard({ now: () => time, defaultWriteLimit: 1, sensitiveWriteLimit: 1, logger: {info(){}} });
assert.equal(readGuard.check(request({method:'GET'}), {pathname:'/api/profile',method:'GET'}).skipped, true);
assert.equal(readGuard.check(request({method:'OPTIONS'}), {pathname:'/api/profile',method:'OPTIONS'}).skipped, true);
assert.equal(readGuard.check(request(), {pathname:'/api/profile',method:'POST'}).allowed, true);
assert.equal(readGuard.check(request(), {pathname:'/api/profile',method:'POST'}).allowed, false);
assert.equal(readGuard.check(request(), {pathname:'/api/health',method:'POST'}).skipped, true);

// The guard emits a correlation ID and structured, query-free logs without credentials.
const records=[];
const logGuard=createRequestGuard({logger:{info(line){records.push(JSON.parse(line));}}});
const req=request({method:'GET',pathname:'/api/users/987654321?email=private@example.com',authorization:'Bearer a-sensitive-token-that-must-not-be-logged'});
const res=new EventEmitter();
res.headers={}; res.statusCode=200; res.writableFinished=false;
res.setHeader=(name,value)=>{res.headers[name.toLowerCase()]=value;};
const id=logGuard.begin(req,res,'/api/users/987654321','GET');
assert.equal(res.headers['x-request-id'],id);
assert.equal(res.headers['access-control-expose-headers'],'X-Request-ID, Retry-After');
res.statusCode=200; res.writableFinished=true; res.emit('finish');
assert.equal(records.length,1);
assert.equal(records[0].requestId,id);
assert.equal(records[0].path,'/api/users/:id');
assert.equal(JSON.stringify(records[0]).includes('private@example.com'),false);
assert.equal(JSON.stringify(records[0]).includes('a-sensitive-token'),false);
assert.equal(JSON.stringify(records[0]).includes('Authorization'),false);

// JSON body reading enforces the declared-length and chunked-stream limits.
const declaredTooLarge = request({headers:{'content-length':'10'}});
declaredTooLarge.resume = () => {};
await assert.rejects(readLimitedBody(declaredTooLarge, 4), (error) => error.status === 413 && error.code === 'PAYLOAD_TOO_LARGE');
async function* chunks() { yield Buffer.from('123'); yield Buffer.from('456'); }
await assert.rejects(readLimitedBody(chunks(), 4), (error) => error.status === 413 && error.code === 'PAYLOAD_TOO_LARGE');
async function* validChunks() { yield Buffer.from('{"ok":'); yield Buffer.from('true}'); }
assert.equal(await readLimitedBody(validChunks(), 32), '{"ok":true}');

console.log('PASS — correlation IDs/logging, route normalization, safe 5xx responses, bounded rate-limit buckets, sensitive write limits, body-size limits.');
