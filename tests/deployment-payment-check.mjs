import fs from 'node:fs';
import assert from 'node:assert/strict';

const sw = fs.readFileSync('frontend/sw.js', 'utf8');
const server = fs.readFileSync('backend/src/server.js', 'utf8');
const wallet = fs.readFileSync('frontend/src/pages-wallet.js', 'utf8');
const envExample = fs.readFileSync('backend/.env.example', 'utf8');

assert.match(sw, /chl-web-v3-2-1/, 'service-worker cache version must change');
assert.match(sw, /pages-teams\.js/, 'Teams page should be in the shell cache');
assert.match(sw, /endsWith\('\/styles\/app\.css'\)/, 'stylesheet should be network-first');
assert.match(server, /approveUrl/, 'PayPal create-order response must include the approval URL');
assert.match(server, /PAYPAL_OAUTH_AUTH_FAILED/, 'PayPal OAuth 401 must return an actionable credential/environment error');
assert.match(server, /paypal=success#\/wallet/, 'PayPal return URL must target the hash wallet route');
assert.match(wallet, /choosePaymentMethod/, 'coin packages must open payment-method selection');
assert.match(wallet, /d\.captured \|\| d\.credited \|\| d\.status === 'completed'/, 'wallet must recognize completed capture responses');
assert.match(envExample, /SUPABASE_SERVICE_ROLE_KEY=replace_with_supabase_service_role_key/, 'service-role example must be a placeholder');
assert.match(envExample, /LIVEKIT_API_SECRET=replace_with_livekit_api_secret/, 'LiveKit secret example must be a placeholder');
assert.match(envExample, /PAYPAL_CLIENT_SECRET=replace_with_paypal_client_secret/, 'PayPal secret example must be a placeholder');
console.log('PASS — deployment cache and PayPal flow regression checks');
