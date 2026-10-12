import fs from 'node:fs';
import assert from 'node:assert/strict';

const sw = fs.readFileSync('frontend/sw.js', 'utf8');
const server = fs.readFileSync('backend/src/server.js', 'utf8');
const wallet = fs.readFileSync('frontend/src/pages-wallet.js', 'utf8');
const envExample = fs.readFileSync('backend/.env.example', 'utf8');
const teamLeague = fs.readFileSync('backend/src/team-leagues.js', 'utf8');
const teamsPage = fs.readFileSync('frontend/src/pages-teams.js', 'utf8');
const index = fs.readFileSync('frontend/index.html', 'utf8');

assert.match(sw, /chl-web-v3-2-4/, 'service-worker cache version must change');
assert.match(sw, /pages-teams\.js\?v=3\.2\.4/, 'Teams page should be versioned in the shell cache');
assert.match(index, /styles\/app\.css\?v=3\.2\.4/, 'main stylesheet URL must be cache-busted on deployment');
assert.match(sw, /endsWith\('\/styles\/app\.css'\)/, 'stylesheet should be network-first');
assert.match(server, /approveUrl/, 'PayPal create-order response must include the approval URL');
assert.match(server, /handleTeamLeagueRoute\(\{/, 'team league standings route must be wired into the server');
assert.match(teamLeague, /LEAGUE_SEASON_LOOKUP_FAILED/, 'missing league schema must produce an actionable error');
assert.match(teamsPage, /CHL\.routes\['\/teams'\]/, 'the full Teams UI must own the Teams route');
assert.match(index, /src\/pages-teams\.js/, 'the live entry point must load the Teams UI');
assert.match(server, /PAYPAL_OAUTH_AUTH_FAILED/, 'PayPal OAuth 401 must return an actionable credential/environment error');
assert.match(server, /paypal=success#\/wallet/, 'PayPal return URL must target the hash wallet route');
assert.doesNotMatch(wallet, /choosePaymentMethod|Choose payment method|Continue with PayPal/, 'Buy Coins must not show a redundant payment-method step');
assert.match(wallet, /onclick: function \(\) \{ buy\(p\); \}/, 'coin package buttons must start PayPal checkout directly');
assert.match(wallet, /d\.captured \|\| d\.credited \|\| d\.status === 'completed'/, 'wallet must recognize completed capture responses');
assert.match(envExample, /SUPABASE_SERVICE_ROLE_KEY=replace_with_supabase_service_role_key/, 'service-role example must be a placeholder');
assert.match(envExample, /LIVEKIT_API_SECRET=replace_with_livekit_api_secret/, 'LiveKit secret example must be a placeholder');
assert.match(envExample, /PAYPAL_CLIENT_SECRET=replace_with_paypal_client_secret/, 'PayPal secret example must be a placeholder');
console.log('PASS — deployment cache and PayPal flow regression checks');
