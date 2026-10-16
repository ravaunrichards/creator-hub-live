/* Creator Hub Live — persistent appearance selector, wired to the shipped style system. */
(function () {
  'use strict';
  var KEY = 'chl_ui_theme';
  var THEMES = [
    { id: 'dark', label: 'Creator Hub Live · Dark', css: 'dark' },
    { id: 'light', label: 'Clean Light', css: 'minimal' },
    { id: 'aurora', label: 'Aurora Night', css: 'aurora' }
  ];
  function findTheme(id) { return THEMES.find(function (x) { return x.id === id; }) || THEMES[0]; }
  function apply(id) {
    var selected = findTheme(id);
    var root = document.documentElement;
    root.setAttribute('data-chl-style', selected.css);
    root.setAttribute('data-chl-theme', selected.id);
    try { localStorage.setItem(KEY, selected.id); } catch (_) {}
    var select = document.getElementById('chl-ui-theme-select');
    if (select) select.value = selected.id;
    var status = document.getElementById('chl-ui-theme-status');
    if (status) status.textContent = 'Appearance: ' + selected.label;
    window.dispatchEvent(new CustomEvent('chl:ui-theme-change', { detail: { theme: selected.id } }));
  }
  function installContrastRules() {
    if (document.getElementById('chl-contrast-rules')) return;
    var style = document.createElement('style');
    style.id = 'chl-contrast-rules';
    style.textContent = [
      'html[data-chl-style] { --chl-muted:#c5c8d6; }',
      'html[data-chl-style="minimal"] { --chl-muted:#3e4658; }',
      'html[data-chl-style] body { font-weight:500; }',
      'html[data-chl-style] h1,html[data-chl-style] h2,html[data-chl-style] h3,html[data-chl-style] .h1,html[data-chl-style] .h2 { font-weight:850!important; letter-spacing:-.02em; }',
      'html[data-chl-style] button,html[data-chl-style] .btn,html[data-chl-style] label,html[data-chl-style] .chip { font-weight:750!important; }',
      'html[data-chl-style] .sub,html[data-chl-style] .muted,html[data-chl-style] .caption,html[data-chl-style] small { color:var(--chl-muted)!important; }',
      'html[data-chl-style="minimal"] .sub,html[data-chl-style="minimal"] .muted,html[data-chl-style="minimal"] .caption,html[data-chl-style="minimal"] small { color:#3e4658!important; }',
      'html[data-chl-style] :focus-visible { outline:3px solid var(--chl-focus,#2878ff)!important; outline-offset:3px!important; }',
      '@media(prefers-reduced-motion:reduce){html[data-chl-style] *,html[data-chl-style] *::before,html[data-chl-style] *::after{animation:none!important;transition:none!important;scroll-behavior:auto!important}}'
    ].join('\n');
    (document.head || document.documentElement).appendChild(style);
  }
  function setup() {
    if (!document.body || document.getElementById('chl-style-launcher')) return;
    installContrastRules();
    var launcher = document.createElement('aside');
    launcher.id = 'chl-style-launcher'; launcher.className = 'chl-style-launcher';
    launcher.setAttribute('aria-label', 'Appearance settings');
    var toggle = document.createElement('button');
    toggle.type = 'button'; toggle.className = 'chl-style-toggle'; toggle.textContent = '◐ Appearance';
    toggle.setAttribute('aria-expanded', 'false'); toggle.setAttribute('aria-controls', 'chl-style-panel');
    var panel = document.createElement('section');
    panel.id = 'chl-style-panel'; panel.className = 'chl-style-panel'; panel.hidden = true;
    panel.setAttribute('aria-label', 'Choose appearance');
    var label = document.createElement('label'); label.htmlFor = 'chl-ui-theme-select'; label.textContent = 'Choose your visual style';
    var select = document.createElement('select'); select.id = 'chl-ui-theme-select'; select.name = 'theme'; select.className = 'input';
    THEMES.forEach(function (theme) { var option = document.createElement('option'); option.value = theme.id; option.textContent = theme.label; select.appendChild(option); });
    select.addEventListener('change', function () { apply(select.value); });
    var status = document.createElement('p'); status.id = 'chl-ui-theme-status'; status.className = 'chl-style-hint'; status.setAttribute('aria-live', 'polite');
    var hint = document.createElement('p'); hint.className = 'chl-style-hint';
    hint.textContent = 'Appearance is saved on this device. It does not change account data, gifts, prices or permissions.';
    var actions = document.createElement('div'); actions.className = 'chl-style-actions';
    var reset = document.createElement('button'); reset.type = 'button'; reset.className = 'btn'; reset.textContent = 'Reset'; reset.addEventListener('click', function () { apply('dark'); });
    var close = document.createElement('button'); close.type = 'button'; close.className = 'btn'; close.textContent = 'Close';
    close.addEventListener('click', function () { panel.hidden = true; toggle.setAttribute('aria-expanded', 'false'); toggle.focus(); });
    actions.appendChild(reset); actions.appendChild(close); panel.appendChild(label); panel.appendChild(select); panel.appendChild(status); panel.appendChild(hint); panel.appendChild(actions);
    launcher.appendChild(toggle); launcher.appendChild(panel); document.body.appendChild(launcher);
    toggle.addEventListener('click', function () { var opening = panel.hidden; panel.hidden = !opening; toggle.setAttribute('aria-expanded', String(opening)); if (opening) select.focus(); });
    document.addEventListener('keydown', function (event) { if (event.key === 'Escape' && !panel.hidden) { panel.hidden = true; toggle.setAttribute('aria-expanded', 'false'); toggle.focus(); } });
    var saved = 'dark'; try { saved = localStorage.getItem(KEY) || 'dark'; } catch (_) {}
    apply(saved);
  }
  window.CHLStyleSystem = { themes: THEMES.slice(), apply: apply, open: function () { var button = document.querySelector('#chl-style-launcher > button'); if (button) button.click(); } };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', setup, { once: true }); else setup();
})();
