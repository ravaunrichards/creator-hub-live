/* Creator Hub Creator Network — Nexus Edition 6.0
 * Experience layer: keeps the existing routes, auth, Supabase and API modules.
 * UI only. It never manufactures members, streams, balances, or engagement totals.
 */
(function () {
  'use strict';
  var CHL = window.CHL;
  if (!CHL || !CHL.el || !CHL.route) return;
  var el = CHL.el;

  var GROUPS = [
    { title: 'Your workspace', links: [
      { path: '/', icon: '⌂', label: 'Overview' },
      { path: '/creator', icon: '◫', label: 'Creator studio' },
      { path: '/compose', icon: '＋', label: 'Create a post' },
      { path: '/create', icon: '◉', label: 'Go LIVE', hot: true }
    ]},
    { title: 'Discover', links: [
      { path: '/discover', icon: '⌕', label: 'Explore LIVE' },
      { path: '/for-you', icon: '✳', label: 'For you' },
      { path: '/following', icon: '♡', label: 'Following' },
      { path: '/search', icon: '⌕', label: 'Find creators' }
    ]},
    { title: 'Community', links: [
      { path: '/messages', icon: '▤', label: 'Messages' },
      { path: '/notifications', icon: '♧', label: 'Notifications' },
      { path: '/battles', icon: '⚔', label: 'Creator battles' },
      { path: '/teams', icon: '♧', label: 'Teams & leagues' }
    ]},
    { title: 'Grow & earn', links: [
      { path: '/creator/analytics', icon: '↗', label: 'Analytics' },
      { path: '/wallet', icon: '◇', label: 'Wallet & gifts' },
      { path: '/gift-rankings', icon: '♕', label: 'Gift rankings' },
      { path: '/hall-of-fame', icon: '✦', label: 'Hall of Fame' },
      { path: '/missions', icon: '◎', label: 'Missions' },
      { path: '/achievements', icon: '✧', label: 'Achievements' }
    ]}
  ];
  var ACCOUNT_LINKS = [
    { path: '/profile', icon: '◉', label: 'My profile' },
    { path: '/settings', icon: '⚙', label: 'Settings' },
    { path: '/help', icon: '?', label: 'Help centre' },
    { path: '/about', icon: 'ⓘ', label: 'About Creator Hub' }
  ];
  var MOBILE = [
    { path: '/', icon: '⌂', label: 'Home' },
    { path: '/discover', icon: '⌕', label: 'Explore' },
    { path: '/create', icon: '◉', label: 'LIVE', live: true },
    { path: '/notifications', icon: '♧', label: 'Inbox' }
  ];
  function allLinks() {
    return GROUPS.reduce(function (acc, g) { return acc.concat(g.links); }, []).concat(ACCOUNT_LINKS);
  }
  function link(n, extra) {
    return el('a', {
      href: '#' + n.path,
      class: 'studio-nav-link' + (n.hot ? ' is-live-link' : '') + (extra ? ' ' + extra : ''),
      'data-base': n.path,
      'aria-label': n.label,
      title: n.label
    }, [el('span', { class: 'studio-nav-icon', 'aria-hidden': 'true', text: n.icon }),
        el('span', { class: 'studio-nav-label', text: n.label }),
        n.path === '/create' ? el('span', { class: 'studio-live-dot', 'aria-hidden': 'true' }) : null]);
  }
  function brand(compact) {
    return el('a', { href: '#/', class: 'studio-brand' + (compact ? ' studio-brand-compact' : '') }, [
      el('img', { src: 'assets/logo.svg', alt: 'Creator Hub Creator Network', width: compact ? '36' : '42', height: compact ? '36' : '42' }),
      compact ? null : el('span', { class: 'studio-brand-copy' }, [
        el('strong', { text: 'CREATOR HUB' }),
        el('small', { text: 'CREATOR NETWORK' })
      ])
    ]);
  }
  function avatarName() {
    return (CHL.profile && (CHL.profile.display_name || CHL.profile.username)) || (CHL.user && CHL.user.email) || 'Your account';
  }
  function avatar(initial = true) {
    var name = avatarName();
    if (CHL.profile && CHL.profile.avatar_url) {
      return el('img', { class: 'studio-avatar', src: CHL.profile.avatar_url, alt: name });
    }
    return el('span', { class: 'studio-avatar studio-avatar-fallback', 'aria-hidden': 'true', text: initial ? CHL.initials(name).slice(0, 2).toUpperCase() : 'CH' });
  }
  function accountCard() {
    if (!CHL.user) return el('div', { class: 'studio-account-card studio-account-guest' }, [
      el('div', { class: 'studio-account-message' }, [el('strong', { text: 'Your creator journey starts here' }), el('span', { text: 'Sign in to manage your profile, community and studio.' })]),
      el('a', { href: '#/login', class: 'studio-signin', text: 'Sign in' }),
      el('a', { href: '#/register', class: 'studio-register', text: 'Create account' })
    ]);
    return el('a', { href: '#/profile', class: 'studio-account-card' }, [avatar(), el('span', { class: 'studio-account-copy' }, [
      el('strong', { text: avatarName() }), el('small', { text: (CHL.profile && CHL.profile.username) ? '@' + CHL.profile.username : 'Open your profile' })
    ]), el('span', { class: 'studio-account-chevron', text: '↗' })]);
  }
  function navGroup(group) {
    return el('div', { class: 'studio-nav-group' }, [el('div', { class: 'studio-nav-heading', text: group.title })].concat(group.links.map(function (n) { return link(n); })));
  }
  function updateNetworkStatus() {
    var node = document.getElementById('studioConnectionStatus');
    if (!node) return;
    var state = CHL.connState || 'connecting';
    node.className = 'studio-status status-' + state;
    var dot = node.querySelector('.studio-status-dot');
    var label = node.querySelector('.studio-status-label');
    if (label) label.textContent = state === 'connected' ? 'Services connected' : state === 'error' ? 'Service connection issue' : state === 'unconfigured' ? 'Setup needed' : 'Checking services';
    if (dot) dot.setAttribute('aria-label', state);
  }
  function closeMore() {
    var sheet = document.getElementById('studioMoreOverlay');
    if (!sheet) return;
    sheet.classList.remove('is-open');
    sheet.setAttribute('aria-hidden', 'true');
    document.body.classList.remove('studio-sheet-open');
    ['studioMoreButton', 'studioTabletMoreButton'].forEach(function (id) { var trigger = document.getElementById(id); if (trigger) trigger.setAttribute('aria-expanded', 'false'); });
  }
  function openMore() {
    var sheet = document.getElementById('studioMoreOverlay');
    if (!sheet) return;
    sheet.classList.add('is-open');
    sheet.setAttribute('aria-hidden', 'false');
    document.body.classList.add('studio-sheet-open');
    ['studioMoreButton', 'studioTabletMoreButton'].forEach(function (id) { var trigger = document.getElementById(id); if (trigger) trigger.setAttribute('aria-expanded', 'true'); });
  }
  function buildMoreSheet() {
    var all = [];
    GROUPS.forEach(function (g) { all.push(el('div', { class: 'studio-sheet-section-title', text: g.title })); g.links.forEach(function (n) { all.push(link(n)); }); });
    all.push(el('div', { class: 'studio-sheet-section-title', text: 'Account & support' }));
    ACCOUNT_LINKS.forEach(function (n) { all.push(link(n)); });
    if (CHL.isAdmin && CHL.isAdmin()) {
      all.push(el('div', { class: 'studio-sheet-section-title', text: 'Administration' }));
      [{path:'/admin',icon:'▣',label:'Admin workspace'},{path:'/admin/community',icon:'✓',label:'Community review'},{path:'/admin/leagues',icon:'♜',label:'League administration'},{path:'/admin/payouts',icon:'$',label:'Payout review'}].forEach(function (n) { all.push(link(n)); });
    }
    return el('div', { id: 'studioMoreOverlay', class: 'studio-more-overlay', 'aria-hidden': 'true' }, [
      el('button', { class: 'studio-more-backdrop', type: 'button', 'aria-label': 'Close navigation', onclick: closeMore }),
      el('section', { class: 'studio-more-sheet', role: 'dialog', 'aria-modal': 'true', 'aria-labelledby': 'studioMoreTitle' }, [
        el('div', { class: 'studio-sheet-grabber' }),
        el('div', { class: 'studio-sheet-top' }, [el('div', {}, [el('small', { text: 'CREATOR HUB' }), el('h2', { id: 'studioMoreTitle', text: 'All destinations' })]), el('button', { class: 'studio-icon-button', type: 'button', 'aria-label': 'Close navigation', onclick: closeMore, text: '×' })]),
        el('div', { class: 'studio-sheet-links' }, all)
      ])
    ]);
  }
  function setSearch() {
    var form = document.getElementById('studioSearchForm');
    if (!form) return;
    form.addEventListener('submit', function (ev) {
      ev.preventDefault();
      var field = form.querySelector('input[name="q"]');
      var q = field ? field.value.trim().slice(0, 80) : '';
      if (!q) { if (field) field.focus(); return; }
      try { sessionStorage.setItem('chcn_studio_pending_search', q); } catch (_) {}
      CHL.navigate('#/search');
    });
  }
  function makeShell(base) {
    var root = document.getElementById('app');
    if (!root) return;
    var authRoute = ['/login', '/register', '/setup', '/forgot-password', '/reset-password', '/oauth'].indexOf(base) !== -1;
    if (authRoute) {
      if (root.querySelector('.studio-app')) { root.className = 'studio-root'; root.innerHTML = ''; }
      if (!root.querySelector('#outlet')) { root.className = 'studio-root'; root.innerHTML = ''; root.appendChild(el('div', { id: 'outlet' })); }
      return;
    }
    // Keep the global shell mounted across route changes; only the outlet content changes.
    if (root.querySelector('.studio-app') && root.querySelector('#outlet')) return;
    root.className = 'studio-root'; root.innerHTML = '';
    var side = el('aside', { class: 'studio-sidebar', 'aria-label': 'Main navigation' }, [
      brand(false),
      el('a', { href: '#/create', class: 'studio-sidebar-cta' }, [el('span', { text: '◉', 'aria-hidden': 'true' }), el('span', { text: 'Start a LIVE' }), el('span', { class: 'studio-cta-arrow', text: '↗' })]),
      el('div', { class: 'studio-sidebar-scroll' }, GROUPS.map(navGroup)),
      el('div', { class: 'studio-sidebar-footer' }, [link({path:'/settings',icon:'⚙',label:'Settings'}), accountCard()])
    ]);
    var search = el('form', { id: 'studioSearchForm', class: 'studio-search', role: 'search' }, [
      el('span', { class: 'studio-search-icon', text: '⌕', 'aria-hidden': 'true' }),
      el('input', { type: 'search', name: 'q', placeholder: 'Search creators, posts, tags…', 'aria-label': 'Search creators, posts and tags', autocomplete: 'off' }),
      el('kbd', { text: '↵', 'aria-hidden': 'true' })
    ]);
    var main = el('main', { class: 'studio-main' }, [
      el('header', { class: 'studio-topbar' }, [
        el('div', { class: 'studio-mobile-brand' }, [brand(true), el('span', { text: 'CREATOR HUB' })]),
        search,
        el('div', { class: 'studio-topbar-actions' }, [
          el('button', { id: 'studioTabletMoreButton', class: 'studio-icon-button studio-tablet-more', type: 'button', 'aria-label': 'Open all pages', 'aria-haspopup': 'dialog', 'aria-controls': 'studioMoreOverlay', 'aria-expanded': 'false', onclick: openMore, text: '☰' }),
          el('div', { id: 'studioConnectionStatus', class: 'studio-status status-connecting', title: 'Backend connection status', role: 'status', 'aria-live': 'polite' }, [el('span', { class: 'studio-status-dot' }), el('span', { class: 'studio-status-label', text: 'Checking services' })]),
          el('a', { class: 'studio-top-action studio-wallet-action', href: '#/wallet', 'aria-label': 'Open wallet', title: 'Wallet' }, [el('span', { text: '◇' }), el('span', { id: 'mtopCoins', text: CHL.user ? '…' : 'Wallet' })]),
          el('a', { class: 'studio-icon-button studio-bell', href: '#/notifications', 'aria-label': 'Notifications', title: 'Notifications' }, '♧'),
          el('a', { class: 'studio-top-live', href: '#/create' }, [el('span', { text: '◉' }), el('span', { text: 'Go LIVE' })])
        ])
      ]),
      el('div', { id: 'outlet', class: 'studio-outlet' })
    ]);
    var mobile = el('nav', { class: 'studio-mobile-nav', 'aria-label': 'Mobile navigation' }, MOBILE.map(function (n) { return link(n, n.live ? 'studio-mobile-live' : ''); }).concat([
      el('button', { id: 'studioMoreButton', class: 'studio-mobile-more', type: 'button', 'aria-haspopup': 'dialog', 'aria-controls': 'studioMoreOverlay', 'aria-expanded': 'false', onclick: openMore }, [el('span', { class: 'studio-nav-icon', text: '•••' }), el('span', { class: 'studio-nav-label', text: 'More' })])
    ]));
    // Keyboard users can jump past the navigation directly to the active route.
    root.appendChild(el('a', { href: '#outlet', class: 'studio-skip-link', text: 'Skip to main content' }));
    root.appendChild(el('div', { class: 'studio-app' }, [side, main]));
    root.appendChild(mobile);
    root.appendChild(buildMoreSheet());
    root.appendChild(el('div', { id: 'giftStage' }));
    setSearch();
    updateNetworkStatus();
    if (CHL.ui && CHL.ui.refreshCoins) CHL.ui.refreshCoins();
    if (CHL.verifyConnection) CHL.verifyConnection().then(updateNetworkStatus).catch(updateNetworkStatus);
    if (!window.__chcnStudioRootClickBound) {
      window.__chcnStudioRootClickBound = true;
      root.addEventListener('click', function (ev) {
        var anchor = ev.target.closest && ev.target.closest('.studio-nav-link, .studio-mobile-nav a');
        if (anchor) closeMore();
      });
    }
    if (!window.__chcnStudioKeysBound) {
      window.__chcnStudioKeysBound = true;
      document.addEventListener('keydown', function (ev) { if (ev.key === 'Escape') closeMore(); });
      window.addEventListener('online', updateNetworkStatus);
      window.addEventListener('offline', updateNetworkStatus);
    }
    // Carry an actual search term from the global header into the existing search handler.

  }
  CHL.mountShell = makeShell;
  CHL.ui.highlightNav = function (base) {
    document.querySelectorAll('.studio-nav-link, .studio-mobile-nav a').forEach(function (a) {
      var path = a.getAttribute('data-base');
      var on = path === '/' ? base === '/' : (path === base || (path && path !== '/' && base.indexOf(path + '/') === 0));
      a.classList.toggle('active', !!on);
      if (on) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current');
    });
    updateNetworkStatus();
  };

  function sectionHeading(kicker, title, description, action) {
    return el('div', { class: 'studio-section-heading' }, [
      el('div', {}, [el('div', { class: 'studio-eyebrow', text: kicker }), el('h2', { text: title }), description ? el('p', { text: description }) : null]),
      action || null
    ]);
  }
  function featureCard(icon, title, detail, href, accent) {
    return el('a', { class: 'studio-feature-card accent-' + accent, href: href }, [
      el('span', { class: 'studio-feature-icon', 'aria-hidden': 'true', text: icon }),
      el('span', { class: 'studio-feature-arrow', 'aria-hidden': 'true', text: '↗' }),
      el('strong', { text: title }), el('p', { text: detail })
    ]);
  }
  function liveCard(room) {
    var title = room.title || 'Creator LIVE';
    var state = String(room.status || '').toLowerCase();
    return el('a', { class: 'studio-live-card', href: '#/live/' + encodeURIComponent(room.id), 'aria-label': 'Open LIVE: ' + title }, [
      el('div', { class: 'studio-live-art', 'aria-hidden': 'true' }, [
        el('span', { class: 'studio-live-orb studio-live-orb-a' }), el('span', { class: 'studio-live-orb studio-live-orb-b' }),
        el('span', { class: 'studio-live-label' }, [el('i', {}), 'LIVE']), el('span', { class: 'studio-live-art-mark', text: 'CH' })
      ]),
      el('div', { class: 'studio-live-card-copy' }, [el('strong', { text: title }), el('span', { text: room.category || 'Creator session' }), el('div', { class: 'studio-live-meta' }, [el('span', { text: 'Open room ↗' }), state === 'live' ? el('span', { class: 'studio-live-viewers', text: room.viewer_count == null ? 'Viewers unavailable' : Number(room.viewer_count).toLocaleString() + ' watching' }) : null])])
    ]);
  }
  function liveSection(outlet) {
    var area = el('div', { class: 'studio-live-grid' }, [el('div', { class: 'studio-live-loading' }, [el('span', { class: 'studio-small-spinner' }), 'Finding live rooms…'])]);
    outlet.appendChild(area);
    if (!CHL.getApiBase || !CHL.getApiBase()) {
      area.innerHTML = '';
      area.appendChild(el('div', { class: 'studio-empty-state' }, [el('span', { class: 'studio-empty-icon', text: '◉' }), el('strong', { text: 'LIVE discovery needs a backend connection' }), el('p', { text: 'Configure the API endpoint to show real streams here. The site will not fill this area with demo creators.' })]));
      return;
    }
    CHL.apiRequest('/api/live/rooms?limit=6', { timeoutMs: 8000 }).then(function (result) {
      var rooms = result && (result.rooms || result.data && result.data.rooms) || [];
      area.innerHTML = '';
      if (!rooms.length) {
        area.appendChild(el('div', { class: 'studio-empty-state' }, [
          el('span', { class: 'studio-empty-icon', text: '◉' }), el('strong', { text: 'The stage is open' }),
          el('p', { text: 'No live rooms are available to show right now. Start a session when you are ready.' }),
          el('a', { class: 'studio-btn studio-btn-soft', href: '#/create', text: 'Prepare a LIVE session' })
        ]));
        return;
      }
      rooms.slice(0, 6).forEach(function (room) { area.appendChild(liveCard(room)); });
    }).catch(function () {
      area.innerHTML = '';
      area.appendChild(el('div', { class: 'studio-empty-state' }, [el('span', { class: 'studio-empty-icon', text: '⌁' }), el('strong', { text: 'LIVE discovery is temporarily unavailable' }), el('p', { text: 'Check your connection and try again. Other Creator Hub areas remain accessible.' }), el('button', { class: 'studio-btn studio-btn-soft', type: 'button', onclick: function () { area.innerHTML = ''; area.appendChild(el('div', { class: 'studio-live-loading' }, [el('span', { class: 'studio-small-spinner' }), 'Trying again…'])); liveSectionRetry(area); }, text: 'Try again' })]));
    });
  }
  function liveSectionRetry(area) {
    CHL.apiRequest('/api/live/rooms?limit=6', { timeoutMs: 8000 }).then(function (result) {
      var rooms = result && (result.rooms || result.data && result.data.rooms) || [];
      area.innerHTML = '';
      if (!rooms.length) { area.appendChild(el('div', { class: 'studio-empty-state' }, [el('strong', { text: 'No live rooms are available right now.' }), el('a', { class: 'studio-btn studio-btn-soft', href: '#/create', text: 'Start a LIVE' })])); return; }
      rooms.slice(0, 6).forEach(function (room) { area.appendChild(liveCard(room)); });
    }).catch(function () { area.innerHTML = ''; area.appendChild(el('div', { class: 'studio-empty-state' }, [el('strong', { text: 'Could not connect to LIVE discovery' }), el('button', { class: 'studio-btn studio-btn-soft', type: 'button', onclick: function () { liveSectionRetry(area); }, text: 'Retry' })])); });
  }
  CHL.routes['/'] = function (outlet) {
    var name = CHL.profile && (CHL.profile.display_name || CHL.profile.username) || '';
    var first = name ? name.split(/[\s@]/)[0] : 'Creator';
    outlet.classList.add('nexus-home');
    var hero = el('section', { class: 'nexus-command-hero' }, [
      el('div', { class: 'nexus-grid-glow', 'aria-hidden': 'true' }),
      el('div', { class: 'nexus-hero-content' }, [
        el('div', { class: 'nexus-overline' }, [el('span', { class: 'nexus-pulse' }), el('span', { text: 'CREATOR OPERATING SYSTEM / JAMAICA' }), el('span', { class: 'nexus-version', text: 'NEXUS 06' })]),
        el('h1', {}, ['Your world. ', el('span', { text: 'Your signal.' })]),
        el('p', { text: 'Welcome to your creator command centre, ' + first + '. Build your presence, activate your community and launch your next moment from one connected workspace.' }),
        el('div', { class: 'nexus-hero-actions' }, [
          el('a', { class: 'nexus-primary-action', href: '#/create' }, [el('span', { text: '◉' }), el('span', { text: 'Launch LIVE' }), el('span', { class: 'nexus-action-arrow', text: '↗' })]),
          el('a', { class: 'nexus-secondary-action', href: '#/creator' }, ['Open Creator Studio ', el('span', { text: '→' })])
        ]),
        el('div', { class: 'nexus-signal-row' }, [
          el('span', { class: 'nexus-signal-mark', text: '⌁' }),
          el('span', { text: 'Your connected tools, community and creator journey in one place.' })
        ])
      ]),
      el('div', { class: 'nexus-orbit-stage', 'aria-hidden': 'true' }, [
        el('div', { class: 'nexus-orbit orbit-outer' }), el('div', { class: 'nexus-orbit orbit-middle' }), el('div', { class: 'nexus-orbit orbit-inner' }),
        el('div', { class: 'nexus-core' }, [el('span', { text: 'CH' }), el('small', { text: 'NETWORK CORE' })]),
        el('span', { class: 'nexus-node node-a', text: 'CREATE' }), el('span', { class: 'nexus-node node-b', text: 'CONNECT' }), el('span', { class: 'nexus-node node-c', text: 'GROW' }),
        el('span', { class: 'nexus-coordinate coordinate-a', text: '17°59′N / 76°57′W' }), el('span', { class: 'nexus-coordinate coordinate-b', text: 'SIGNAL: READY' })
      ])
    ]);
    outlet.appendChild(hero);
    outlet.appendChild(el('section', { class: 'nexus-launchpad' }, [
      el('div', { class: 'nexus-section-head' }, [el('div', {}, [el('span', { class: 'nexus-label', text: 'QUICK DEPLOY' }), el('h2', { text: 'Choose your next move' })]), el('span', { class: 'nexus-section-index', text: '01 — 04' })]),
      el('div', { class: 'nexus-action-grid' }, [
        featureCard('◉', 'Go LIVE', 'Launch a room and connect with your audience.', '#/create', 'coral'),
        featureCard('✦', 'Publish', 'Turn an idea into a post for your network.', '#/compose', 'blue'),
        featureCard('⌘', 'Creator Studio', 'Open your creator tools and workspace.', '#/creator', 'lime'),
        featureCard('◇', 'Wallet & gifts', 'Access your available wallet features.', '#/wallet', 'gold')
      ])
    ]));
    outlet.appendChild(el('section', { class: 'nexus-network-zone' }, [
      el('div', { class: 'nexus-section-head' }, [el('div', {}, [el('span', { class: 'nexus-label', text: 'LIVE NETWORK FEED' }), el('h2', { text: 'Across the network' }), el('p', { text: 'Live rooms from connected services. No sample streams or invented viewer counts.' })]), el('a', { class: 'nexus-outline-link', href: '#/discover' }, ['Explore network ', el('span', { text: '↗' })])])
    ]));
    liveSection(outlet);
    outlet.appendChild(el('section', { class: 'nexus-mission-panel' }, [
      el('div', { class: 'nexus-mission-copy' }, [el('span', { class: 'nexus-label', text: 'YOUR NEXT LEVEL' }), el('h2', { text: 'Small moves. Lasting momentum.' }), el('p', { text: 'Choose a deliberate next step. Build a reliable publishing rhythm, collaborate with creators and use your tools to improve over time.' }), el('a', { class: 'nexus-primary-action nexus-primary-compact', href: '#/missions' }, ['View creator missions ', el('span', { text: '↗' })])]),
      el('div', { class: 'nexus-mission-stack' }, [
        el('a', { href: '#/missions', class: 'nexus-mission-item' }, [el('span', { class: 'nexus-mission-code', text: 'M-01' }), el('span', {}, [el('strong', { text: 'Set your direction' }), el('small', { text: 'Choose a goal that fits your creator journey.' })]), el('span', { class: 'nexus-mission-arrow', text: '↗' })]),
        el('a', { href: '#/battles', class: 'nexus-mission-item' }, [el('span', { class: 'nexus-mission-code', text: 'M-02' }), el('span', {}, [el('strong', { text: 'Create together' }), el('small', { text: 'Explore creator battles and collaborations.' })]), el('span', { class: 'nexus-mission-arrow', text: '↗' })]),
        el('a', { href: '#/teams', class: 'nexus-mission-item' }, [el('span', { class: 'nexus-mission-code', text: 'M-03' }), el('span', {}, [el('strong', { text: 'Find your network' }), el('small', { text: 'Discover teams and league tools.' })]), el('span', { class: 'nexus-mission-arrow', text: '↗' })])
      ])
    ]));
    outlet.appendChild(el('footer', { class: 'nexus-footer' }, [brand(true), el('span', { text: 'CREATOR HUB CREATOR NETWORK · BUILT FOR WHAT’S NEXT' }), el('div', { class: 'studio-footer-links' }, [el('a', { href: '#/help', text: 'Help' }), el('a', { href: '#/community-guidelines', text: 'Guidelines' }), el('a', { href: '#/privacy', text: 'Privacy' })]) ]));
  };

  // The existing search route consumes a global-header query after it creates its real search form.
  CHL.consumeStudioSearch = function () {
    try { var value = sessionStorage.getItem('chcn_studio_pending_search'); sessionStorage.removeItem('chcn_studio_pending_search'); return value || ''; } catch (_) { return ''; }
  };

  // Mark this experience so the release checks can verify it loaded.
  document.documentElement.dataset.chcnEdition = 'nexus-6.0.2';
})();
