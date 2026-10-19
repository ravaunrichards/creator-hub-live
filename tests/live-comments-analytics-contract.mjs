import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const frontend = readFileSync(new URL('../frontend/src/pages-creator.js', import.meta.url), 'utf8');
const android = readFileSync(new URL('../android/app/src/main/assets/web/src/pages-creator.js', import.meta.url), 'utf8');
function analyticsSource(source) {
  const start = source.indexOf("CHL.route('/creator/analytics'");
  const end = source.indexOf("CHL.route('/creator/live'", start);
  assert.notEqual(start, -1, 'Creator Analytics route must exist');
  assert.notEqual(end, -1, 'Analytics route must have a clear boundary');
  return source.slice(start, end);
}
const webAnalytics = analyticsSource(frontend);
const androidAnalytics = analyticsSource(android);
assert.equal(frontend, android, 'Android WebView page must match the frontend source exactly');
for (const [label, source] of [['frontend', webAnalytics], ['Android', androidAnalytics]]) {
  assert.doesNotMatch(source, /get_my_creator_metrics/, `${label} Analytics must not use the undocumented aggregate RPC`);
  assert.doesNotMatch(source, /from\(['\"]live_chat_messages['\"]\)/, `${label} Analytics must not query LIVE chat messages`);
  assert.doesNotMatch(source, /from\(['\"]comments['\"]\)/, `${label} Analytics must not query comment bodies/records`);
  assert.doesNotMatch(source, /comment_count/, `${label} Analytics must not report comment counts as analytics metrics`);
}
console.log('LIVE comments analytics contract passed');
