/* Creator Hub Live — safe static-shell service worker. */
var VERSION = 'chl-web-v3-3-0';
var SHELL = ['./','./index.html','./styles/app.css?v=3.3.0','./src/core.js?v=3.3.0','./src/ui.js?v=3.3.0','./src/pages-auth.js?v=3.3.0','./src/pages.js?v=3.3.0','./src/pages-admin.js?v=3.3.0','./src/pages-creator.js?v=3.3.0','./src/pages-extra.js?v=3.3.0','./src/pages-room.js?v=3.3.0','./src/pages-settings.js?v=3.3.0','./src/pages-wallet.js?v=3.3.0','./src/pages-teams.js?v=3.3.0','./src/livekit.js?v=3.3.0','./config.js?v=3.3.0','./config.example.js','./assets/logo.svg','./assets/icon.svg','./manifest.webmanifest'];
self.addEventListener('install', function(e){ self.skipWaiting(); e.waitUntil(caches.open(VERSION).then(function(c){ return Promise.all(SHELL.map(function(u){ return c.add(u).catch(function(){ /* one failed asset must never poison the whole cache */ }); })); })); });
self.addEventListener('activate', function(e){ e.waitUntil(caches.keys().then(function(keys){ return Promise.all(keys.map(function(k){ return k !== VERSION ? caches.delete(k) : null; })); }).then(function(){ return self.clients.claim(); })); });
self.addEventListener('fetch', function(e){
  if (e.request.method !== 'GET') return;
  var url = new URL(e.request.url);
  if (url.origin !== location.origin) return;
  if (url.pathname.indexOf('/api/') === 0 || url.pathname.indexOf('/rest/v1/') !== -1 || /supabase\.co$/.test(url.hostname) || url.pathname.includes('/livekit/')) return;
  // Config and application scripts use network-first so a deployment is not pinned to stale code/config.
  var networkFirst = url.pathname.endsWith('/config.js') || /\/src\/.*\.js$/.test(url.pathname) || url.pathname.endsWith('/styles/app.css') || url.pathname.endsWith('/index.html') || url.pathname === '/';
  e.respondWith(networkFirst ? fetch(e.request).then(function(res){ var c=res.clone(); caches.open(VERSION).then(function(cache){ cache.put(e.request,c).catch(function(){}); }); return res; }).catch(function(){ return caches.match(e.request).then(function(x){ return x || caches.match('./index.html'); }); }) : caches.match(e.request).then(function(hit){ return hit || fetch(e.request).then(function(res){ var c=res.clone(); caches.open(VERSION).then(function(cache){ cache.put(e.request,c).catch(function(){}); }); return res; }); }));
});
