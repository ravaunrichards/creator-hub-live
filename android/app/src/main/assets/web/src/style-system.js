/* Creator Hub Live — lightweight, persistent cross-platform appearance selector. */
(function () {
  'use strict';
  var KEY = 'chl_ui_theme';
  var THEMES = [
    { id: 'dark', label: 'Creator Hub Live · Dark' },
    { id: 'light', label: 'Clean Light' },
    { id: 'aurora', label: 'Aurora Night' }
  ];
  function isTheme(id) { return THEMES.some(function (x) { return x.id === id; }); }
  function apply(id) {
    var selected = isTheme(id) ? id : 'dark';
    var root = document.documentElement;
    if (selected === 'dark') root.removeAttribute('data-chl-theme');
    else root.setAttribute('data-chl-theme', selected);
    try { localStorage.setItem(KEY, selected); } catch (_) {}
    var select = document.getElementById('chl-ui-theme-select');
    if (select) select.value = selected;
    var status = document.getElementById('chl-ui-theme-status');
    if (status) status.textContent = 'Appearance: ' + THEMES.filter(function (x) { return x.id === selected; })[0].label;
    window.dispatchEvent(new CustomEvent('chl:ui-theme-change', { detail: { theme: selected } }));
  }
  function setup() {
    if (!document.body || document.getElementById('chl-style-launcher')) return;
    var launcher = document.createElement('aside');
    launcher.id = 'chl-style-launcher';
    launcher.className = 'chl-style-launcher';
    launcher.setAttribute('aria-label', 'Appearance settings');
    var toggle = document.createElement('button');
    toggle.type = 'button';
    toggle.className = 'chl-style-toggle';
    toggle.textContent = '◐ Appearance';
    toggle.setAttribute('aria-expanded', 'false');
    toggle.setAttribute('aria-controls', 'chl-style-panel');
    var panel = document.createElement('section');
    panel.id = 'chl-style-panel';
    panel.className = 'chl-style-panel';
    panel.hidden = true;
    panel.setAttribute('aria-label', 'Choose appearance');
    var label = document.createElement('label');
    label.htmlFor = 'chl-ui-theme-select';
    label.textContent = 'Choose your visual style';
    var select = document.createElement('select');
    select.id = 'chl-ui-theme-select';
    select.name = 'theme';
    select.className = 'input';
    THEMES.forEach(function (theme) {
      var option = document.createElement('option');
      option.value = theme.id;
      option.textContent = theme.label;
      select.appendChild(option);
    });
    select.addEventListener('change', function () { apply(select.value); });
    var status = document.createElement('p');
    status.id = 'chl-ui-theme-status';
    status.className = 'chl-style-hint';
    status.setAttribute('aria-live', 'polite');
    var hint = document.createElement('p');
    hint.className = 'chl-style-hint';
    hint.textContent = 'Appearance changes are saved on this device. They do not change account data, gifts, prices or permissions.';
    var actions = document.createElement('div');
    actions.className = 'chl-style-actions';
    var reset = document.createElement('button');
    reset.type = 'button'; reset.className = 'btn'; reset.textContent = 'Reset';
    reset.addEventListener('click', function () { apply('dark'); });
    var close = document.createElement('button');
    close.type = 'button'; close.className = 'btn'; close.textContent = 'Close';
    close.addEventListener('click', function () { panel.hidden = true; toggle.setAttribute('aria-expanded', 'false'); toggle.focus(); });
    actions.appendChild(reset); actions.appendChild(close);
    panel.appendChild(label); panel.appendChild(select); panel.appendChild(status); panel.appendChild(hint); panel.appendChild(actions);
    launcher.appendChild(toggle); launcher.appendChild(panel); document.body.appendChild(launcher);
    toggle.addEventListener('click', function () {
      var opening = panel.hidden;
      panel.hidden = !opening;
      toggle.setAttribute('aria-expanded', String(opening));
      if (opening) select.focus();
    });
    document.addEventListener('keydown', function (event) {
      if (event.key === 'Escape' && !panel.hidden) { panel.hidden = true; toggle.setAttribute('aria-expanded', 'false'); toggle.focus(); }
    });
    var saved = 'dark'; try { saved = localStorage.getItem(KEY) || 'dark'; } catch (_) {}
    apply(saved);
  }
  window.CHLStyleSystem = {
    themes: THEMES.slice(),
    apply: apply,
    open: function () { var button = document.querySelector('#chl-style-launcher > button'); if (button) button.click(); }
  };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', setup, { once: true });
  else setup();
})();
