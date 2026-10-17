/* Creator Hub Live — token-based Style Switcher and compatibility relay. */
(function () {
  'use strict';
  var CHL = window.CHL;
  if (!CHL || CHL.StyleSwitcher) return;
  var el = CHL.el;
  var GUEST_KEY = 'chl.appearance.guest.v1';
  var USER_KEY_PREFIX = 'chl.appearance.user.v1.';
  var activeUserId = null;
  var syncPromise = null;

  var THEMES = {
    night:   { label: 'CHL Night',       bg: '#0b0b12', bg2: '#13131f', card: '#191926', line: '#36364b', txt: '#f4f4f8', mut: '#b8b8cc', brand: '#c41450', brand2: '#5b45d6', ok: '#2ecc71', warn: '#ffb02e' },
    ocean:   { label: 'Ocean Studio',    bg: '#071923', bg2: '#0b2534', card: '#103447', line: '#285164', txt: '#eefaff', mut: '#b8d8e4', brand: '#006c7d', brand2: '#3158c8', ok: '#3bc98b', warn: '#ffd166' },
    violet:  { label: 'Violet Creator',  bg: '#100b1d', bg2: '#1b1230', card: '#24183c', line: '#493261', txt: '#f8f1ff', mut: '#d1bfe7', brand: '#7735a9', brand2: '#b02c6d', ok: '#59d99a', warn: '#ffd166' },
    emerald: { label: 'Emerald Studio',  bg: '#071711', bg2: '#0c251b', card: '#123728', line: '#285743', txt: '#effff4', mut: '#b6dfc4', brand: '#087447', brand2: '#8a5900', ok: '#38d98b', warn: '#ffcf66' },
    rose:    { label: 'Rose Premium',    bg: '#1d0b14', bg2: '#2b101e', card: '#3a1728', line: '#5b2b42', txt: '#fff2f7', mut: '#e6bed0', brand: '#b71952', brand2: '#7133b5', ok: '#58d69a', warn: '#ffd166' },
    light:   { label: 'Light Professional', bg: '#f4f6fb', bg2: '#e9edf6', card: '#ffffff', line: '#cbd3e2', txt: '#182033', mut: '#4b556b', brand: '#a3124a', brand2: '#4034b5', ok: '#087447', warn: '#8a5900' }
  };
  var FAMILIES = {
    typography: {
      system: { label: 'System', font: "'Segoe UI', system-ui, -apple-system, sans-serif", size: '1', line: '1.5' },
      studio: { label: 'Studio', font: "Arial, Helvetica, sans-serif", size: '1', line: '1.5' },
      readable: { label: 'Readable', font: "Verdana, Geneva, sans-serif", size: '1.02', line: '1.62' }
    },
    surfaces: {
      standard: { label: 'Standard', radius: '16px' },
      soft: { label: 'Soft rounded', radius: '22px' },
      sharp: { label: 'Clean edges', radius: '8px' }
    },
    density: {
      comfortable: { label: 'Comfortable', scale: '1' },
      compact: { label: 'Compact', scale: '0.88' }
    },
    motion: {
      standard: { label: 'Standard motion' },
      reduced: { label: 'Reduced motion' }
    },
    contrast: {
      standard: { label: 'Standard contrast' },
      high: { label: 'High contrast' }
    }
  };
  var COMBOS = {
    studio: { label: 'Creator Studio', theme: 'violet', typography: 'studio', surfaces: 'soft', density: 'comfortable', motion: 'standard', contrast: 'standard' },
    compactLive: { label: 'Compact Live', theme: 'night', typography: 'system', surfaces: 'sharp', density: 'compact', motion: 'reduced', contrast: 'high' },
    oceanFocus: { label: 'Ocean Focus', theme: 'ocean', typography: 'readable', surfaces: 'standard', density: 'comfortable', motion: 'reduced', contrast: 'standard' },
    brightAccess: { label: 'Bright Accessibility', theme: 'light', typography: 'readable', surfaces: 'standard', density: 'comfortable', motion: 'reduced', contrast: 'high' },
    emeraldCompact: { label: 'Emerald Compact', theme: 'emerald', typography: 'studio', surfaces: 'sharp', density: 'compact', motion: 'standard', contrast: 'standard' }
  };
  var DEFAULTS = { mode: 'individual', theme: 'night', typography: 'system', surfaces: 'standard', density: 'comfortable', motion: 'standard', contrast: 'standard' };
  var themeIds = Object.keys(THEMES);
  var familyIds = Object.keys(FAMILIES);

  function clone(value) { return JSON.parse(JSON.stringify(value)); }
  function normalize(value) {
    value = value && typeof value === 'object' ? value : {};
    var result = clone(DEFAULTS);
    result.mode = value.mode === 'combo' ? 'combo' : 'individual';
    if (THEMES[value.theme]) result.theme = value.theme;
    familyIds.forEach(function (key) {
      if (FAMILIES[key][value[key]]) result[key] = value[key];
    });
    if (result.mode === 'individual') {
      result.typography = 'system'; result.surfaces = 'standard'; result.density = 'comfortable'; result.motion = 'standard'; result.contrast = 'standard';
    }
    return result;
  }
  function safeGet(key) { try { var raw = localStorage.getItem(key); return raw ? normalize(JSON.parse(raw)) : null; } catch (_) { return null; } }
  function safeSet(key, value) { try { localStorage.setItem(key, JSON.stringify(normalize(value))); return true; } catch (_) { return false; } }
  function userKey(id) { return USER_KEY_PREFIX + String(id || ''); }
  function getPreference() {
    var localAccount = CHL.user && CHL.user.id ? safeGet(userKey(CHL.user.id)) : null;
    var guest = safeGet(GUEST_KEY);
    if (localAccount) return localAccount;
    if (guest) return guest;
    var migrated = migrateLegacyLocalPreference();
    if (migrated) { safeSet(GUEST_KEY, migrated); return migrated; }
    return clone(DEFAULTS);
  }

  function apply(value) {
    var p = normalize(value);
    var root = document.documentElement;
    root.setAttribute('data-chl-theme', p.theme);
    root.setAttribute('data-chl-typography', p.typography);
    root.setAttribute('data-chl-surfaces', p.surfaces);
    root.setAttribute('data-chl-density', p.density);
    root.setAttribute('data-chl-motion', p.motion);
    root.setAttribute('data-chl-contrast', p.contrast);
    var meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute('content', THEMES[p.theme].bg);
    return p;
  }
  function validPreference(value) {
    if (!value || typeof value !== 'object') return false;
    if (value.mode !== 'individual' && value.mode !== 'combo') return false;
    if (!THEMES[value.theme]) return false;
    return familyIds.every(function (key) { return !!FAMILIES[key][value[key]]; });
  }
  function legacyToPreference(value) {
    if (!value || typeof value !== 'object' || (!value.theme && !value.accent && !value.layout && !value.font)) return null;
    var theme = value.theme === 'light' ? 'light' : 'night';
    if (value.theme !== 'light') {
      if (value.accent === 'blue' || value.accent === 'cyan' || value.accent === 'ocean') theme = 'ocean';
      else if (value.accent === 'green' || value.accent === 'emerald') theme = 'emerald';
      else if (value.accent === 'pink' || value.accent === 'rose' || value.accent === 'red') theme = 'rose';
      else if (value.accent === 'violet' || value.accent === 'purple') theme = 'violet';
    }
    return normalize({ mode: 'combo', theme: theme, typography: value.font === 'readable' ? 'readable' : (value.font === 'studio' ? 'studio' : 'system'), surfaces: 'standard', density: value.layout === 'compact' || value.scale === 'compact' || Number(value.scale) < 0.95 ? 'compact' : 'comfortable', motion: 'standard', contrast: 'standard' });
  }
  function migrateLegacyLocalPreference() {
    try {
      var raw = localStorage.getItem('chl_appearance_v2');
      if (raw) {
        var migrated = legacyToPreference(JSON.parse(raw));
        if (migrated) return migrated;
      }
      var legacyTheme = localStorage.getItem('chl_ui_theme');
      if (legacyTheme) return legacyToPreference({ theme: legacyTheme });
    } catch (_) { /* an unreadable legacy preference must not block app startup */ }
    return null;
  }

  async function saveAccountPreference(p) {
    if (!CHL.user || !CHL.user.id || !CHL.sb) return { synced: false, reason: 'guest' };
    try {
      var result = await CHL.sb.from('user_settings').upsert({ user_id: CHL.user.id, appearance: normalize(p), updated_at: new Date().toISOString() }, { onConflict: 'user_id' });
      if (result && result.error) return { synced: false, reason: result.error.message || 'Account sync failed.' };
      safeSet(userKey(CHL.user.id), p);
      try { localStorage.removeItem(GUEST_KEY); } catch (_) {}
      return { synced: true };
    } catch (error) { return { synced: false, reason: error && error.message || 'Account sync failed.' }; }
  }
  async function onAuthChanged() {
    var user = CHL.user;
    if (!user || !user.id) {
      activeUserId = null;
      apply(getPreference());
      return;
    }
    if (activeUserId === user.id) return syncPromise || Promise.resolve();
    if (syncPromise) { try { await syncPromise; } catch (_) {} }
    if (activeUserId === user.id) return;
    activeUserId = user.id;
    syncPromise = (async function () {
      var accountValue = null;
      var result = null;
      try {
        result = await CHL.sb.from('user_settings').select('appearance').eq('user_id', user.id).maybeSingle();
        if (!result.error && result.data && validPreference(result.data.appearance)) accountValue = normalize(result.data.appearance);
        else if (!result.error && result.data && result.data.appearance) accountValue = legacyToPreference(result.data.appearance);
      } catch (_) { /* local fallback remains usable when the migration is not installed */ }
      if (!CHL.user || CHL.user.id !== user.id) return;
      if (accountValue) {
        safeSet(userKey(user.id), accountValue);
        apply(accountValue);
        if (!result || !result.data || !validPreference(result.data.appearance)) await saveAccountPreference(accountValue);
      } else {
        var localAccount = safeGet(userKey(user.id));
        var guest = safeGet(GUEST_KEY);
        var chosen = localAccount || guest || clone(DEFAULTS);
        apply(chosen);
        if (guest && !localAccount) await saveAccountPreference(chosen);
      }
      if (document.querySelector('[data-chl-style-switcher]')) render(document.querySelector('[data-chl-style-switcher]'));
    })();
    try { await syncPromise; } finally { syncPromise = null; }
  }
  async function save(value) {
    var p = apply(value);
    var key = CHL.user && CHL.user.id ? userKey(CHL.user.id) : GUEST_KEY;
    safeSet(key, p);
    if (CHL.user && CHL.user.id) {
      var result = await saveAccountPreference(p);
      return { preference: p, synced: result.synced, reason: result.reason };
    }
    return { preference: p, synced: false, local: true };
  }

  function optionSelect(label, key, selected, onChange) {
    var wrap = el('label', { class: 'field chl-style-field' });
    wrap.appendChild(el('span', { text: label }));
    var select = el('select', { class: 'input', name: key, 'aria-label': label });
    Object.keys(FAMILIES[key]).forEach(function (id) {
      select.appendChild(el('option', { value: id, selected: id === selected }, FAMILIES[key][id].label));
    });
    select.value = selected;
    select.addEventListener('change', function () { onChange(select.value); });
    wrap.appendChild(select);
    return wrap;
  }
  function themeButton(id, current, onClick) {
    var t = THEMES[id];
    var b = el('button', { type: 'button', class: 'chl-theme-option' + (id === current ? ' is-selected' : ''), 'aria-pressed': id === current ? 'true' : 'false', title: t.label });
    b.appendChild(el('span', { class: 'chl-theme-swatch', style: 'background:linear-gradient(135deg,' + t.brand + ',' + t.brand2 + ');border-color:' + t.line }));
    b.appendChild(el('span', { class: 'chl-theme-label', text: t.label }));
    b.addEventListener('click', function () { onClick(id); });
    return b;
  }
  function statusLine(text, kind) { return el('div', { class: 'note chl-style-status' + (kind ? ' is-' + kind : ''), role: 'status', 'aria-live': 'polite', text: text }); }

  async function runRelayTests() {
    var root = document.documentElement;
    var attrs = ['data-chl-theme','data-chl-typography','data-chl-surfaces','data-chl-density','data-chl-motion','data-chl-contrast'];
    var previous = attrs.map(function (name) { return root.getAttribute(name); });
    var passed = 0, failed = [], total = 0, contrastFailures = 0, cssFailures = 0, runtimeErrors = 0, overflowCombinations = 0;
    function luminance(hex) {
      var raw = String(hex || '').trim().replace('#','');
      if (raw.length === 3) raw = raw.split('').map(function (c) { return c+c; }).join('');
      if (!/^[0-9a-f]{6}$/i.test(raw)) return NaN;
      var rgb = [0,2,4].map(function (i) { var n = parseInt(raw.slice(i,i+2),16)/255; return n <= 0.04045 ? n/12.92 : Math.pow((n+0.055)/1.055,2.4); });
      return 0.2126*rgb[0]+0.7152*rgb[1]+0.0722*rgb[2];
    }
    function ratio(a,b) { var x=luminance(a),y=luminance(b); return Number.isFinite(x) && Number.isFinite(y) ? (Math.max(x,y)+0.05)/(Math.min(x,y)+0.05) : 0; }
    function readToken(name) { return getComputedStyle(root).getPropertyValue(name).trim(); }
    try {
      themeIds.forEach(function (theme) {
        Object.keys(FAMILIES.typography).forEach(function (typography) {
          Object.keys(FAMILIES.surfaces).forEach(function (surfaces) {
            Object.keys(FAMILIES.density).forEach(function (density) {
              Object.keys(FAMILIES.motion).forEach(function (motion) {
                Object.keys(FAMILIES.contrast).forEach(function (contrast) {
                  total++;
                  var sample = {theme:theme,typography:typography,surfaces:surfaces,density:density,motion:motion,contrast:contrast};
                  try {
                    root.setAttribute(attrs[0], theme); root.setAttribute(attrs[1], typography); root.setAttribute(attrs[2], surfaces); root.setAttribute(attrs[3], density); root.setAttribute(attrs[4], motion); root.setAttribute(attrs[5], contrast);
                    var tokens = ['--bg','--bg2','--card','--line','--txt','--mut','--brand','--brand2','--radius'];
                    var values = tokens.map(readToken);
                    var cssValid = values.every(function (v) { return !!v; }) && CSS.supports('color', readToken('--bg')) && CSS.supports('border-radius', readToken('--radius'));
                    var bg = readToken('--bg'), card = readToken('--card'), txt = readToken('--txt'), mut = readToken('--mut'), brand = readToken('--brand'), brand2 = readToken('--brand2');
                    var contrastOk = ratio(txt,bg) >= 4.5 && ratio(txt,card) >= 4.5 && ratio(mut,bg) >= 4.5 && ratio(mut,card) >= 4.5 && ratio('#ffffff',brand) >= 4.5 && ratio('#ffffff',brand2) >= 4.5;
                    var hasOverflow = root.scrollWidth > root.clientWidth;
                    if (hasOverflow) overflowCombinations++;
                    if (cssValid && contrastOk) passed++;
                    else {
                      if (!cssValid) cssFailures++;
                      if (!contrastOk) contrastFailures++;
                      if (failed.length < 12) failed.push(Object.assign({}, sample, {cssValid:cssValid,contrastOk:contrastOk,overflow:hasOverflow}));
                    }
                  } catch (error) {
                    runtimeErrors++;
                    if (failed.length < 12) failed.push(Object.assign({}, sample, {runtimeError:String(error && error.message || error)}));
                  }
                });
              });
            });
          });
        });
      });
    } finally {
      attrs.forEach(function (name, i) { if (previous[i] == null) root.removeAttribute(name); else root.setAttribute(name, previous[i]); });
    }
    return { total: total, passed: passed, failed: total-passed, contrastFailures: contrastFailures, cssFailures: cssFailures, runtimeErrors: runtimeErrors, overflowCombinations: overflowCombinations, examples: failed, viewport: { width: document.documentElement.clientWidth, height: document.documentElement.clientHeight, horizontalOverflow: overflowCombinations > 0 } };
  }

  function render(container) {
    if (!container) return;
    container.innerHTML = '';
    container.setAttribute('data-chl-style-switcher', 'true');
    var current = getPreference();
    var draft = clone(current);
    var card = el('section', { class: 'card chl-style-switcher-card' });
    card.appendChild(el('div', { class: 'h2', text: 'Style Switcher' }));
    card.appendChild(el('p', { class: 'sub', text: 'Choose one style or combine compatible style families. Changes use CHL design tokens instead of stacking unrelated CSS files.' }));
    var modeRow = el('div', { class: 'row wrap chl-style-mode', role: 'group', 'aria-label': 'Style mode' });
    var individual = el('button', { type: 'button', class: 'btn' + (draft.mode === 'individual' ? ' primary' : ''), 'aria-pressed': draft.mode === 'individual' ? 'true' : 'false', text: 'Individual styles' });
    var combo = el('button', { type: 'button', class: 'btn' + (draft.mode === 'combo' ? ' primary' : ''), 'aria-pressed': draft.mode === 'combo' ? 'true' : 'false', text: 'Combo styles' });
    modeRow.appendChild(individual); modeRow.appendChild(combo); card.appendChild(modeRow);
    var chooser = el('div', { class: 'chl-style-chooser' }); card.appendChild(chooser);
    var actionRow = el('div', { class: 'row wrap chl-style-actions' }); card.appendChild(actionRow);
    var feedback = el('div', { class: 'chl-style-feedback', 'aria-live': 'polite' }); card.appendChild(feedback);
    function say(message, kind) { feedback.innerHTML = ''; feedback.appendChild(statusLine(message, kind)); }
    function repaintChooser() {
      chooser.innerHTML = '';
      if (draft.mode === 'individual') {
        chooser.appendChild(el('div', { class: 'chl-style-section-title', text: 'Available individual styles' }));
        var themes = el('div', { class: 'chl-theme-grid' });
        themeIds.forEach(function (id) { themes.appendChild(themeButton(id, draft.theme, function (theme) { draft = normalize({ mode: 'individual', theme: theme }); apply(draft); safeSet(CHL.user && CHL.user.id ? userKey(CHL.user.id) : GUEST_KEY, draft); repaintChooser(); persistCurrent('Style applied.'); })); });
        chooser.appendChild(themes);
      } else {
        chooser.appendChild(el('div', { class: 'chl-style-section-title', text: 'Build a combo from compatible style families' }));
        var presets = el('label', { class: 'field chl-style-field' }); presets.appendChild(el('span', { text: 'Start with a combo preset' }));
        var presetSelect = el('select', { class: 'input', 'aria-label': 'Combo preset' });
        presetSelect.appendChild(el('option', { value: '' }, 'Custom combination'));
        Object.keys(COMBOS).forEach(function (id) { presetSelect.appendChild(el('option', { value: id }, COMBOS[id].label)); });
        presetSelect.addEventListener('change', function () { if (COMBOS[presetSelect.value]) { draft = normalize(Object.assign({}, COMBOS[presetSelect.value], { mode: 'combo' })); repaintChooser(); say('Preset loaded for preview. Apply it to save.'); } });
        chooser.appendChild(presets); presets.appendChild(presetSelect);
        var themeField = el('label', { class: 'field chl-style-field' }); themeField.appendChild(el('span', { text: 'Base colour style' }));
        var themeSelect = el('select', { class: 'input', 'aria-label': 'Base colour style' });
        themeIds.forEach(function (id) { themeSelect.appendChild(el('option', { value: id }, THEMES[id].label)); }); themeSelect.value = draft.theme;
        themeSelect.addEventListener('change', function () { draft.theme = themeSelect.value; updateComboPreview(); }); themeField.appendChild(themeSelect); chooser.appendChild(themeField);
        var familyGrid = el('div', { class: 'chl-family-grid' }); chooser.appendChild(familyGrid);
        var preview = el('div', { class: 'chl-combo-preview' });
        function updateComboPreview() {
          preview.innerHTML = '';
          [[THEMES[draft.theme].label], [FAMILIES.typography[draft.typography].label], [FAMILIES.surfaces[draft.surfaces].label], [FAMILIES.density[draft.density].label], [FAMILIES.motion[draft.motion].label], [FAMILIES.contrast[draft.contrast].label]].forEach(function (item) {
            preview.appendChild(el('span', { class: 'chl-preview-chip', text: item[0] }));
          });
        }
        familyIds.forEach(function (key) { familyGrid.appendChild(optionSelect(FAMILIES[key] && key.charAt(0).toUpperCase()+key.slice(1), key, draft[key], function (value) { draft[key] = value; updateComboPreview(); })); });
        updateComboPreview();
        chooser.appendChild(preview);
      }
    }
    async function persistCurrent(successMessage) {
      var result = await save(draft);
      say(result.synced ? successMessage + ' Saved to your account and this device.' : (result.local ? successMessage + ' Saved on this device; sign in to sync across devices.' : successMessage + ' Saved locally. Account sync unavailable: ' + (result.reason || 'apply the appearance migration to enable sync.')), result.synced || result.local ? 'success' : 'warning');
    }
    individual.addEventListener('click', function () { draft.mode = 'individual'; draft.typography = 'system'; draft.surfaces = 'standard'; draft.density = 'comfortable'; draft.motion = 'standard'; draft.contrast = 'standard'; repaintChooser(); updateModeButtons(); });
    combo.addEventListener('click', function () { draft.mode = 'combo'; repaintChooser(); updateModeButtons(); });
    function updateModeButtons() { individual.classList.toggle('primary', draft.mode === 'individual'); combo.classList.toggle('primary', draft.mode === 'combo'); individual.setAttribute('aria-pressed', draft.mode === 'individual' ? 'true' : 'false'); combo.setAttribute('aria-pressed', draft.mode === 'combo' ? 'true' : 'false'); }
    var previewBtn = el('button', { type: 'button', class: 'btn', text: 'Preview selection' });
    previewBtn.addEventListener('click', function () { apply(draft); say('Preview active. It is not saved yet; use Apply & save to keep it.', 'warning'); });
    var saveBtn = el('button', { type: 'button', class: 'btn primary', text: 'Apply & save' });
    saveBtn.addEventListener('click', function () { persistCurrent('Appearance applied.'); });
    var relayBtn = el('button', { type: 'button', class: 'btn', text: 'Run style relay tests' });
    relayBtn.addEventListener('click', async function () {
      relayBtn.disabled = true; relayBtn.textContent = 'Testing styles…';
      try {
        var result = await runRelayTests();
        var message = result.passed + '/' + result.total + ' theme/family combinations passed token and contrast checks.';
        if (result.viewport.horizontalOverflow) message += ' Warning: this viewport currently has horizontal overflow.';
        else message += ' No horizontal overflow at ' + result.viewport.width + '×' + result.viewport.height + '.';
        if (result.failed) message += ' ' + result.failed + ' combinations need review; contrast-related failures: ' + result.contrastFailures + '.';
        say(message, result.failed || result.viewport.horizontalOverflow ? 'warning' : 'success');
        if (result.failed && result.examples.length) console.table(result.examples);
      } catch (error) { say('Style relay could not finish: ' + (error && error.message || 'unknown error'), 'error'); }
      finally { relayBtn.disabled = false; relayBtn.textContent = 'Run style relay tests'; }
    });
    var resetBtn = el('button', { type: 'button', class: 'btn ghost', text: 'Restore saved style' });
    resetBtn.addEventListener('click', function () { draft = getPreference(); apply(draft); repaintChooser(); updateModeButtons(); say('Saved appearance restored.'); });
    actionRow.appendChild(previewBtn); actionRow.appendChild(saveBtn); actionRow.appendChild(relayBtn); actionRow.appendChild(resetBtn);
    repaintChooser();
    container.appendChild(card);
  }

  CHL.StyleSwitcher = {
    themes: THEMES,
    families: FAMILIES,
    combos: COMBOS,
    normalize: normalize,
    getPreference: getPreference,
    apply: apply,
    save: save,
    render: render,
    runRelayTests: runRelayTests,
    onAuthChanged: onAuthChanged
  };
  apply(getPreference());
})();
