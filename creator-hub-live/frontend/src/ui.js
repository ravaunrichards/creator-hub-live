/* Creator Hub Live \u2014 ui: shell (sidebar + mobile tabbar), reusable components. */
(function(){
  'use strict';
  var CHL = window.CHL; var el = CHL.el, esc = CHL.esc, qs = CHL.qs;
  var ui = CHL.ui = {};

  var NAV = [
    {h:'#/',        ic:'\uD83C\uDFE0', label:'Home',     base:'/'},
    {h:'#/discover',ic:'\uD83D\uDD0D', label:'Discover', base:'/discover'},
    {h:'#/for-you', ic:'\u2728',       label:'For You',  base:'/for-you'},
    {h:'#/create',  ic:'\u2795',       label:'Go LIVE',  base:'/create'},
    {h:'#/messages',ic:'\uD83D\uDCAC', label:'Messages', base:'/messages'},
    {h:'#/notifications',ic:'\uD83D\uDD14',label:'Alerts',base:'/notifications'},
    {h:'#/wallet',  ic:'\uD83D\uDC8E', label:'Wallet',   base:'/wallet'},
    {h:'#/creator', ic:'\uD83C\uDFAC', label:'Creator',  base:'/creator'},
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
    var mtop = el('div',{class:'mtop'},[ logo(),
      el('a',{href:'#/wallet',class:'pill'},[ '\uD83D\uDC8E ', el('span',{id:'mtopCoins',text:'\u2014'}) ]) ]);
    main.appendChild(mtop);
    main.appendChild(el('div',{id:'outlet'}));

    var tab = el('nav',{class:'tabbar'});
    TAB.forEach(function(n){
      tab.appendChild(el('a',{href:n.h,'data-base':n.base},[ el('span',{class:'ic',text:n.ic}), n.label ]));
    });

    var app = el('div',{class:'app'},[side, main]);
    root.appendChild(app);
    root.appendChild(tab);
    root.appendChild(el('div',{id:'giftStage'}));
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

  ui.highlightNav = function(base){
    document.querySelectorAll('.side nav a, .tabbar a').forEach(function(a){
      var nb = a.getAttribute('data-base'); if (!nb){ a.classList.remove('active'); return; }
      var on = nb === '/' ? base === '/' : (base === nb || (base && base.indexOf(nb+'/') === 0) || base === nb);
      a.classList.toggle('active', !!on);
    });
  };

  ui.refreshCoins = function(){
    var c = qs('#mtopCoins');
    if (!c) return;
    if (!CHL.configured || !CHL.user){ c.textContent = '0'; return; }
    CHL.authenticatedApiRequest('/api/wallet/balance')
      .then(function(r){ c.textContent = CHL.fmt((r && r.coin_balance) || 0); })
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
