/* Creator Hub Live \u2014 ui: shell (sidebar + mobile tabbar), reusable components. */
(function(){
  'use strict';
  var CHL = window.CHL; var el = CHL.el, esc = CHL.esc, qs = CHL.qs;
  var ui = CHL.ui = {};
  var mobileMenuPanel = null;
  var mobileMenuBackdrop = null;
  var mobileMenuTrigger = null;

  var NAV = [
    {h:'#/',        ic:'\uD83C\uDFE0', label:'Home',     base:'/'},
    {h:'#/discover',ic:'\uD83D\uDD0D', label:'Discover', base:'/discover'},
    {h:'#/for-you', ic:'\u2728',       label:'For You',  base:'/for-you'},
    {h:'#/following', ic:'\uD83D\uDC65', label:'Following', base:'/following'},
    {h:'#/saved', ic:'\uD83D\uDD16', label:'Saved', base:'/saved'},
    {h:'#/create',  ic:'\u2795',       label:'Go LIVE',  base:'/create'},
    {h:'#/messages',ic:'\uD83D\uDCAC', label:'Messages', base:'/messages'},
    {h:'#/notifications',ic:'\uD83D\uDD14',label:'Alerts',base:'/notifications'},
    {h:'#/wallet',  ic:'\uD83D\uDC8E', label:'Wallet',   base:'/wallet'},
    {h:'#/creator', ic:'\uD83C\uDFAC', label:'Creator',  base:'/creator'},
    {h:'#/creator/achievements', ic:'\uD83C\uDFC5', label:'Achievements', base:'/creator/achievements'},
    {h:'#/teams',   ic:'\uD83D\uDEE1\uFE0F', label:'Teams', base:'/teams'},
    {h:'#/leagues', ic:'\uD83C\uDFC6', label:'Leagues',  base:'/leagues'},
    {h:'#/profile', ic:'\uD83D\uDC64', label:'Profile',  base:'/profile'}
  ];
  // compact nav for the mobile bottom tab bar
  var TAB = [
    {h:'#/',        ic:'\uD83C\uDFE0', label:'Home',     base:'/'},
    {h:'#/discover',ic:'\uD83D\uDD0D', label:'Discover', base:'/discover'},
    {h:'#/create',  ic:'\u2795',       label:'Go LIVE',  base:'/create'},
    {h:'#/notifications',ic:'\uD83D\uDD14',label:'Inbox',base:'/notifications'},
    {h:'#/profile', ic:'\uD83D\uDC64', label:'Profile',  base:'/profile'}
  ];

  function logo(){
    return el('a',{href:'#/',class:'logo'},[ el('img',{src:'assets/logo.svg',alt:CHL.brand,height:'40'}) ]);
  }

  CHL.mountShell = function(base){
    var root = qs('#app');
    // auth pages render full-screen without the shell
    if (base === '/login' || base === '/register' || base === '/setup'){
      root.className = '';
      root.innerHTML = '';
      root.appendChild(el('div',{id:'outlet'}));
      return;
    }
    if (qs('.app') && qs('#outlet')) return; // shell already mounted
    root.className = '';
    root.innerHTML = '';
    var side = el('aside',{class:'side'});
    side.appendChild(logo());
    var nav = el('nav');
    NAV.forEach(function(n){
      nav.appendChild(el('a',{href:n.h,'data-base':n.base},[ el('span',{class:'ic',text:n.ic}), n.label ]));
    });
    side.appendChild(nav);
    // admin link only for admins
    if (CHL.isAdmin && CHL.isAdmin()){
      nav.appendChild(el('a',{href:'#/admin','data-base':'/admin'},[ el('span',{class:'ic',text:'\uD83D\uDD12'}), 'Admin' ]));
    }
    side.appendChild(el('div',{class:'spacer'}));
    side.appendChild(meBox());

    var main = el('main',{class:'main'});
    // mobile top bar
    mobileMenuTrigger = el('button',{class:'btn chl-mobile-menu-trigger',type:'button','aria-controls':'chlMobileMenu','aria-expanded':'false','aria-label':'Open all navigation links'},'☰ Menu');
    var mobileTopActions = el('div',{class:'row chl-mobile-top-actions',style:'display:flex;align-items:center;gap:8px'},[
      el('a',{href:'#/wallet',class:'pill'},[ '\uD83D\uDC8E ', el('span',{id:'mtopCoins',text:'\u2014'}) ]),
      mobileMenuTrigger
    ]);
    var mtop = el('div',{class:'mtop'},[ logo(), mobileTopActions ]);
    main.appendChild(mtop);
    main.appendChild(el('div',{id:'outlet'}));

    var tab = el('nav',{class:'tabbar'});
    TAB.forEach(function(n){
      tab.appendChild(el('a',{href:n.h,'data-base':n.base},[ el('span',{class:'ic',text:n.ic}), n.label ]));
    });

    var app = el('div',{class:'app'},[side, main]);
    root.appendChild(app);
    root.appendChild(tab);
    mobileMenuBackdrop = el('button',{class:'chl-mobile-menu-backdrop',type:'button','aria-label':'Close navigation menu',tabindex:'-1'});
    mobileMenuBackdrop.style.display = 'none';
    mobileMenuPanel = el('nav',{class:'chl-mobile-menu',id:'chlMobileMenu','aria-label':'All navigation links','aria-hidden':'true',style:'display:none'});
    mobileMenuPanel.appendChild(el('div',{class:'chl-mobile-menu-heading'},[
      el('strong',{text:'Navigate'}),
      el('button',{class:'btn',type:'button',text:'Close',onclick:function(){ui.closeMobileMenu(true);}})
    ]));
    var mobileMenuLinks = el('div',{class:'chl-mobile-menu-links'});
    NAV.forEach(function(n){
      mobileMenuLinks.appendChild(el('a',{href:n.h,'data-base':n.base},[el('span',{class:'ic',text:n.ic}),el('span',{text:n.label})]));
    });
    mobileMenuLinks.appendChild(el('a',{href:'#/settings','data-base':'/settings'},[el('span',{class:'ic',text:'⚙️'}),el('span',{text:'Settings'})]));
    if (CHL.isAdmin && CHL.isAdmin()) mobileMenuLinks.appendChild(el('a',{href:'#/admin','data-base':'/admin'},[el('span',{class:'ic',text:'🔒'}),el('span',{text:'Admin'})]));
    mobileMenuPanel.appendChild(mobileMenuLinks);
    root.appendChild(mobileMenuBackdrop);
    root.appendChild(mobileMenuPanel);
    root.appendChild(el('div',{id:'giftStage'}));
    mobileMenuTrigger.addEventListener('click',function(){
      var isOpen = mobileMenuTrigger.getAttribute('aria-expanded') === 'true';
      if (isOpen) ui.closeMobileMenu(true); else ui.openMobileMenu();
    });
    mobileMenuBackdrop.addEventListener('click',function(){ui.closeMobileMenu(true);});
    mobileMenuPanel.addEventListener('click',function(event){
      var link = event.target && event.target.closest ? event.target.closest('a[href]') : null;
      if (link) ui.closeMobileMenu(false);
    });
    if (!CHL._mobileMenuKeyboardBound) {
      CHL._mobileMenuKeyboardBound = true;
      document.addEventListener('keydown',function(event){if(event.key==='Escape' && mobileMenuPanel && mobileMenuPanel.style.display!=='none')ui.closeMobileMenu(true);});
      window.addEventListener('hashchange',function(){if(mobileMenuPanel && mobileMenuPanel.style.display!=='none')ui.closeMobileMenu(false);});
    }
    ui.refreshCoins();
  };

  function meBox(){
    if (CHL.user){
      var name = (CHL.profile && (CHL.profile.display_name || CHL.profile.username)) || CHL.user.email || 'You';
      return el('a',{href:'#/profile',class:'me'},[
        el('div',{class:'tile',style:'width:34px;height:34px;border-radius:50%;display:flex;align-items:center;justify-content:center;background:linear-gradient(135deg,var(--brand),var(--brand2));color:#fff;font-weight:800;overflow:hidden'},CHL.initials(name).toUpperCase()),
        el('div',{style:'min-width:0'},[ el('div',{style:'font-weight:700;white-space:nowrap;overflow:hidden;text-overflow:ellipsis',text:name}), el('div',{style:'color:var(--mut);font-size:11px',text:'View profile'}) ])
      ]);
    }
    return el('a',{href:'#/login',class:'btn primary block'},'Log in / Sign up');
  }

  ui.openMobileMenu = function(){
    if (!mobileMenuPanel || !mobileMenuBackdrop || !mobileMenuTrigger) return;
    mobileMenuPanel.style.display = 'block';
    mobileMenuBackdrop.style.display = 'block';
    mobileMenuPanel.setAttribute('aria-hidden','false');
    mobileMenuTrigger.setAttribute('aria-expanded','true');
    mobileMenuTrigger.setAttribute('aria-label','Close all navigation links');
    var firstLink = mobileMenuPanel.querySelector('a[href]');
    if (firstLink) firstLink.focus();
  };
  ui.closeMobileMenu = function(refocus){
    if (!mobileMenuPanel || !mobileMenuBackdrop || !mobileMenuTrigger) return;
    mobileMenuPanel.style.display = 'none';
    mobileMenuBackdrop.style.display = 'none';
    mobileMenuPanel.setAttribute('aria-hidden','true');
    mobileMenuTrigger.setAttribute('aria-expanded','false');
    mobileMenuTrigger.setAttribute('aria-label','Open all navigation links');
    if (refocus) mobileMenuTrigger.focus();
  };

  ui.highlightNav = function(base){
    var main = qs('.main');
    if (main) main.classList.toggle('chl-has-live-room', !!base && (base === '/live' || base.indexOf('/live/') === 0));
    document.querySelectorAll('.side nav a, .tabbar a, .chl-mobile-menu a').forEach(function(a){
      var nb = a.getAttribute('data-base'); if (!nb){ a.classList.remove('active'); return; }
      var on = nb === '/' ? base === '/' : (base === nb || (base && base.indexOf(nb+'/') === 0) || base === nb);
      a.classList.toggle('active', !!on);
    });
  };

  ui.refreshCoins = function(){
    var c = qs('#mtopCoins');
    if (!c) return;
    if (!CHL.configured || !CHL.user){ c.textContent = '0'; return; }
    CHL.authenticatedApiRequest('/api/wallet')
      .then(function(r){ c.textContent = CHL.fmt((r && r.coinBalance) || 0); })
      .catch(function(){ c.textContent = '—'; });
  };

  /* ---- form field helper (used by auth + settings forms) ---- */
  ui.field = CHL._field = function(label, name, placeholder, type){
    return el('label',{class:'field',style:'display:block;margin-bottom:12px'},[
      el('span',{class:'field-label',style:'display:block;font-size:13px;margin-bottom:6px;color:var(--mut)',text:label}),
      el('input',{class:'input',name:name,type:type||'text',placeholder:placeholder||'',autocomplete:(type==='password'?'current-password':(type==='email'?'email':'off'))})
    ]);
  };

  /* ---- components ---- */
  ui.pageHead = function(title, sub){
    return el('div',{},[ el('div',{class:'h1',text:title}), sub ? el('p',{class:'sub',text:sub}) : null ]);
  };
  ui.spinner = function(){ return el('div',{class:'spin'}); };
  ui.empty = function(icon, title, msg, action){
    var box = el('div',{class:'empty'},[ el('div',{class:'ic',text:icon}), el('h3',{text:title}), el('p',{text:msg}) ]);
    if (action) box.appendChild(action);
    return box;
  };
  ui.setupNotice = function(){
    // Connection-aware banner. Only the genuinely-unconfigured state tells the
    // user to create config.js; a real backend failure shows the actual error;
    // a confirmed connection shows nothing (the page will load real data).
    var st = CHL.connState;
    if (st === 'connected') return null;
    if (st === 'connecting'){
      return el('div',{class:'note'},[ CHL.ui.spinner(), ' Connecting to Supabase\u2026 ' ]);
    }
    if (st === 'error'){
      return el('div',{class:'note',html:'<b>Backend connection failed.</b> '+
        CHL.esc(CHL.connError || 'Supabase is configured but could not be reached.')+
        ' No fake data is ever shown.'});
    }
    // 'unconfigured' (default): no real keys in config.js yet.
    return el('div',{class:'note',html:'<b>Creator Hub backend is not available yet.</b> This static UI is live, but to show real data copy <code>config.example.js</code> to <code>config.js</code> and add your Supabase URL + anon key. No fake data is ever shown.'});
  };

  // Called after the real connection probe resolves so banners reflect the
  // confirmed state without a full navigation.
  ui.refreshBanner = function(){ if (CHL.render) CHL.render(); };

  ui.liveTile = function(s){
    var name = s.title || 'Untitled stream';
    var host = (s.host && (s.host.display_name || s.host.username)) || 'Creator';
    var tile = el('div',{class:'tile',onclick:function(){ CHL.navigate('#/live/'+s.id); }},[
      el('div',{class:'thumb'},[
        el('div',{class:'badge'},[ el('span',{class:'dot'}), 'LIVE' ]),
        el('div',{class:'viewers',text:'\uD83D\uDC41 '+CHL.fmt(s.viewer_count||0)}),
        el('div',{class:'ava',text:CHL.initials(host).toUpperCase()})
      ]),
      el('div',{class:'meta'},[ el('div',{class:'t',text:name}), el('div',{class:'u',text:'@'+((s.host&&s.host.username)||'creator')}) ])
    ]);
    return tile;
  };

  ui.statCard = function(value, label){
    return el('div',{class:'card'},[ el('div',{class:'stat-v',text:value}), el('div',{class:'stat-l',text:label}) ]);
  };

  // gift fly animation (visual only)
  ui.flyGift = function(emoji){
    var stage = qs('#giftStage'); if (!stage) return;
    var g = el('div',{class:'flyGift',text:emoji});
    g.style.left = (35 + Math.random()*30) + '%';
    stage.appendChild(g);
    setTimeout(function(){ if (g.parentNode) g.parentNode.removeChild(g); }, 2300);
  };
})();
