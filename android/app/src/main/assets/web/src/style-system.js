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
    if (!panel) return;
    ['theme', 'layout', 'font', 'scale', 'accent'].forEach(function (key) {
      var input = panel.querySelector('[data-appearance="' + key + '"]'); if (input) input.value = preferences[key];
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
    if (!document.body || document.getElementById('chl-style-launcher')) return;
    installRules();
    var inlineStyle = document.createElement('style');
    inlineStyle.textContent = '#chl-style-launcher{position:fixed;right:max(12px,env(safe-area-inset-right));bottom:max(12px,env(safe-area-inset-bottom));z-index:1500;font:inherit}#chl-style-launcher .chl-style-toggle{border:1px solid var(--line,#4b5268);background:var(--panel,#171824);color:var(--text,#fff);box-shadow:0 8px 30px #0005;border-radius:999px;padding:11px 15px;cursor:pointer}#chl-style-panel{width:min(380px,calc(100vw - 24px));max-height:min(78vh,680px);overflow:auto;background:var(--panel,#171824);color:var(--text,#fff);border:1px solid var(--line,#4b5268);border-radius:18px;padding:16px;box-shadow:0 18px 55px #0007;margin-bottom:10px}#chl-style-panel[hidden]{display:none}#chl-style-panel h2{font-size:18px;margin:0 0 4px}#chl-style-panel .chl-style-hint{font-size:12px;line-height:1.5;opacity:.85;margin:12px 0}#chl-style-panel .chl-appearance-field{display:grid;gap:6px;margin:12px 0;font-size:13px}#chl-style-panel .input{width:100%;min-height:42px}#chl-style-panel .chl-style-actions{display:flex;gap:8px;flex-wrap:wrap}#chl-style-panel .chl-style-actions .btn{flex:1}';
    document.head.appendChild(inlineStyle);
    var launcher = document.createElement('aside'); launcher.id = 'chl-style-launcher'; launcher.setAttribute('aria-label', 'Appearance settings');
    var toggle = document.createElement('button'); toggle.type = 'button'; toggle.className = 'chl-style-toggle'; toggle.textContent = '◐ Appearance'; toggle.setAttribute('aria-expanded', 'false'); toggle.setAttribute('aria-controls', 'chl-style-panel');
    var panel = document.createElement('section'); panel.id = 'chl-style-panel'; panel.hidden = true; panel.setAttribute('aria-label', 'Personalize Creator Hub Live');
    var heading = document.createElement('h2'); heading.textContent = 'Your experience'; panel.appendChild(heading);
    var sub = document.createElement('p'); sub.className = 'chl-style-hint'; sub.textContent = 'Choose a theme, layout, font, size and accent. Classic keeps the current layout.'; panel.appendChild(sub);
    createField(panel, 'Color theme', 'theme', THEMES);
    createField(panel, 'Layout', 'layout', LAYOUTS);
    createField(panel, 'Font', 'font', FONTS);
    createField(panel, 'Text size', 'scale', [ { id:'0.9', label:'Small' }, { id:'1', label:'Standard' }, { id:'1.1', label:'Large' }, { id:'1.2', label:'Extra large' } ]);
    createField(panel, 'Accent color', 'accent', ACCENTS);
    var status = document.createElement('p'); status.id = 'chl-ui-theme-status'; status.className = 'chl-style-hint'; status.setAttribute('aria-live', 'polite'); panel.appendChild(status);
    var hint = document.createElement('p'); hint.className = 'chl-style-hint'; hint.textContent = 'Your choices never change coin prices, gift assets, permissions or account records. Some room layouts stay optimized for their specific task.'; panel.appendChild(hint);
    var actions = document.createElement('div'); actions.className = 'chl-style-actions';
    var reset = document.createElement('button'); reset.type = 'button'; reset.className = 'btn'; reset.textContent = 'Reset appearance'; reset.addEventListener('click', function () { apply(DEFAULTS, true, true); });
    var close = document.createElement('button'); close.type = 'button'; close.className = 'btn'; close.textContent = 'Close'; close.addEventListener('click', function () { panel.hidden = true; toggle.setAttribute('aria-expanded', 'false'); toggle.focus(); });
    actions.appendChild(reset); actions.appendChild(close); panel.appendChild(actions); launcher.appendChild(toggle); launcher.appendChild(panel); document.body.appendChild(launcher);
    toggle.addEventListener('click', function () { var opening = panel.hidden; panel.hidden = !opening; toggle.setAttribute('aria-expanded', String(opening)); if (opening) panel.querySelector('select').focus(); });
    document.addEventListener('keydown', function (event) { if (event.key === 'Escape' && !panel.hidden) { panel.hidden = true; toggle.setAttribute('aria-expanded', 'false'); toggle.focus(); } });
    apply(preferences, true, false);
  }

  window.CHLStyleSystem = {
    themes: THEMES.slice(), layouts: LAYOUTS.slice(), fonts: FONTS.map(function (font) { return { id: font.id, label: font.label }; }),
    get: function () { return Object.assign({}, preferences); },
    apply: function (next) { apply(Object.assign({}, preferences, next || {}), true, true); },
    open: function () { var button = document.querySelector('#chl-style-launcher > button'); if (button) button.click(); }
  };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', setup, { once: true }); else setup();
  if (window.CHL && typeof CHL.onAuthStateChange === 'function') {
    try { CHL.onAuthStateChange(function (_event, session) { window.setTimeout(function () { if (session && session.user) loadAccountPreferences(session.user); }, 0); }); } catch (_) {}
  }
  if (window.CHL && CHL.user) window.setTimeout(function () { loadAccountPreferences(CHL.user); }, 0);
})();
