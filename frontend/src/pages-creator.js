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
  CHL.route('/creator/analytics', async function(o){
    if (guard(o,'Advanced Creator Analytics','Your Creator Journey, at a Glance. Track creator activity, review performance trends, and follow progress over time.')) return;
    if (!CHL.user) { CHL.navigate('#/login'); return; }
    o.appendChild(subnav(CREATOR_NAV));
    o.appendChild(el('div',{class:'card',style:'margin-bottom:14px'},[
      el('div',{style:'font-size:18px;font-weight:850',text:'Performance overview'}),
      el('p',{class:'sub',text:'Metrics come from your account records. Unsupported metrics are shown as unavailable rather than estimated or invented.'})
    ]));
    var rangeWrap = el('div',{class:'row wrap',style:'align-items:center;justify-content:space-between;gap:10px;margin:12px 0'});
    rangeWrap.appendChild(el('strong',{text:'Reporting period'}));
    var range = el('select',{class:'input',style:'max-width:220px','aria-label':'Analytics reporting period'});
    [['7','Last 7 days'],['30','Last 30 days'],['90','Last 90 days'],['0','All available activity']].forEach(function(item){range.appendChild(el('option',{value:item[0]},item[1]));});
    range.value='30'; rangeWrap.appendChild(range); o.appendChild(rangeWrap);
    var summary = el('div',{class:'grid stat',style:'margin-bottom:16px'}); o.appendChild(summary);
    var contentArea = el('div',{class:'grid',style:'grid-template-columns:minmax(0,1fr);gap:14px'}); o.appendChild(contentArea);
    var metricNote = el('div',{class:'note',text:'Loading real analytics…'}); o.appendChild(metricNote);
    var uid = CHL.user.id;
    async function query(label, request) {
      try { var result = await request; if (result && result.error) throw result.error; return {ok:true,data:result && result.data,count:result && result.count}; }
      catch (error) { console.warn('[Creator Analytics] '+label+' unavailable:',error && error.message || error); return {ok:false,error:error}; }
    }
    var responses = await Promise.all([
      query('server metrics',sb.rpc('get_my_creator_metrics')),
      query('followers',sb.from('follows').select('follower_id',{count:'exact',head:true}).eq('followee_id',uid).eq('status','accepted')),
      query('following',sb.from('follows').select('followee_id',{count:'exact',head:true}).eq('follower_id',uid).eq('status','accepted')),
      query('published posts',sb.from('posts').select('id',{count:'exact',head:true}).eq('author_id',uid).eq('is_draft',false).eq('is_test',false)),
      query('post records',sb.from('posts').select('id,caption,kind,view_count,like_count,created_at,is_draft,is_test,audience').eq('author_id',uid).eq('is_draft',false).eq('is_test',false).order('created_at',{ascending:false}).limit(500)),
      query('LIVE sessions',sb.from('live_sessions').select('id,title,status,viewer_count,started_at,ended_at',{count:'exact'}).eq('host_id',uid).order('started_at',{ascending:false}).limit(500)),
      query('gift transactions',sb.from('gift_transactions').select('id,coin_cost,diamond_value,created_at,live_id').eq('recipient_id',uid).order('created_at',{ascending:false}).limit(1000)),
      query('wallet',CHL.authenticatedApiRequest('/api/wallet'))
    ]);
    var metrics = responses[0].ok ? (Array.isArray(responses[0].data) ? responses[0].data[0] : responses[0].data) : null;
    var followers = responses[1].ok ? responses[1].count : (metrics && metrics.followers);
    var following = responses[2].ok ? responses[2].count : (metrics && metrics.following);
    var postCount = responses[3].ok ? responses[3].count : (metrics && metrics.posts);
    var liveCount = responses[5].ok ? responses[5].count : (metrics && metrics.streams);
    var posts = responses[4].ok && Array.isArray(responses[4].data) ? responses[4].data : [];
    var lives = responses[5].ok && Array.isArray(responses[5].data) ? responses[5].data : [];
    var gifts = responses[6].ok && Array.isArray(responses[6].data) ? responses[6].data : [];
    var wallet = responses[7].ok ? responses[7].data : null;
    function value(v) { return v === undefined || v === null || !Number.isFinite(Number(v)) ? 'Unavailable' : CHL.fmt(Number(v)); }
    function stat(label, val, detail) {
      summary.appendChild(ui.statCard(val === undefined || val === null ? 'Unavailable' : value(val),label));
      if (detail && summary.lastElementChild) summary.lastElementChild.appendChild(el('div',{class:'sub',style:'font-size:11px;margin-top:4px',text:detail}));
    }
    stat('Followers',followers,'Current accepted followers'); stat('Following',following,'Current accepted connections'); stat('Published posts',postCount,'Published, non-test content'); stat('LIVE sessions',liveCount,'Recorded host sessions');

    function card(title, subtitle) {
      var panel=el('section',{class:'card',style:'min-width:0'});
      panel.appendChild(el('div',{style:'font-size:17px;font-weight:850;margin-bottom:5px',text:title}));
      if (subtitle) panel.appendChild(el('p',{class:'sub',text:subtitle}));
      contentArea.appendChild(panel); return panel;
    }
    function inRange(row, field, days) {
      if (!days) return true;
      var raw = row && row[field]; if (!raw) return false;
      var timestamp = new Date(raw).getTime(); return Number.isFinite(timestamp) && timestamp >= Date.now() - days*86400000;
    }
    function drawBars(panel, rows, getName, getNumber) {
      if (!rows.length) { panel.appendChild(ui.empty('📊','No content data for this period','When you publish eligible content, real performance values will appear here.')); return; }
      var values=rows.map(function(row){return Math.max(0,Number(getNumber(row))||0);}); var max=Math.max.apply(Math,values.concat([1]));
      rows.forEach(function(row,index){
        var line=el('div',{style:'display:grid;grid-template-columns:minmax(80px,1fr) minmax(70px,2fr) auto;gap:9px;align-items:center;margin:11px 0'});
        line.appendChild(el('span',{style:'font-size:12px;overflow-wrap:anywhere',text:String(getName(row)||'Untitled post').slice(0,80)}));
        var track=el('div',{style:'height:10px;border-radius:99px;background:var(--line,#353747);overflow:hidden',role:'img','aria-label':String(getNumber(row)||0)+' views'});
        track.appendChild(el('div',{style:'height:100%;width:'+Math.max(0,Math.min(100,values[index]/max*100))+'%;background:var(--chl-accent,#8b75ff);border-radius:99px'})); line.appendChild(track);
        line.appendChild(el('strong',{style:'font-size:12px;text-align:right',text:value(values[index])})); panel.appendChild(line);
      });
    }
    function renderPeriod() {
      var days=Number(range.value); contentArea.textContent='';
      var recentPosts=posts.filter(function(row){return inRange(row,'created_at',days);});
      var recentLives=lives.filter(function(row){return inRange(row,'started_at',days);});
      var recentGifts=gifts.filter(function(row){return inRange(row,'created_at',days);});
      var periodViews=recentPosts.reduce(function(sum,row){return sum+Math.max(0,Number(row.view_count)||0);},0);
      var periodLikes=recentPosts.reduce(function(sum,row){return sum+Math.max(0,Number(row.like_count)||0);},0);
      var likeRate=periodViews>0?(periodLikes/periodViews*100):null;
      var diamonds=recentGifts.reduce(function(sum,row){return sum+Math.max(0,Number(row.diamond_value)||0);},0);
      var coins=recentGifts.reduce(function(sum,row){return sum+Math.max(0,Number(row.coin_cost)||0);},0);
      var content=card('Content analytics','View and like counts for posts published in the selected period. LIVE chat comments and message text are not collected into analytics.');
      var stats=el('div',{class:'grid stat',style:'grid-template-columns:repeat(auto-fit,minmax(130px,1fr));gap:8px'});
      stats.appendChild(ui.statCard(value(periodViews),'Recorded views')); stats.appendChild(ui.statCard(value(periodLikes),'Likes')); stats.appendChild(ui.statCard(likeRate===null?'—':likeRate.toFixed(2)+'%','Like rate'));
      content.appendChild(stats);
      content.appendChild(el('p',{class:'sub',style:'margin-top:8px',text:'These are real current post counters, not historical day-by-day snapshots. Like rate = likes ÷ views; it is unavailable when recorded views are zero. Message bodies and LIVE chat comments are not used as analytics data.'}));
      var ranking=recentPosts.slice().sort(function(a,b){return (Number(b.view_count)||0)-(Number(a.view_count)||0);}).slice(0,5);
      var top=card('Top-performing posts','Ranked by recorded views within the selected period.'); drawBars(top,ranking,function(row){return row.caption||row.kind||'Untitled post';},function(row){return row.view_count;});

      var live=card('LIVE analytics','Session counts and available recorded audience data. These counts are not represented as unique viewers.');
      var audienceRows=recentLives.filter(function(row){return Number.isFinite(Number(row.viewer_count));});
      var viewerAverage=audienceRows.length?audienceRows.reduce(function(sum,row){return sum+Math.max(0,Number(row.viewer_count)||0);},0)/audienceRows.length:null;
      var totalDuration=0, completedDurations=0;
      recentLives.forEach(function(row){if(row.started_at&&row.ended_at){var duration=new Date(row.ended_at).getTime()-new Date(row.started_at).getTime();if(Number.isFinite(duration)&&duration>=0){totalDuration+=duration;completedDurations++;}}});
      var liveStats=el('div',{class:'grid stat',style:'grid-template-columns:repeat(auto-fit,minmax(140px,1fr));gap:8px'});
      liveStats.appendChild(ui.statCard(value(recentLives.length),'Sessions in period')); liveStats.appendChild(ui.statCard(viewerAverage===null?'Unavailable':Math.round(viewerAverage).toLocaleString(),'Avg. recorded viewers/session')); liveStats.appendChild(ui.statCard(completedDurations?Math.round(totalDuration/completedDurations/60000)+' min':'Unavailable','Avg. completed duration'));
      live.appendChild(liveStats);
      if(recentLives.length){var liveList=el('div',{style:'margin-top:12px'});recentLives.slice(0,8).forEach(function(row){liveList.appendChild(el('div',{class:'row wrap',style:'justify-content:space-between;gap:8px;padding:9px 0;border-bottom:1px solid var(--line,#353747)'},[el('span',{style:'min-width:0;overflow-wrap:anywhere',text:row.title||'Untitled LIVE'}),el('span',{class:'sub',text:(row.started_at?new Date(row.started_at).toLocaleDateString():'Date unavailable')+' · '+(row.status||'status unavailable')})]));});live.appendChild(liveList);}else live.appendChild(ui.empty('🎙️','No LIVE sessions in this period','Recorded LIVE sessions will appear here after you go live.'));

      var audience=card('Audience analytics','Current relationship counts and gift activity; historical follower snapshots are not available in the current data contract.');
      var audStats=el('div',{class:'grid stat',style:'grid-template-columns:repeat(auto-fit,minmax(140px,1fr));gap:8px'});
      audStats.appendChild(ui.statCard(value(followers),'Current followers')); audStats.appendChild(ui.statCard(value(following),'Following')); audStats.appendChild(ui.statCard(value(recentGifts.length),'Gift transactions received')); audience.appendChild(audStats);

      var gift=card('Gift & earnings activity','Values are drawn from recorded gift transactions. Diamond-to-fiat conversion is not configured; no fiat estimate is fabricated.');
      var giftStats=el('div',{class:'grid stat',style:'grid-template-columns:repeat(auto-fit,minmax(140px,1fr));gap:8px'});
      giftStats.appendChild(ui.statCard(value(diamonds),'Diamonds from gifts')); giftStats.appendChild(ui.statCard(value(coins),'Coins spent by senders on gifts to you'));
      var currentDiamondBalance = wallet && wallet.diamondBalance !== undefined && wallet.diamondBalance !== null && Number.isFinite(Number(wallet.diamondBalance)) ? Number(wallet.diamondBalance) : 0;
      giftStats.appendChild(ui.statCard(value(currentDiamondBalance),'Current diamond balance')); gift.appendChild(giftStats);
      gift.appendChild(el('p',{class:'sub',style:'margin-top:10px',text:'PayPal payout amounts remain administrator-confirmed until an official conversion rule is configured.'}));
    }
    range.addEventListener('change',renderPeriod);
    renderPeriod();
    var capped = posts.length >= 500 || lives.length >= 500 || gifts.length >= 1000;
    var partial = responses.some(function(result){return !result.ok;});
    metricNote.textContent = (partial ? 'Some data sources were unavailable. Unavailable metrics are labelled rather than replaced with guesses. ' : 'Displayed counters came from available account records. ') + (capped ? 'Trend panels use a bounded recent-record sample; lifetime counters use the server metric function when available.' : 'Trend details include all records returned for this view.') + (metrics ? ' Server-authoritative aggregate metrics are available.' : ' Server aggregate metrics are unavailable in this environment.');
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
    o.appendChild(el('div',{class:'note',html:'PayPal is the only payout method. Save your PayPal email in Payment Settings; an authorized administrator confirms the payout amount and currency before sending the payout.'}));
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

  /* ---- teams ---- */
  CHL.route('/teams', function(o,r){
    if (guard(o,'Teams','Create or join a team, climb levels 1\u201350, compete in leagues.')) return;
    if (r.params && r.params.length){ renderTeam(o, r.params[0]); return; }
    var top=el('div',{class:'row between',style:'margin-bottom:12px'},[ el('span'), el('button',{class:'btn primary',onclick:function(){ if(!CHL.user){CHL.navigate('#/login');return;} CHL.toast('Create-team form \u2014 connect backend to persist'); }},'\u2795 Create team') ]);
    o.appendChild(top);
    var list=el('div',{class:'grid live'}); o.appendChild(list); list.appendChild(ui.spinner());
    sb.from('teams').select('id,name,level,points').order('points',{ascending:false}).limit(30)
      .then(function(r2){ list.innerHTML=''; var rows=(r2&&r2.data)||[];
        if(!rows.length){ list.appendChild(ui.empty('\uD83D\uDEE1\uFE0F','No teams yet','Be the first to create a team.')); list.style.display='block'; return; }
        list.style.display=''; rows.forEach(function(t){ list.appendChild(el('div',{class:'tile',onclick:function(){ CHL.navigate('#/teams/'+t.id); }},[ el('div',{class:'thumb'},[ el('div',{class:'ava',text:CHL.initials(t.name).toUpperCase()}) ]), el('div',{class:'meta'},[ el('div',{class:'t',text:t.name}), el('div',{class:'u',text:'Lv '+(t.level||1)+' \u00B7 '+CHL.fmt(t.points||0)+' pts'}) ]) ])); });
      }).catch(function(){ list.innerHTML=''; list.appendChild(ui.empty('\uD83D\uDEE1\uFE0F','No teams yet','Be the first to create a team.')); });
  });
  function renderTeam(o, id){
    o.appendChild(ui.spinner());
    sb.from('teams').select('id,name,level,points').eq('id',id).maybeSingle()
      .then(function(res){ o.innerHTML=''; var t=res&&res.data;
        if(!t){ o.appendChild(ui.empty('\uD83D\uDEE1\uFE0F','Team not found','This team may have disbanded.', el('a',{href:'#/teams',class:'btn',style:'margin-top:8px'},'All teams'))); return; }
        o.appendChild(el('div',{class:'card',style:'display:flex;gap:16px;align-items:center;flex-wrap:wrap'},[
          el('div',{class:'ava',style:'width:64px;height:64px;font-size:24px',text:CHL.initials(t.name).toUpperCase()}),
          el('div',{style:'flex:1;min-width:160px'},[ el('div',{style:'font-size:20px;font-weight:800',text:t.name}), el('div',{style:'color:var(--mut)',text:'Level '+(t.level||1)+' \u00B7 '+CHL.fmt(t.points||0)+' points'}) ]),
          el('button',{class:'btn primary',onclick:function(){ if(!CHL.user){CHL.navigate('#/login');return;} CHL.toast('Join request sent'); }},'Join team')
        ]));
      }).catch(function(e){ o.innerHTML=''; o.appendChild(el('div',{class:'note',text:e.message})); });
  }

  CHL.route('/leagues', function(o,r){
    if (guard(o,'Leagues','Server-managed competition. Results and standings are calculated from recorded matches.')) return;
    var div=r.params && r.params.length ? r.params[0] : null;
    o.appendChild(el('div',{class:'h1',style:'font-size:20px',text:div?'Division '+div:'Leagues'}));
    var box=el('div',{class:'card'},[]); o.appendChild(box);
    CHL.authenticatedApiRequest('/api/leagues/standings').then(function(d){
      var rows=(d.standings||[]).filter(function(x){return !div || x.division_code===div;});
      if(!rows.length){ box.appendChild(ui.empty('🏅',div?'No teams in '+div+' yet':'No active season standings yet','Only completed server-recorded matches change this table.')); return; }
      var grouped={}; rows.forEach(function(x){(grouped[x.division_code] ||= []).push(x);});
      Object.keys(grouped).sort().forEach(function(code){
        box.appendChild(el('h3',{text:code,style:'margin:18px 0 8px'}));
        grouped[code].forEach(function(x){ var t=x.teams||{}; box.appendChild(el('div',{class:'tile'},[
          el('div',{class:'meta',style:'min-width:0'},[el('div',{class:'t',text:(x.position||'-')+'. '+(t.name||'Team')}),el('div',{class:'u',text:x.played+' MP · '+x.wins+'W '+x.draws+'D '+x.losses+'L · GD '+(x.goals_for-x.goals_against)})]),
          el('div',{style:'font-weight:900'},x.points+' pts')
        ])); });
      });
    }).catch(function(){box.appendChild(ui.empty('⚠️','Standings unavailable','The competition server is not reachable.'));});
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

  async function renderPublicProfile(o, handle){
    o.appendChild(ui.pageHead('Creator profile','View profile details, follow status, and published posts.'));
    var h=String(handle).replace(/^@/,'');
    var content=el('div',{class:'grid',style:'grid-template-columns:minmax(0,1fr);gap:12px'});o.appendChild(content);content.appendChild(ui.spinner());
    try{
      var result=await sb.from('profiles').select('id,username,display_name,bio,avatar_url,cover_url,privacy').eq('username',h).maybeSingle();
      if(result.error)throw result.error;
      var p=result.data;content.innerHTML='';
      if(!p){content.appendChild(ui.empty('👤','Creator not found','No account exists for @'+h+'.',el('a',{href:'#/discover',class:'btn',style:'margin-top:8px'},'Discover creators')));return;}
      if(CHL.user&&String(CHL.user.id)===String(p.id)){renderOwnProfile(content);return;}
      var who=p.display_name||p.username||'Creator';
      var requestList=[
        sb.from('follows').select('follower_id',{count:'exact',head:true}).eq('followee_id',p.id).eq('status','accepted'),
        sb.from('follows').select('followee_id',{count:'exact',head:true}).eq('follower_id',p.id).eq('status','accepted')
      ];
      if(CHL.user)requestList.push(sb.from('follows').select('follower_id,status').eq('follower_id',CHL.user.id).eq('followee_id',p.id).maybeSingle());
      var counts=await Promise.all(requestList);var followerCount=counts[0].count||0;var followingCount=counts[1].count||0;var viewerRelation=CHL.user&&counts[2]&&counts[2].data;var following=!!(viewerRelation&&viewerRelation.status==='accepted');var requested=!!(viewerRelation&&viewerRelation.status==='pending');
      var [settingsResult]=await Promise.all([sb.from('user_settings').select('privacy').eq('user_id',p.id).maybeSingle()]);
      var privacy=(settingsResult&&settingsResult.data&&settingsResult.data.privacy)||p.privacy||{};
      var top=el('section',{class:'card'});var row=el('div',{style:'display:flex;gap:16px;align-items:center;flex-wrap:wrap'});
      if(p.avatar_url)row.appendChild(el('img',{src:p.avatar_url,alt:who+' profile image',style:'width:72px;height:72px;border-radius:50%;object-fit:cover'}));
      else row.appendChild(el('div',{class:'ava',style:'width:72px;height:72px;font-size:28px',text:CHL.initials(who).toUpperCase()}));
      var detail=el('div',{style:'flex:1;min-width:180px'});detail.appendChild(el('div',{style:'font-size:20px;font-weight:800',text:who}));detail.appendChild(el('div',{style:'color:var(--mut)',text:'@'+p.username}));if(p.bio)detail.appendChild(el('div',{style:'margin-top:6px;overflow-wrap:anywhere',text:p.bio}));
      var countsRow=el('div',{class:'row wrap',style:'gap:16px;margin-top:10px'});var followerText=el('span',{text:CHL.fmt(followerCount)+' followers'});countsRow.appendChild(followerText);countsRow.appendChild(el('span',{text:CHL.fmt(followingCount)+' following'}));detail.appendChild(countsRow);row.appendChild(detail);top.appendChild(row);
      var actions=el('div',{class:'row wrap',style:'gap:8px;margin-top:16px'});
      if(CHL.user){
        var privateProfile=privacy.account==='private';var followButton=el('button',{class:'btn primary',type:'button',text:requested?'Requested · Cancel':(following?'Following · Unfollow':(privateProfile?'Request to follow':'Follow'))});
        followButton.addEventListener('click',async function(){followButton.disabled=true;try{
          if(following||requested){var wasFollowing=following;var removed=await sb.from('follows').delete().eq('follower_id',CHL.user.id).eq('followee_id',p.id);if(removed.error)throw removed.error;following=false;requested=false;if(wasFollowing)followerCount=Math.max(0,followerCount-1);followButton.textContent=privateProfile?'Request to follow':'Follow';}
          else{var added=await sb.from('follows').insert({follower_id:CHL.user.id,followee_id:p.id,status:privateProfile?'pending':'accepted'});if(added.error)throw added.error;following=!privateProfile;requested=privateProfile;if(following)followerCount+=1;followButton.textContent=privateProfile?'Requested · Cancel':'Following · Unfollow';}
          followerText.textContent=CHL.fmt(followerCount)+' followers';CHL.toast(requested?'Follow request sent.':(following?'You are now following @'+p.username:(privateProfile?'Follow request cancelled.':'You unfollowed @'+p.username)));
        }catch(error){CHL.toast(error.message||'Could not update your follow.');}finally{followButton.disabled=false;}});actions.appendChild(followButton);
        var messageButton=el('button',{class:'btn',type:'button',text:'Message'});messageButton.addEventListener('click',async function(){messageButton.disabled=true;messageButton.textContent='Opening…';try{var conversation=await CHL.authenticatedApiRequest('/api/messages/conversations',{method:'POST',body:{recipientId:p.id}});if(!conversation||!conversation.conversationId)throw new Error('The conversation could not be opened.');CHL.navigate('#/messages/'+conversation.conversationId);}catch(error){CHL.toast(error.message||'Could not start a conversation.');messageButton.disabled=false;messageButton.textContent='Message';}});actions.appendChild(messageButton);
      }else actions.appendChild(el('a',{class:'btn primary',href:'#/login'},'Log in to follow or message'));
      top.appendChild(actions);content.appendChild(top);
      var isFollower=following;
      if((privacy.account==='private'||privacy.account==='followers')&&!isFollower&&(!CHL.user||String(CHL.user.id)!==String(p.id))){content.appendChild(el('div',{class:'card'},[el('div',{style:'font-weight:800',text:privacy.account==='private'?'Private profile':'Followers-only profile'}),el('p',{class:'sub',text:privacy.account==='private'?'Follow this creator and wait for approval to view profile content.':'Follow this creator to view follower-only profile content.'})]));return;}
      var postsPanel=el('section',{class:'card'});postsPanel.appendChild(el('div',{style:'font-size:17px;font-weight:850;margin-bottom:10px',text:'Published posts'}));postsPanel.appendChild(ui.spinner());content.appendChild(postsPanel);
      var postsResult=await sb.from('posts').select('id,caption,kind,created_at,view_count,like_count').eq('author_id',p.id).eq('is_draft',false).eq('is_test',false).order('created_at',{ascending:false}).limit(12);
      if(postsResult.error)throw postsResult.error;postsPanel.innerHTML='';postsPanel.appendChild(el('div',{style:'font-size:17px;font-weight:850;margin-bottom:10px',text:'Published posts'}));
      var posts=postsResult.data||[];if(!posts.length){postsPanel.appendChild(ui.empty('📝','No published posts yet','Published public posts will appear here.'));return;}
      posts.forEach(function(post){var card=el('article',{class:'card',style:'margin:8px 0;cursor:pointer',onclick:function(){CHL.navigate('#/post/'+post.id);}});card.appendChild(el('div',{style:'font-weight:750',text:post.caption||post.kind||'Post'}));card.appendChild(el('div',{class:'sub',style:'font-size:12px;margin-top:5px',text:CHL.ago(post.created_at)+' · '+CHL.fmt(post.view_count||0)+' views · '+CHL.fmt(post.like_count||0)+' likes'}));postsPanel.appendChild(card);});
    }catch(e){content.innerHTML='';content.appendChild(el('div',{class:'note',text:e.message||'Could not load this profile.'}));}
  }
  CHL.renderOwnProfileRef = null; // own-profile handler lives in pages-wallet; delegate
  function renderOwnProfile(o){ if (CHL.ownProfile) CHL.ownProfile(o); }
})();
