/* Creator Hub Live — central browser integration layer. */
(function () {
  'use strict';
  var CHL = window.CHL = window.CHL || {};
  var cfg = window.CreatorHubConfig || window.CHL_CONFIG || {};
  var supa = cfg.supabase || {};
  var apiCfg = cfg.api || {};
  CHL.cfg = cfg;
  CHL.brand = (cfg.app && cfg.app.name) || cfg.BRAND || 'Creator Hub Live';
  CHL.apiBase = String(apiCfg.baseUrl || cfg.API_BASE || window.CREATOR_HUB_API_BASE || '').replace(/\/$/, '');

  var sb = null;
  try {
    var url = supa.url || cfg.SUPABASE_URL;
    var key = supa.publishableKey || cfg.SUPABASE_PUBLISHABLE_KEY || cfg.SUPABASE_ANON_KEY;
    if (url && key && window.supabase && window.supabase.createClient && /^https:\/\/.+\.supabase\.co$/.test(url)) {
      sb = window.supabase.createClient(url, key, { auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true } });
    }
  } catch (e) { console.warn('Supabase initialization failed.', e); }
  CHL.sb = sb;
  CHL.configured = !!sb;

  CHL.getApiBase = function () {
    return (CHL.apiBase || (window.CREATOR_HUB_API_BASE || '')).replace(/\/$/, '');
  };
  CHL.apiUrl = function (path) {
    var p = String(path || '');
    if (!p) return CHL.getApiBase() || '/';
    if (/^https?:\/\//i.test(p)) return p;
    return (CHL.getApiBase() + '/' + p.replace(/^\/+/, '')).replace(/\/\/api\//, '/api/');
  };
  CHL.getSession = async function () {
    if (!sb) return null;
    var result = await sb.auth.getSession();
    return result && result.data ? result.data.session || null : null;
  };
  CHL.getAccessToken = async function () {
    var s = await CHL.getSession();
    return s && s.access_token ? s.access_token : null;
  };
  CHL.getCurrentUser = async function () {
    var s = await CHL.getSession();
    return s && s.user ? s.user : null;
  };
  CHL.signOut = async function () {
    if (sb) await sb.auth.signOut();
    CHL.user = null; CHL.profile = null;
    location.hash = '#/login';
  };
  CHL.onAuthStateChange = function (fn) {
    if (!sb) return { data: { subscription: { unsubscribe: function () {} } } };
    return sb.auth.onAuthStateChange(fn);
  };

  function errorFromResponse(response, data) {
    var err = new Error((data && (data.message || data.error)) || ('HTTP ' + response.status));
    err.status = response.status;
    err.code = (data && data.code) || (response.status === 401 ? 'AUTH_REQUIRED' : response.status === 403 ? 'FORBIDDEN' : 'API_ERROR');
    err.details = data && data.details;
    return err;
  }
  CHL.apiRequest = async function (path, options) {
    var opts = Object.assign({ method: 'GET', headers: {}, timeoutMs: 15000 }, options || {});
    var headers = new Headers(opts.headers || {});
    if (opts.body && typeof opts.body === 'object' && !(opts.body instanceof FormData)) {
      headers.set('Content-Type', 'application/json'); opts.body = JSON.stringify(opts.body);
    }
    var controller = new AbortController();
    var timeout = setTimeout(function () { controller.abort(); }, Number(opts.timeoutMs || 15000));
    var signal = opts.signal || controller.signal;
    try {
      var response = await fetch(CHL.apiUrl(path), { method: opts.method, headers: headers, body: opts.body, signal: signal, credentials: 'same-origin' });
      var text = await response.text(); var data = null;
      try { data = text ? JSON.parse(text) : null; } catch (_) { data = { raw: text }; }
      if (!response.ok) throw errorFromResponse(response, data);
      return data;
    } catch (e) {
      if (e && e.name === 'AbortError') { e.code = 'BACKEND_TIMEOUT'; e.message = 'The Creator Hub backend timed out.'; }
      if (!e.status && e.code !== 'BACKEND_TIMEOUT') { e.code = 'BACKEND_UNAVAILABLE'; e.message = 'The Creator Hub backend is unavailable.'; }
      throw e;
    } finally { clearTimeout(timeout); }
  };
  CHL.authenticatedApiRequest = async function (path, options) {
    var token = await CHL.getAccessToken();
    if (!token) { var e = new Error('Please sign in to continue.'); e.code = 'AUTH_REQUIRED'; e.status = 401; throw e; }
    var opts = Object.assign({}, options || {});
    opts.headers = Object.assign({}, opts.headers || {}, { Authorization: 'Bearer ' + token });
    return CHL.apiRequest(path, opts);
  };
  CHL.getPublicConfig = function () { return CHL.apiRequest('/api/config/public'); };
  CHL.getLiveKitToken = function (roomId) {
    return CHL.authenticatedApiRequest((apiCfg.livekitTokenPath || '/api/livekit/token'), { method: 'POST', body: { roomId: roomId } });
  };
  CHL.verifyConnection = async function () {
    if (!CHL.configured) { CHL.connState = 'unconfigured'; return CHL.connState; }
    try { await CHL.apiRequest('/api/health', { timeoutMs: 5000 }); CHL.connState = 'connected'; CHL.connError = null; }
    catch (e) { CHL.connState = e.code === 'BACKEND_UNAVAILABLE' ? 'error' : 'connected'; CHL.connError = e.message; }
    return CHL.connState;
  };

  function el(tag, attrs, kids) {
    var n = document.createElement(tag);
    if (attrs) for (var k in attrs) {
      if (k === 'class') n.className = attrs[k];
      else if (k === 'html') n.innerHTML = attrs[k];
      else if (k === 'text') n.textContent = attrs[k];
      else if (k.slice(0, 2) === 'on' && typeof attrs[k] === 'function') n.addEventListener(k.slice(2), attrs[k]);
      else if (attrs[k] != null) n.setAttribute(k, attrs[k]);
    }
    if (kids != null) (Array.isArray(kids) ? kids : [kids]).forEach(function (c) { if (c != null) n.appendChild(typeof c === 'string' ? document.createTextNode(c) : c); });
    return n;
  }
  function esc(s) { var d = document.createElement('div'); d.textContent = s == null ? '' : String(s); return d.innerHTML; }
  function qs(sel, root) { return (root || document).querySelector(sel); }
  CHL.el = el; CHL.esc = esc; CHL.qs = qs;
  CHL.uuid = function () { return crypto && crypto.randomUUID ? crypto.randomUUID() : Date.now() + '-' + Math.random().toString(36).slice(2); };
  CHL.initials = function (name) { if (!name) return '?'; var p = String(name).trim().split(/\s+/); return ((p[0] || '')[0] || '') + (p.length > 1 ? ((p[p.length - 1] || '')[0] || '') : ''); };
  CHL.fmt = function (n) { n = Number(n || 0); if (n >= 1e6) return (n / 1e6).toFixed(1).replace(/\.0$/, '') + 'M'; if (n >= 1e3) return (n / 1e3).toFixed(1).replace(/\.0$/, '') + 'K'; return String(n); };
  CHL.ago = function (ts) { if (!ts) return ''; var s = Math.max(0, (Date.now() - new Date(ts).getTime()) / 1000); if (s < 60) return 'just now'; if (s < 3600) return Math.floor(s / 60) + 'm ago'; if (s < 86400) return Math.floor(s / 3600) + 'h ago'; return Math.floor(s / 86400) + 'd ago'; };

  var toastT;
  CHL.toast = function (msg) { var t = qs('#toast'); if (!t) { t = el('div', { id: 'toast', class: 'toast' }); document.body.appendChild(t); } t.textContent = msg; t.classList.add('show'); clearTimeout(toastT); toastT = setTimeout(function () { t.classList.remove('show'); }, 3000); };

  CHL.user = null; CHL.profile = null;
  CHL.refreshAuth = async function () {
    if (!sb) return null;
    var u = await CHL.getCurrentUser(); CHL.user = u;
    if (!u) { CHL.profile = null; return null; }
    try { var p = await sb.from('profiles').select('*').eq('id', u.id).maybeSingle(); CHL.profile = p && p.data || null; } catch (_) { CHL.profile = null; }
    return u;
  };
  CHL.isAdmin = function () { return !!(CHL.profile && CHL.profile.is_admin === true); };

  /* ---- Backend state machine (never assume sb exists) ---- */
  CHL.BACKEND = { UNINITIALIZED: 'UNINITIALIZED', INITIALIZING: 'INITIALIZING', READY: 'READY', OFFLINE: 'OFFLINE', CONFIG_ERROR: 'CONFIG_ERROR', BACKEND_ERROR: 'BACKEND_ERROR', AUTH_REQUIRED: 'AUTH_REQUIRED' };
  CHL.backendStatus = function () {
    if (!CHL.configured || !CHL.sb) return CHL.BACKEND.CONFIG_ERROR;
    if (typeof navigator !== 'undefined' && navigator.onLine === false) return CHL.BACKEND.OFFLINE;
    if (CHL.connState === 'error') return CHL.BACKEND.BACKEND_ERROR;
    if (CHL.connState === 'connected') return CHL.BACKEND.READY;
    return CHL.BACKEND.INITIALIZING;
  };
  CHL.requireSupabase = function () {
    if (!CHL.sb) { var e = new Error('Creator Hub is temporarily unable to connect to its backend.'); e.code = 'CONFIG_ERROR'; throw e; }
    return CHL.sb;
  };
  CHL.requireAuth = function () {
    if (!CHL.user) { var e = new Error('Please sign in to continue.'); e.code = 'AUTH_REQUIRED'; e.status = 401; throw e; }
    return CHL.user;
  };
  CHL.safeBackendCall = async function (fn, opts) {
    opts = opts || {};
    try { var sbc = CHL.requireSupabase(); return await fn(sbc); }
    catch (e) { if (opts.rethrow) throw e; return { data: (opts.fallback != null ? opts.fallback : null), error: e }; }
  };
  CHL.diagnostics = function () {
    return {
      app: CHL.brand, version: (CHL.cfg && CHL.cfg.version) || '3.2.0',
      backendStatus: CHL.backendStatus(), configured: !!CHL.configured,
      connState: CHL.connState || null, connError: CHL.connError || null,
      supabase: !!CHL.sb, livekitSdk: !!(window.LivekitClient && window.LivekitClient.Room),
      serviceWorker: ('serviceWorker' in navigator) ? (navigator.serviceWorker.controller ? 'active' : 'none') : 'unsupported',
      online: (typeof navigator !== 'undefined') ? navigator.onLine : null,
      route: (CHL.current && CHL.current.path) || location.hash,
      lastError: CHL.lastError || null, duplicateRoutes: CHL.duplicateRoutes || []
    };
  };

  var routes = {};
  CHL.duplicateRoutes = [];
  CHL.route = function (path, fn) {
    if (routes.hasOwnProperty(path)) {
      CHL.duplicateRoutes.push(path);
      if (window.console && console.warn) console.warn('DUPLICATE ROUTE REGISTRATION: ' + path + ' (last registration wins)');
    }
    routes[path] = fn;
  };
  CHL.routes = routes;
  CHL.navigate = function (hash) { if (location.hash === hash) CHL.render(); else location.hash = hash; };
  function parseHash() {
    var h = (location.hash || '#/').replace(/^#/, ''); var qpos = h.indexOf('?'); if (qpos !== -1) h = h.slice(0, qpos);
    var parts = h.split('/').filter(Boolean), base = '/', params = [];
    for (var n = parts.length; n >= 0; n--) { var cand = '/' + parts.slice(0, n).join('/'); if (cand === '/' && n > 0) continue; if (routes.hasOwnProperty(cand)) { base = cand; params = parts.slice(n); break; } }
    if (base === '/' && parts.length && !routes.hasOwnProperty('/')) base = null;
    return { base: base, id: params[0] || null, params: params, parts: parts, path: '/' + parts.join('/') };
  }
  CHL.parseHash = parseHash; CHL.current = parseHash();
  var AUTH_REQUIRED = ['/wallet', '/create', '/profile', '/messages', '/notifications', '/settings', '/creator', '/gifts', '/subscriptions'];
  function isAuthRequired(base) { if (!base) return false; return AUTH_REQUIRED.some(function (r) { return base === r || base.indexOf(r + '/') === 0; }); }

  /* ---- Universal recoverable error page (never leave a blank/black screen) ---- */
  CHL.renderRecoverableError = function (outlet, base, err) {
    try {
      if (!outlet) outlet = qs('#outlet');
      if (!outlet) {
        var app0 = qs('#app');
        if (app0) { app0.className = ''; app0.innerHTML = ''; outlet = el('div', { id: 'outlet' }); app0.appendChild(outlet); }
      }
      if (!outlet) return;
      CHL.lastError = { route: base || null, message: (err && err.message) || String(err), code: (err && err.code) || null, time: new Date().toISOString() };
      outlet.innerHTML = '';
      var isTypeNull = err && (err instanceof TypeError) && /null|undefined|is not a function/.test(err.message || '');
      var backendIssue = !CHL.configured || isTypeNull || (err && (err.code === 'BACKEND_UNAVAILABLE' || err.code === 'BACKEND_TIMEOUT' || err.code === 'CONFIG_ERROR' || err.code === 'BACKEND_ERROR' || /supabase|backend|fetch/i.test(err.message || '')));
      var authIssue = err && (err.code === 'AUTH_REQUIRED' || err.status === 401);
      var title, detail;
      if (authIssue) { title = 'Please sign in to continue.'; detail = 'This page needs you to be signed in. The rest of the app stays available.'; }
      else if (backendIssue) { title = 'Creator Hub is temporarily unable to connect to its backend.'; detail = 'The interface is still available \u2014 you can keep browsing, retry the connection, or return home. No fake data is ever shown.'; }
      else { title = 'This page ran into a problem.'; detail = 'An unexpected error occurred while opening this page. You can retry or go home \u2014 the app will not stay on a blank screen.'; }
      var panel = el('div', { class: 'error-boundary note', style: 'max-width:640px;margin:40px auto;padding:22px;border-radius:14px' }, [
        el('div', { class: 'h1', style: 'font-size:19px;margin-bottom:6px', text: title }),
        el('p', { class: 'sub', style: 'margin:0 0 10px', text: detail }),
        el('p', { style: 'font-size:12px;opacity:.75;margin:0 0 16px', text: 'Page: ' + (base || '/') + (err && err.message ? '  \u00b7  ' + err.message : '') })
      ]);
      var row = el('div', { class: 'row wrap', style: 'gap:10px' }, [
        el('button', { class: 'btn primary', onclick: function () { CHL.verifyConnection().catch(function () {}).then(function () { CHL.render(); }); } }, 'Retry'),
        authIssue ? el('a', { href: '#/login', class: 'btn' }, 'Sign in') : el('a', { href: '#/discover', class: 'btn' }, 'Continue browsing'),
        el('a', { href: '#/', class: 'btn' }, 'Go Home'),
        el('button', { class: 'btn ghost', onclick: function () { try { location.reload(); } catch (_) {} } }, 'Reload App')
      ]);
      panel.appendChild(row);
      panel.appendChild(el('p', { style: 'font-size:12px;opacity:.65;margin-top:14px', text: 'Connection status: ' + (CHL.backendStatus ? CHL.backendStatus() : (CHL.connState || 'unknown')) }));
      outlet.appendChild(panel);
    } catch (fatal) {
      try { var a = qs('#app'); if (a) { a.className = ''; a.innerHTML = '<div style="padding:30px;color:#fff;font-family:system-ui">Something went wrong. <a href="#/" style="color:#8ab4ff">Go home</a></div>'; } } catch (_) {}
    }
  };

  CHL.render = async function () {
    CHL.current = parseHash();
    var base = CHL.current.base || '/404';
    if (isAuthRequired(base) && !CHL.user) { base = CHL.current.base = '/login'; CHL.current.params = []; }
    var outlet = null;
    try {
      if (CHL.mountShell) CHL.mountShell(CHL.current.base);
      outlet = qs('#outlet');
      if (!outlet) return;
      outlet.innerHTML = '';
      var fn = routes[base] || routes['/404'];
      if (fn) { await fn(outlet, CHL.current); }
      else { CHL.renderRecoverableError(outlet, base, new Error('No handler is registered for this route.')); }
      if (outlet && outlet.children.length === 0) {
        CHL.renderRecoverableError(outlet, base, new Error('This page did not render any content.'));
      }
      if (CHL.ui && CHL.ui.highlightNav) CHL.ui.highlightNav(base);
    } catch (err) {
      if (window.console) console.error('[CHL route error]', base, err);
      CHL.renderRecoverableError(outlet, base, err);
      if (CHL.ui && CHL.ui.highlightNav) { try { CHL.ui.highlightNav(base); } catch (_) {} }
    }
  };

  function installGlobalGuards() {
    if (CHL._guardsInstalled) return; CHL._guardsInstalled = true;
    window.addEventListener('error', function (ev) {
      CHL.lastError = { message: (ev && ev.message) || 'Script error', source: ev && ev.filename, line: ev && ev.lineno, time: new Date().toISOString() };
      if (window.console) console.error('[CHL global error]', ev && ev.message);
      var o = qs('#outlet');
      if (o && o.children.length === 0) CHL.renderRecoverableError(o, CHL.current && CHL.current.base, (ev && ev.error) || new Error(ev && ev.message || 'Script error'));
    });
    window.addEventListener('unhandledrejection', function (ev) {
      var reason = ev && ev.reason;
      CHL.lastError = { message: (reason && reason.message) || String(reason), code: reason && reason.code, time: new Date().toISOString() };
      if (window.console) console.error('[CHL unhandled rejection]', reason);
      var o = qs('#outlet');
      if (o && o.children.length === 0) CHL.renderRecoverableError(o, CHL.current && CHL.current.base, (reason instanceof Error) ? reason : new Error((reason && reason.message) || 'Unhandled error'));
    });
  }
  CHL.installGlobalGuards = installGlobalGuards;

  CHL.start = async function () {
    installGlobalGuards();
    if (CHL.duplicateRoutes && CHL.duplicateRoutes.length && window.console) {
      console.warn('DUPLICATE ROUTE REGISTRATION detected for: ' + CHL.duplicateRoutes.join(', '));
    }
    if (sb) {
      try { CHL.onAuthStateChange(function (_event) { CHL.refreshAuth().then(function () { CHL.render(); }).catch(function () { CHL.render(); }); }); } catch (_) {}
      try { await CHL.refreshAuth(); } catch (_) {}
      CHL.verifyConnection().catch(function () {});
    }
    window.addEventListener('hashchange', CHL.render);
    try { await CHL.render(); }
    catch (err) { CHL.renderRecoverableError(qs('#outlet'), CHL.current && CHL.current.base, err); }
  };
})();
