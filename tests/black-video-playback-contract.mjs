import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
for (const path of [
  'frontend/src/swipe-feed.js',
  'android/app/src/main/assets/web/src/swipe-feed.js'
]) {
  const source = readFileSync(new URL('../' + path, import.meta.url), 'utf8');
  assert.match(source, /setAttribute\('playsinline', ''\)/);
  assert.match(source, /addEventListener\('loadedmetadata'/);
  assert.match(source, /addEventListener\('loadeddata'/);
  assert.match(source, /addEventListener\('playing'/);
  assert.match(source, /video\.videoWidth > 0/);
  assert.match(source, /H\.264 video and AAC audio/);
}
for (const path of [
  'frontend/styles/platform-responsive.css',
  'android/app/src/main/assets/web/styles/platform-responsive.css'
]) {
  const css = readFileSync(new URL('../' + path, import.meta.url), 'utf8');
  assert.match(css, /\.chl-feed-video-status/);
}
console.log('Black video playback contract: passed');
