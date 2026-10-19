/* Creator Hub Live — bridge the switcher to the existing settings route and auth lifecycle. */
(function () {
  'use strict';
  var CHL = window.CHL;
  if (!CHL || !CHL.routes || !CHL.StyleSwitcher || !CHL.ui || !CHL.el) return;
  var el = CHL.el;
  var navItems = [
    ['#/settings/profile', 'Profile'], ['#/settings/security', 'Security'],
    ['#/settings/privacy', 'Privacy'], ['#/settings/blocked', 'Blocked accounts'],
    ['#/settings/notifications', 'Notifications'], ['#/settings/payments', 'Payments'],
    ['#/settings/live', 'LIVE'], ['#/settings/appearance', 'Appearance']
  ];
  function appearanceRoute(outlet) {
    outlet.appendChild(CHL.ui.pageHead('Appearance', 'Choose an individual style or combine compatible style families. Preview and run the style relay before saving.'));
    var nav = el('div', { class: 'row wrap', style: 'gap:8px;margin-bottom:16px' });
    navItems.forEach(function (item) {
      var active = item[0] === '#/settings/appearance';
      nav.appendChild(el('a', { href: item[0], class: 'chip' + (active ? ' on' : '') }, item[1]));
    });
    outlet.appendChild(nav);
    var mount = el('div', { class: 'chl-style-switcher-mount' });
    outlet.appendChild(mount);
    CHL.StyleSwitcher.render(mount);
  }
  // Replace the existing legacy appearance renderer without registering a duplicate route.
  CHL.routes['/settings/appearance'] = appearanceRoute;

  function syncAppearance() {
    if (CHL.StyleSwitcher && typeof CHL.StyleSwitcher.onAuthChanged === 'function') {
      Promise.resolve(CHL.StyleSwitcher.onAuthChanged()).catch(function (error) {
        if (window.console) console.info('[CHL style switcher] account sync unavailable:', error && error.message || error);
      });
    }
  }
  if (typeof CHL.onAuthStateChange === 'function') {
    try { CHL.onAuthStateChange(function () { window.setTimeout(syncAppearance, 0); }); } catch (_) {}
  }
  if (typeof CHL.start === 'function' && !CHL._styleSwitcherStartWrapped) {
    var originalStart = CHL.start;
    CHL.start = function () {
      var result = originalStart.apply(this, arguments);
      Promise.resolve(result).then(function () { window.setTimeout(syncAppearance, 0); }, function () { window.setTimeout(syncAppearance, 0); });
      return result;
    };
    CHL._styleSwitcherStartWrapped = true;
  }
  window.setTimeout(syncAppearance, 0);
})();
