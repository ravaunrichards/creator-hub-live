/* Creator Hub Live — persistent appearance, layout and typography controls. */
(function () {
  'use strict';
  var KEY = 'chl_appearance_v2';
  var LEGACY_THEME_KEY = 'chl_ui_theme';
  var DEFAULTS = { theme: 'dark', layout: 'classic', font: 'system', scale: '1', accent: 'violet' };
  var THEMES = [
    { id: 'dark', label: 'Creator Hub Live · Dark', css: 'dark' },
    { id: 'light', label: 'Clean Light', css: 'minimal' },
    { id: 'aurora', label: 'Aurora Night', css: 'aurora' }
  ];
  var LAYOUTS = [
    { id: 'classic', label: 'Classic · current layout' },
    { id: 'compact', label: 'Compact · more content' },
    { id: 'spacious', label: 'Spacious · more breathing room' },
    { id: 'grid', label: 'Grid · card-focused pages' },
    { id: 'immersive', label: 'Immersive · content-first' },
    { id: 'studio', label: 'Studio · creator workspace' }
  ];
  var FONTS = [
    { id: 'system', label: 'System (recommended)', stack: 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif' },
    { id: 'modern', label: 'Modern', stack: 'Inter, ui-sans-serif, system-ui, sans-serif' },
    { id: 'rounded', label: 'Rounded', stack: '"Trebuchet MS", system-ui, sans-serif' },
    { id: 'serif', label: 'Serif', stack: 'Georgia, "Times New Roman", serif' }
  ];
  var ACCENTS = [
    { id: 'violet', label: 'Creator Violet', value: '#8b75ff' },
    { id: 'blue', label: 'Ocean Blue', value: '#3988ff' },
    { id: 'teal', label: 'Caribbean Teal', value: '#12b8a6' },
    { id: 'rose', label: 'Rose', value: '#f05a9d' },
    { id: 'gold', label: 'Gold', value: '#e5a52d' }
  ];
  var preferences = readLocal();
  var syncingAccount = false;
  var saveTimer = null;

  function validChoice(value, list, fallback) {
    return list.some(function (item) { return item.id === value; }) ? value : fallback;
  }
  function normalize(input) {
    input = input && typeof input === 'object' ? input : {};
    return {
      theme: validChoice(input.theme, THEMES, DEFAULTS.theme),
      layout: validChoice(input.layout, LAYOUTS, DEFAULTS.layout),
      font: validChoice(input.font, FONTS, DEFAULTS.font),
      scale: ['0.9', '1', '1.1', '1.2'].indexOf(String(input.scale)) >= 0 ? String(input.scale) : DEFAULTS.scale,
      accent: validChoice(input.accent, ACCENTS, DEFAULTS.accent)
    };
  }
  function readLocal() {
    try {
      var saved = JSON.parse(localStorage.getItem(KEY) || 'null');
      if (!saved) saved = { theme: localStorage.getItem(LEGACY_THEME_KEY) || DEFAULTS.theme };
      return normalize(saved);
    } catch (_) { return normalize(DEFAULTS); }
  }
  function find(id, list) { return list.find(function (item) { return item.id === id; }) || list[0]; }
  function installRules() {
    if (document.getElementById('chl-appearance-rules')) return;
    var style = document.createElement('style');
    style.id = 'chl-appearance-rules';
    style.textContent = [
      'html[data-chl-style] { --chl-muted:#c5c8d6; --chl-user-font-scale:1; --chl-accent:#8b75ff; font-family:var(--chl-user-font,system-ui,sans-serif); }',
      'html[data-chl-style="minimal"] { --chl-muted:#3e4658; }',
      'html[data-chl-style] body { font-family:var(--chl-user-font,system-ui,sans-serif); font-size:calc(1rem * var(--chl-user-font-scale,1)); font-weight:500; }',
      'html[data-chl-style] h1,html[data-chl-style] h2,html[data-chl-style] h3,html[data-chl-style] .h1,html[data-chl-style] .h2 { font-weight:850!important; letter-spacing:-.02em; }',
      'html[data-chl-style] button,html[data-chl-style] .btn,html[data-chl-style] label,html[data-chl-style] .chip { font-weight:750!important; }',
      'html[data-chl-style] .sub,html[data-chl-style] .muted,html[data-chl-style] .caption,html[data-chl-style] small { color:var(--chl-muted)!important; }',
      'html[data-chl-style="minimal"] .sub,html[data-chl-style="minimal"] .muted,html[data-chl-style="minimal"] .caption,html[data-chl-style="minimal"] small { color:#3e4658!important; }',
      'html[data-chl-style] :focus-visible { outline:3px solid var(--chl-accent,#2878ff)!important; outline-offset:3px!important; }',
      'html[data-chl-style] .btn.primary,html[data-chl-style] button.primary { background:var(--chl-accent)!important; border-color:var(--chl-accent)!important; }',
      'html[data-chl-style] .chip.on,html[data-chl-style] .pill { border-color:var(--chl-accent)!important; }',
      'html[data-chl-layout="compact"] .card { padding:12px!important; } html[data-chl-layout="compact"] .grid { gap:9px!important; }',
      'html[data-chl-layout="spacious"] .card { padding:22px!important; } html[data-chl-layout="spacious"] .grid { gap:18px!important; }',
      'html[data-chl-layout="grid"] .grid.live { grid-template-columns:repeat(auto-fill,minmax(min(100%,220px),1fr))!important; }',
      'html[data-chl-layout="immersive"] .hero { max-width:1100px; margin-inline:auto; padding-block:clamp(22px,5vw,64px)!important; } html[data-chl-layout="immersive"] .live-video-card { padding:0!important; }',
      'html[data-chl-layout="studio"] .live-room-layout { grid-template-columns:minmax(0,1.5fr) minmax(300px,1fr)!important; }',
      '@media(max-width:720px){html[data-chl-layout="studio"] .live-room-layout{grid-template-columns:minmax(0,1fr)!important;} html[data-chl-layout="spacious"] .card{padding:16px!important;}}',
      '@media(prefers-reduced-motion:reduce){html[data-chl-style] *,html[data-chl-style] *::before,html[data-chl-style] *::after{animation:none!important;transition:none!important;scroll-behavior:auto!important}}'
    ].join('\n');
    (document.head || document.documentElement).appendChild(style);
  }
  function apply(next, persist, sync) {
    preferences = normalize(next);
    var root = document.documentElement;
    var theme = find(preferences.theme, THEMES);
    var font = find(preferences.font, FONTS);
    var accent = find(preferences.accent, ACCENTS);
    root.setAttribute('data-chl-style', theme.css);
    root.setAttribute('data-chl-theme', theme.id);
    root.setAttribute('data-chl-layout', preferences.layout);
    root.setAttribute('data-chl-font', preferences.font);
    root.style.setProperty('--chl-user-font', font.stack);
    root.style.setProperty('--chl-user-font-scale', preferences.scale);
    root.style.setProperty('--chl-accent', accent.value);
    root.style.colorScheme = theme.id === 'light' ? 'light' : 'dark';
    if (persist !== false) {
      try {
        localStorage.setItem(KEY, JSON.stringify(preferences));
        localStorage.setItem(LEGACY_THEME_KEY, preferences.theme);
      } catch (_) {}
    }
    syncControls();
    window.dispatchEvent(new CustomEvent('chl:appearance-change', { detail: Object.assign({}, preferences) }));
    window.dispatchEvent(new CustomEvent('chl:ui-theme-change', { detail: { theme: preferences.theme, layout: preferences.layout } }));
    if (sync !== false) scheduleAccountSave();
  }
  function setOptions(select, items, current) {
    items.forEach(function (item) {
      var option = document.createElement('option'); option.value = item.id; option.textContent = item.label; select.appendChild(option);
    });
    select.value = current;
  }
  function syncControls() {
    var panel = document.getElementById('chl-style-panel');
    ['theme', 'layout', 'font', 'scale', 'accent'].forEach(function (key) {
      var oldInput = panel && panel.querySelector('[data-appearance="' + key + '"]');
      if (oldInput) oldInput.value = preferences[key];
      document.querySelectorAll('select[data-chl-appearance="' + key + '"]').forEach(function (input) { input.value = preferences[key]; });
    });
    var status = document.getElementById('chl-ui-theme-status');
    if (status) status.textContent = 'Saved locally · ' + find(preferences.theme, THEMES).label + ' · ' + find(preferences.layout, LAYOUTS).label;
  }
  function scheduleAccountSave() {
    if (syncingAccount || !window.CHL || !CHL.user || !CHL.sb || !CHL.configured) return;
    if (saveTimer) window.clearTimeout(saveTimer);
    saveTimer = window.setTimeout(async function () {
      saveTimer = null;
      try {
        var result = await CHL.sb.from('user_settings').upsert({
          user_id: CHL.user.id,
          appearance: preferences,
          updated_at: new Date().toISOString()
        }, { onConflict: 'user_id' });
        if (result && result.error) throw result.error;
        var status = document.getElementById('chl-ui-theme-status');
        if (status) status.textContent = 'Appearance saved on this device and account.';
      } catch (error) {
        var status = document.getElementById('chl-ui-theme-status');
        if (status) status.textContent = 'Saved on this device. Account sync needs the appearance migration and access policy.';
        if (window.console) console.info('[Creator Hub appearance] account sync not available:', error && error.message || error);
      }
    }, 350);
  }
  async function loadAccountPreferences(user) {
    if (!user || !window.CHL || !CHL.sb || !CHL.configured || syncingAccount) return;
    syncingAccount = true;
    var shouldUploadLocal = false;
    try {
      var result = await CHL.sb.from('user_settings').select('appearance').eq('user_id', user.id).maybeSingle();
      if (result && result.error) throw result.error;
      var accountAppearance = result && result.data && result.data.appearance;
      if (accountAppearance && typeof accountAppearance === 'object' && Object.keys(accountAppearance).length) {
        apply(Object.assign({}, preferences, accountAppearance), true, false);
      } else {
        shouldUploadLocal = true;
      }
    } catch (error) {
      if (window.console) console.info('[Creator Hub appearance] unable to load account preference:', error && error.message || error);
    } finally {
      syncingAccount = false;
      if (shouldUploadLocal) scheduleAccountSave();
    }
  }
  function createField(panel, labelText, id, items) {
    var wrap = document.createElement('label'); wrap.className = 'chl-appearance-field'; wrap.htmlFor = 'chl-appearance-' + id;
    var label = document.createElement('span'); label.textContent = labelText;
    var select = document.createElement('select'); select.id = 'chl-appearance-' + id; select.className = 'input'; select.setAttribute('data-appearance', id);
    setOptions(select, items, preferences[id]);
    select.addEventListener('change', function () { var next = Object.assign({}, preferences); next[id] = select.value; apply(next, true, true); });
    wrap.appendChild(label); wrap.appendChild(select); panel.appendChild(wrap);
  }
  function setup() {
    // Remove any legacy launcher in a soft-reloaded page. Appearance controls
    // now live only under Settings and must never cover the live/chat controls.
    var oldLauncher = document.getElementById('chl-style-launcher');
    if (oldLauncher) oldLauncher.remove();
    installRules();
    apply(preferences, true, false);
  }

  window.CHLStyleSystem = {
    themes: THEMES.slice(), layouts: LAYOUTS.slice(),
    fonts: FONTS.map(function (font) { return { id: font.id, label: font.label }; }),
    accents: ACCENTS.map(function (accent) { return { id: accent.id, label: accent.label }; }),
    scales: [{ id: '0.9', label: 'Small' }, { id: '1', label: 'Standard' }, { id: '1.1', label: 'Large' }, { id: '1.2', label: 'Extra large' }],
    get: function () { return Object.assign({}, preferences); },
    apply: function (next) { apply(Object.assign({}, preferences, next || {}), true, true); },
    open: function () { if (window.CHL && typeof CHL.navigate === 'function') CHL.navigate('#/settings/appearance'); }
  };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', setup, { once: true }); else setup();
  if (window.CHL && typeof CHL.onAuthStateChange === 'function') {
    try { CHL.onAuthStateChange(function (_event, session) { window.setTimeout(function () { if (session && session.user) loadAccountPreferences(session.user); }, 0); }); } catch (_) {}
  }
  if (window.CHL && CHL.user) window.setTimeout(function () { loadAccountPreferences(CHL.user); }, 0);
})();
