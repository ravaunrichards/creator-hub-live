/* Creator Hub Live style switcher. Additive; no framework and no backend dependency. */
(function () {
  'use strict';
  var KEY = 'chl_visual_style';
  var THEMES = [
    ['default','Creator Hub Live · Default'],['glass','Glassmorphism'],['neumorphic','Neumorphism'],['clay','Claymorphism'],
    ['aurora','Aurora / Mesh Gradient'],['frost','Frost UI'],['minimal','Minimalist UI'],['flat','Flat Design'],
    ['bento','Bento Box Grid'],['neo','Neo-brutalism'],['brutal','Brutalism'],['swiss','Swiss / International Style'],
    ['memphis','Memphis'],['cyber','Cyber UI / Cyberpunk'],['skeuo','Skeuomorphism'],['y2k','Y2K / Retro-futurism'],
    ['pixel','Pixel Art'],['material','Material Design'],['fluent','Fluent Design'],['editorial','Editorial / Typographic'],
    ['high-contrast','High Contrast'],['soft','Soft Rounded'],['dark','Modern Dark'],['light','Modern Light']
  ];
  var aliases = { bento:'minimal', soft:'clay', dark:'default', light:'minimal', 'high-contrast':'brutal' };
  function apply(value) {
    var selected = THEMES.some(function (t) { return t[0] === value; }) ? value : 'default';
    var root = document.documentElement;
    if (selected === 'default') root.removeAttribute('data-chl-style');
    else root.setAttribute('data-chl-style', aliases[selected] || selected);
    root.setAttribute('data-chl-style-choice', selected);
    try { localStorage.setItem(KEY, selected); } catch (_) {}
    var select = document.getElementById('chl-style-select');
    if (select && select.value !== selected) select.value = selected;
    var status = document.getElementById('chl-style-status');
    if (status) status.textContent = 'Current style: ' + (THEMES.find(function (t) { return t[0] === selected; }) || THEMES[0])[1];
    window.dispatchEvent(new CustomEvent('chl:stylechange', { detail: { style: selected, appliedStyle: aliases[selected] || selected } }));
  }
  function addPicker() {
    if (document.getElementById('chl-style-launcher') || !document.body) return;
    var wrap = document.createElement('div'); wrap.id = 'chl-style-launcher';
    var toggle = document.createElement('button'); toggle.type = 'button'; toggle.textContent = '◐ Appearance'; toggle.setAttribute('aria-expanded','false'); toggle.setAttribute('aria-controls','chl-style-panel');
    var panel = document.createElement('section'); panel.id = 'chl-style-panel'; panel.hidden = true; panel.setAttribute('aria-label','Appearance settings');
    var label = document.createElement('label'); label.htmlFor = 'chl-style-select'; label.textContent = 'Choose a visual style';
    var select = document.createElement('select'); select.id = 'chl-style-select'; select.name = 'chl-style-select';
    THEMES.forEach(function (item) { var option = document.createElement('option'); option.value = item[0]; option.textContent = item[1]; select.appendChild(option); });
    select.addEventListener('change', function () { apply(select.value); });
    var status = document.createElement('p'); status.id = 'chl-style-status'; status.className = 'chl-style-hint'; status.setAttribute('aria-live','polite');
    status.textContent = 'Choose a style. Your choice is saved on this device.';
    var hint = document.createElement('p'); hint.className = 'chl-style-hint'; hint.textContent = 'Styles change presentation only; they do not change accounts, gifts, prices, permissions, or backend behavior.';
    var actions = document.createElement('div'); actions.className = 'chl-style-actions';
    var reset = document.createElement('button'); reset.type = 'button'; reset.className = 'btn'; reset.textContent = 'Reset'; reset.addEventListener('click', function () { apply('default'); });
    var close = document.createElement('button'); close.type = 'button'; close.className = 'btn'; close.textContent = 'Close'; close.addEventListener('click', function () { panel.hidden = true; toggle.setAttribute('aria-expanded','false'); toggle.focus(); });
    actions.appendChild(reset); actions.appendChild(close); panel.appendChild(label); panel.appendChild(select); panel.appendChild(status); panel.appendChild(hint); panel.appendChild(actions); wrap.appendChild(toggle); wrap.appendChild(panel); document.body.appendChild(wrap);
    toggle.addEventListener('click', function () { panel.hidden = !panel.hidden; toggle.setAttribute('aria-expanded', String(!panel.hidden)); if (!panel.hidden) select.focus(); });
    document.addEventListener('keydown', function (event) { if (event.key === 'Escape' && !panel.hidden) { panel.hidden = true; toggle.setAttribute('aria-expanded','false'); toggle.focus(); } });
    var saved = 'default'; try { saved = localStorage.getItem(KEY) || 'default'; } catch (_) {}
    apply(saved);
  }
  window.CHLStyleSystem = { themes: THEMES.map(function (x) { return { id:x[0], label:x[1] }; }), apply:apply, open:function () { var b = document.querySelector('#chl-style-launcher > button'); if (b) b.click(); } };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', addPicker, { once:true }); else addPicker();
})();
