// Foreground smoke test: boots the real server, hits key routes, exits.
// No credentials present -> protected routes must return honest errors
// (REQUIRES_CONFIGURATION / AUTH_REQUIRED), NOT fake success.
import http from 'node:http';
process.env.PORT = process.env.PORT || '4599';
await import('../src/server.js');
const base = `http://127.0.0.1:${process.env.PORT}`;
function req(method, path, headers = {}, body) {
  return new Promise((resolve, reject) => {
    const r = http.request(base + path, { method, headers }, (res) => {
      let d = ''; res.on('data', c => d += c); res.on('end', () => resolve({ status: res.statusCode, body: d }));
    });
    r.on('error', reject); if (body) r.write(body); r.end();
  });
}
await new Promise(r => setTimeout(r, 400));
const cases = [
  ['GET', '/api/health'],
  ['GET', '/api/livekit/health'],
  ['GET', '/api/live/rooms'],
  ['GET', '/api/wallet/balance'],
  ['POST', '/api/livekit/token'],
  ['POST', '/api/payments/create-order'],
  ['GET', '/api/leagues'],
  ['GET', '/api/nope-does-not-exist'],
  ['OPTIONS', '/api/health'],
];
let pass = 0, fail = 0;
for (const [m, p] of cases) {
  try {
    const res = await req(m, p);
    let j = {}; try { j = JSON.parse(res.body); } catch {}
    const code = j.code || (j.ok ? 'OK' : '');
    // Honesty assertions: unauthenticated/unconfigured protected routes must NOT return ok:true.
    const protectedPath = /wallet|token|payments/.test(p) && m !== 'OPTIONS';
    const honest = !protectedPath || j.ok !== true;
    console.log(`${honest ? 'PASS' : 'FAIL'} ${m} ${p} -> ${res.status} ${code}`);
    honest ? pass++ : fail++;
  } catch (e) { console.log(`FAIL ${m} ${p} -> ${e.message}`); fail++; }
}
console.log(`\nLIVE SMOKE: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
