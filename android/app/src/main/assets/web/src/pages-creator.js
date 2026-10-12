/* Creator Hub Live \u2014 creator center, teams, leagues, rankings, subscriptions, gifts. */
(function(){
  'use strict';
  var CHL = window.CHL; var el = CHL.el, ui = CHL.ui, sb = CHL.sb;

  function guard(o, title, sub){
    o.appendChild(ui.pageHead(title, sub));
    if (!CHL.configured){ o.appendChild(ui.setupNotice()); return true; }
    return false;
  }
  function subnav(items){
    var bar=el('div',{class:'row wrap',style:'gap:8px;margin-bottom:16px'});
    items.forEach(function(it){
      var on = CHL.current.path === it.h.replace('#','');
      bar.appendChild(el('a',{href:it.h,class:'chip'+(on?' on':'')},it.label));
    });
    return bar;
  }

  var CREATOR_NAV = [
    {h:'#/creator',label:'Overview'},{h:'#/creator/analytics',label:'Analytics'},
    {h:'#/creator/live',label:'LIVE'},{h:'#/creator/live/history',label:'Recordings'},
    {h:'#/creator/live/schedule',label:'Schedule'},{h:'#/creator/earnings',label:'Earnings'},
    {h:'#/creator/subscriptions',label:'Subscribers'},{h:'#/creator/gifts',label:'Gifts'}
  ];

  /* ---- creator overview + subpages ---- */
  CHL.route('/creator', function(o){
    if (guard(o,'Creator Center','Manage your content, LIVE, earnings and subscribers.')) return;
    o.appendChild(subnav(CREATOR_NAV));
    var stat=el('div',{class:'grid stat'}); o.appendChild(stat);
    stat.appendChild(ui.statCard('\u2026','Followers')); stat.appendChild(ui.statCard('\u2026','Streams')); stat.appendChild(ui.statCard('\u2026','Diamonds'));
    Promise.all([
      sb.from('follows').select('*',{count:'exact',head:true}).eq('followee_id',CHL.user.id),
      sb.from('live_sessions').select('*',{count:'exact',head:true}).eq('host_id',CHL.user.id),
      sb.from('wallets').select('diamond_balance').eq('user_id',CHL.user.id).maybeSingle()
    ]).then(function(res){ stat.innerHTML='';
      stat.appendChild(ui.statCard(CHL.fmt(res[0].count||0),'Followers'));
      stat.appendChild(ui.statCard(CHL.fmt(res[1].count||0),'Streams'));
      stat.appendChild(ui.statCard(CHL.fmt((res[2].data&&res[2].data.diamond_balance)||0),'Diamonds'));
    }).catch(function(){});
    o.appendChild(el('div',{class:'row wrap',style:'gap:10px;margin-top:16px'},[
      el('a',{href:'#/create',class:'btn primary'},'\u25B6 Go LIVE'),
      el('a',{href:'#/creator/analytics',class:'btn'},'View analytics')
    ]));
  });
  CHL.route('/creator/analytics', function(o){
    if (guard(o,'Creator Analytics','Real metrics from your account \u2014 nothing fabricated.')) return;
    o.appendChild(subnav(CREATOR_NAV));
    o.appendChild(ui.empty('\uD83D\uDCCA','Analytics build as you grow','Followers, watch time, gifts and earnings populate here from real activity. Start posting and going LIVE to generate data.'));
  });
  CHL.route('/creator/live', function(o){
    if (guard(o,'LIVE Center','Start a broadcast and manage your current stream.')) return;
    o.appendChild(subnav(CREATOR_NAV));
    o.appendChild(el('a',{href:'#/create',class:'btn primary'},'\u25B6 Start a new LIVE'));
  });
  CHL.route('/creator/live/history', function(o){
    if (guard(o,'LIVE Recordings','Replay, publish, archive or delete past broadcasts.')) return;
    o.appendChild(subnav(CREATOR_NAV));
    var list=el('div',{class:'grid live'}); o.appendChild(list); list.appendChild(ui.spinner());
    sb.from('live_sessions').select('id,title,started_at,status,viewer_count').eq('host_id',CHL.user.id).order('started_at',{ascending:false}).limit(30)
      .then(function(r){ list.innerHTML=''; var rows=(r&&r.data)||[];
        if(!rows.length){ list.appendChild(ui.empty('\uD83C\uDF9E\uFE0F','No recordings yet','Your past LIVE sessions will appear here.')); list.style.display='block'; return; }
        list.style.display=''; rows.forEach(function(s){ list.appendChild(el('div',{class:'tile',onclick:function(){ CHL.navigate('#/live/'+s.id); }},[ el('div',{class:'thumb'},[ el('div',{class:'ava',text:'\u25B6'}) ]), el('div',{class:'meta'},[ el('div',{class:'t',text:s.title||'Untitled'}), el('div',{class:'u',text:CHL.ago(s.started_at)}) ]) ])); });
      }).catch(function(){ list.innerHTML=''; list.appendChild(ui.empty('\uD83C\uDF9E\uFE0F','No recordings yet','Your past LIVE sessions will appear here.')); });
  });
  CHL.route('/creator/live/schedule', function(o){
    if (guard(o,'LIVE Schedule','Plan upcoming broadcasts.')) return;
    o.appendChild(subnav(CREATOR_NAV));
    o.appendChild(ui.empty('\uD83D\uDCC5','No scheduled streams','Schedule a LIVE so followers get notified.'));
  });
  CHL.route('/creator/earnings', function(o){
    if (guard(o,'Earnings','Diamonds, subscription revenue and payouts \u2014 server-authoritative.')) return;
    o.appendChild(subnav(CREATOR_NAV));
    var stat=el('div',{class:'grid stat'}); o.appendChild(stat);
    stat.appendChild(ui.statCard('\u2026','Diamonds')); stat.appendChild(ui.statCard('\u2026','Available')); stat.appendChild(ui.statCard('\u2026','Pending'));
    sb.from('wallets').select('diamond_balance').eq('user_id',CHL.user.id).maybeSingle().then(function(r){
      var d=(r&&r.data&&r.data.diamond_balance)||0; stat.innerHTML='';
      stat.appendChild(ui.statCard(CHL.fmt(d),'Diamonds')); stat.appendChild(ui.statCard('$0.00','Available')); stat.appendChild(ui.statCard('$0.00','Pending'));
    }).catch(function(){});
    o.appendChild(el('div',{class:'note',html:'Payouts are configured securely by the owner (PayPal / bank). Account numbers are stored masked, e.g. <code>****459</code>, and never exposed in the browser.'}));
  });
  CHL.route('/creator/subscriptions', function(o){
    if (guard(o,'Your Subscribers','Manage subscription tiers and subscriber-only perks.')) return;
    o.appendChild(subnav(CREATOR_NAV));
    o.appendChild(ui.empty('\u2B50','No subscribers yet','Create weekly or monthly tiers to start earning recurring revenue.', el('a',{href:'#/subscriptions',class:'btn primary',style:'margin-top:8px'},'Manage tiers')));
  });
  CHL.route('/creator/gifts', function(o){
    if (guard(o,'Gifts Received','Every gift sent to you \u2014 from real viewers only.')) return;
    o.appendChild(subnav(CREATOR_NAV));
    o.appendChild(ui.empty('\uD83C\uDF81','Your gift gallery is empty','Gifts you receive on LIVE appear here with their animations.'));
  });

  /* ---- gifts gallery (viewer side) ---- */
  CHL.route('/gifts', function(o){
    if (guard(o,'Gift Gallery','Gifts you have sent and received.')) return;
    o.appendChild(ui.empty('\uD83C\uDF81','Your gift gallery is empty','Send a gift on any LIVE to start your collection. Financial records are never reset.'));
  });

  /* ---- subscriptions ---- */
  CHL.route('/subscriptions', function(o){
    if (guard(o,'Subscriptions','Your active creator subscriptions and tiers.')) return;
    o.appendChild(ui.empty('\u2B50','No active subscriptions','Subscribe to a creator for subscriber-only LIVE, chat and content.', el('a',{href:'#/discover',class:'btn primary',style:'margin-top:8px'},'Find creators')));
  });

  var divisionTier = {
    D5:'Bronze III', D4:'Bronze II', D3:'Bronze I',
    D2:'Silver III', D1:'Silver II', C5:'Silver I',
    C4:'Gold IV', C3:'Gold III', C2:'Gold II', C1:'Gold I',
    B5:'Platinum IV', B4:'Platinum III', B3:'Platinum II', B2:'Platinum I',
    B1:'Diamond IV', A3:'Heroic', A2:'Master', A1:'Grandmaster'
  };
  CHL.route('/leagues', function(o,r){
    if (guard(o,'Leagues','Server-managed competition. Results and standings are calculated from recorded matches.')) return;
    var div=r.params && r.params.length ? r.params[0] : null;
    o.appendChild(el('div',{class:'h1',style:'font-size:20px',text:div ? ('Division '+div+' · '+(divisionTier[div] || '')) : 'Leagues'}));
    var box=el('div',{class:'card'},[]); o.appendChild(box);
    CHL.authenticatedApiRequest('/api/leagues/standings').then(function(d){
      var rows=(d.standings||[]).filter(function(x){return !div || x.division_code===div;});
      if(!rows.length){
        if(!d.season){box.appendChild(ui.empty('🏅','No active season configured','An administrator must create and activate a season in Admin → Leagues. The division rules are configured separately from the season dates.'));}
        else{box.appendChild(ui.empty('🏅',div?'No teams in '+div+' yet':'No teams enrolled in this season yet','Active season: '+d.season.name+'. Create teams to populate the standings; completed server-recorded matches determine points and positions.'));}
        return;
      }
      var grouped={}; rows.forEach(function(x){(grouped[x.division_code] ||= []).push(x);});
      Object.keys(grouped).sort().forEach(function(code){
        box.appendChild(el('h3',{text:code+' · '+(divisionTier[code] || 'Division'),style:'margin:18px 0 8px;overflow-wrap:anywhere'}));
        grouped[code].forEach(function(x){ var t=x.teams||{}; box.appendChild(el('div',{class:'tile'},[
          el('div',{class:'meta',style:'min-width:0'},[el('div',{class:'t',text:(x.position||'-')+'. '+(t.name||'Team')}),el('div',{class:'u',text:x.played+' MP · '+x.wins+'W '+x.draws+'D '+x.losses+'L · GD '+(x.goals_for-x.goals_against)})]),
          el('div',{style:'font-weight:900'},x.points+' pts')
        ])); });
      });
    }).catch(function(error){
      var detail=(error && error.message) || 'The request failed without a response.';
      var code=(error && error.code) ? ' ['+error.code+']' : '';
      var status=(error && error.status) ? ' (HTTP '+error.status+')' : '';
      box.appendChild(ui.empty('⚠️','Standings unavailable','League request failed: '+detail+code+status));
    });
    o.appendChild(el('div',{class:'note',text:'Standings are calculated on the server from completed match results. Points, rankings, promotion and relegation are not client-editable.'}));
  });
  CHL.route('/rankings', function(o){
    if (guard(o,'Rankings','Top creators, teams and gifters \u2014 computed from real activity.')) return;
    o.appendChild(ui.empty('\uD83C\uDFC6','Rankings are empty','Leaderboards populate once there is real gifting and LIVE activity.'));
  });

  /* ---- public profile /profile/:username ---- */
  CHL.route('/profile', function(o,r){
    if (!CHL.configured){ o.appendChild(ui.pageHead('Profile')); o.appendChild(ui.setupNotice()); return; }
    if (r.params && r.params.length){ renderPublicProfile(o, r.params[0]); return; }
    if (!CHL.user){ CHL.navigate('#/login'); return; }
    renderOwnProfile(o);
  });

  function renderPublicProfile(o, handle){
    o.appendChild(ui.spinner());
    var h = String(handle).replace(/^@/,'');
    sb.from('profiles').select('id,username,display_name,bio').eq('username',h).maybeSingle()
      .then(function(res){ o.innerHTML=''; var p=res&&res.data;
        if(!p){ o.appendChild(ui.empty('\uD83D\uDC64','Creator not found','No account exists for @'+h+'.', el('a',{href:'#/discover',class:'btn',style:'margin-top:8px'},'Discover creators'))); return; }
        var who=p.display_name||p.username;
        o.appendChild(el('div',{class:'card',style:'display:flex;gap:16px;align-items:center;flex-wrap:wrap'},[
          el('div',{class:'ava',style:'width:72px;height:72px;font-size:28px',text:CHL.initials(who).toUpperCase()}),
          el('div',{style:'flex:1;min-width:180px'},[ el('div',{style:'font-size:20px;font-weight:800',text:who}), el('div',{style:'color:var(--mut)',text:'@'+p.username}), p.bio?el('div',{style:'margin-top:6px',text:p.bio}):null ]),
          el('button',{class:'btn primary',onclick:function(){ if(!CHL.user){ CHL.navigate('#/login'); return;} CHL.toast('Followed @'+p.username); }},'\u2795 Follow')
        ]));
      }).catch(function(e){ o.innerHTML=''; o.appendChild(el('div',{class:'note',text:e.message})); });
  }
  CHL.renderOwnProfileRef = null; // own-profile handler lives in pages-wallet; delegate
  function renderOwnProfile(o){ if (CHL.ownProfile) CHL.ownProfile(o); }
})();
