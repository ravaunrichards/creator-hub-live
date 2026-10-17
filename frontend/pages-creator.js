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
    {h:'#/creator',label:'Overview'},{h:'#/creator/achievements',label:'Achievements'},{h:'#/creator/analytics',label:'Analytics'},
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
  function renderAchievements(o){
    if(guard(o,'Achievements & Creator Tasks','Earn progress through real activity. Tasks rotate automatically when completed; no points or rewards are fabricated.'))return;
    o.appendChild(subnav(CREATOR_NAV));
    var wrap=el('div',{class:'chl-achievements-page'});o.appendChild(wrap);
    var refresh=el('button',{class:'btn',type:'button',text:'Refresh progress',style:'margin-bottom:12px'});wrap.appendChild(refresh);
    var current=el('section',{class:'card chl-task-current'});wrap.appendChild(current);
    var history=el('section',{class:'card',style:'margin-top:14px'});wrap.appendChild(history);
    async function load(){refresh.disabled=true;current.innerHTML='';current.appendChild(ui.spinner());history.innerHTML='';history.appendChild(ui.spinner());try{
      var result=await CHL.authenticatedApiRequest('/api/creator/tasks');var task=result&&result.activeTask;if(!task)throw new Error('The creator task service returned no active task.');current.innerHTML='';
      if(result.completedTask)current.appendChild(el('div',{class:'note',text:'Achievement completed: '+result.completedTask.title+'. Your next task has been assigned automatically.'}));
      current.appendChild(el('div',{class:'row between wrap',style:'gap:8px;align-items:start'},[el('div',{},[el('div',{class:'sub',text:'CURRENT TASK · CYCLE '+task.cycleNo}),el('h2',{text:task.title,style:'font-size:22px;margin:5px 0'}),el('p',{class:'sub',text:task.description})]),el('span',{class:'badge',text:Math.min(task.progress,task.target)+' / '+task.target})]));
      var pct=Math.max(0,Math.min(100,Math.round((Number(task.progress||0)/Math.max(1,Number(task.target||1)))*100)));var track=el('div',{class:'chl-task-progress-track',role:'progressbar','aria-valuemin':'0','aria-valuemax':String(task.target),'aria-valuenow':String(task.progress)});track.appendChild(el('div',{class:'chl-task-progress-fill',style:'width:'+pct+'%'}));current.appendChild(track);current.appendChild(el('div',{class:'sub',text:pct+'% complete · Assigned '+CHL.ago(task.assignedAt)}));
      var rows=result.history||[];history.innerHTML='';history.appendChild(el('h2',{text:'Completed achievements',style:'font-size:18px;margin:0 0 12px'}));if(!rows.length){history.appendChild(ui.empty('🏅','Your first achievement is waiting','Complete the current task through real LIVE sessions, posts, or new followers.'));}else rows.forEach(function(row){history.appendChild(el('div',{class:'chl-achievement-row'},[el('div',{class:'chl-achievement-mark',text:'✓'}),el('div',{style:'flex:1;min-width:0'},[el('strong',{text:row.title}),el('div',{class:'sub',text:'Cycle '+row.cycleNo+' · '+CHL.ago(row.completedAt)})]),el('span',{class:'badge',text:row.progress+' / '+row.target})]));});
    }catch(error){current.innerHTML='';current.appendChild(el('div',{class:'note',text:error.message||'Achievements could not be loaded.'}));history.innerHTML='';history.appendChild(el('div',{class:'sub',text:'Completed task history is unavailable until the required database migration is applied.'}));}finally{refresh.disabled=false;}}
    refresh.addEventListener('click',load);load();var taskTimer=window.setInterval(function(){if(!CHL.current||(CHL.current.path!=='/creator/achievements'&&CHL.current.path!=='/achievements')){window.clearInterval(taskTimer);return;}if(!refresh.disabled)load();},30000);
  }
  CHL.route('/creator/achievements', renderAchievements);
  CHL.route('/achievements', renderAchievements);

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
    // Keep Analytics on explicit, auditable data sources only. Do not call the
    // undocumented aggregate RPC here: its comment-exclusion behavior cannot be
    // verified from the project source. LIVE chat messages are not analytics data.
    var responses = await Promise.all([
      query('followers',sb.from('follows').select('follower_id',{count:'exact',head:true}).eq('followee_id',uid).eq('status','accepted')),
      query('following',sb.from('follows').select('followee_id',{count:'exact',head:true}).eq('follower_id',uid).eq('status','accepted')),
      query('published posts',sb.from('posts').select('id',{count:'exact',head:true}).eq('author_id',uid).eq('is_draft',false).eq('is_test',false)),
      query('post records',sb.from('posts').select('id,caption,kind,view_count,like_count,created_at,is_draft,is_test,audience').eq('author_id',uid).eq('is_draft',false).eq('is_test',false).order('created_at',{ascending:false}).limit(500)),
      query('LIVE sessions',sb.from('live_sessions').select('id,title,status,viewer_count,started_at,ended_at',{count:'exact'}).eq('host_id',uid).order('started_at',{ascending:false}).limit(500)),
      query('gift transactions',sb.from('gift_transactions').select('id,coin_cost,diamond_value,created_at,live_id').eq('recipient_id',uid).order('created_at',{ascending:false}).limit(1000)),
      query('wallet',CHL.authenticatedApiRequest('/api/wallet'))
    ]);
    var metrics = null;
    var followers = responses[0].ok ? responses[0].count : null;
    var following = responses[1].ok ? responses[1].count : null;
    var postCount = responses[2].ok ? responses[2].count : null;
    var liveCount = responses[4].ok ? responses[4].count : null;
    var posts = responses[3].ok && Array.isArray(responses[3].data) ? responses[3].data : [];
    var lives = responses[4].ok && Array.isArray(responses[4].data) ? responses[4].data : [];
    var gifts = responses[5].ok && Array.isArray(responses[5].data) ? responses[5].data : [];
    var wallet = responses[6].ok ? responses[6].data : null;
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
    if (guard(o,'Teams','Create or join a team, climb levels 1–50, compete in leagues.')) return;
    if (r.params && r.params.length){ renderTeam(o, r.params[0]); return; }
    var createPanel = el('div',{class:'card',style:'display:none;margin-bottom:12px'});
    var createForm = el('form',{class:'stack',style:'gap:10px'});
    var nameInput = el('input',{id:'chl-team-name',class:'input',type:'text',name:'name',minlength:'3',maxlength:'40',required:'required',autocomplete:'off',placeholder:'Choose a name (3–40 characters)','aria-label':'Team name'});
    var createError = el('div',{class:'note',role:'status','aria-live':'polite',style:'display:none'});
    var createActions = el('div',{class:'row wrap',style:'gap:8px'});
    var createSave = el('button',{class:'btn primary',type:'submit',text:'Create team'});
    var createCancel = el('button',{class:'btn',type:'button',text:'Cancel'});
    createActions.appendChild(createSave); createActions.appendChild(createCancel);
    createForm.appendChild(el('label',{class:'label',text:'Team name',for:'chl-team-name'}));
    createForm.appendChild(nameInput); createForm.appendChild(createError); createForm.appendChild(createActions); createPanel.appendChild(createForm);
    createPanel.id='chl-team-create';
    var openCreate = el('button',{class:'btn primary',type:'button',text:'➕ Create team','aria-expanded':'false','aria-controls':'chl-team-create'});
    openCreate.addEventListener('click',function(){
      if(!CHL.user){CHL.navigate('#/login');return;}
      var opening=createPanel.style.display==='none'; createPanel.style.display=opening?'block':'none'; openCreate.setAttribute('aria-expanded',opening?'true':'false');
      if(opening)nameInput.focus();
    });
    createCancel.addEventListener('click',function(){createPanel.style.display='none';createError.style.display='none';openCreate.setAttribute('aria-expanded','false');});
    createForm.addEventListener('submit',async function(event){
      event.preventDefault(); var name=String(nameInput.value||'').trim().replace(/\s+/g,' ');
      createError.style.display='none'; createError.textContent='';
      if(name.length<3||name.length>40){createError.textContent='Team names must contain 3–40 characters.';createError.style.display='block';nameInput.focus();return;}
      createSave.disabled=true;createSave.textContent='Creating…';
      try{
        var result=await CHL.authenticatedApiRequest('/api/teams',{method:'POST',body:{name:name}});
        var team=result&&result.team; if(Array.isArray(team))team=team[0];
        if(!team||!team.id)throw new Error('The server did not return the created team. Refresh the teams list before trying again.');
        CHL.toast('Team created.'); CHL.navigate('#/teams/'+encodeURIComponent(team.id));
      }catch(error){createError.textContent=error&&error.message||'Could not create this team. Please try again.';createError.style.display='block';}
      finally{createSave.disabled=false;createSave.textContent='Create team';}
    });
    o.appendChild(el('div',{class:'row between',style:'margin-bottom:12px;gap:8px;flex-wrap:wrap'},[el('span',{text:'Discover teams and join a community.'}),openCreate]));
    o.appendChild(createPanel);
    var list=el('div',{class:'grid live'}); o.appendChild(list); list.appendChild(ui.spinner());
    CHL.apiRequest('/api/teams?limit=30').then(function(response){
      list.innerHTML=''; var rows=response&&Array.isArray(response.teams)?response.teams:[];
      if(!rows.length){list.appendChild(ui.empty('🛡️','No teams yet','Be the first to create a team.'));list.style.display='block';return;}
      list.style.display=''; rows.forEach(function(t){list.appendChild(el('button',{type:'button',class:'tile',style:'width:100%;text-align:left;color:inherit',onclick:function(){CHL.navigate('#/teams/'+encodeURIComponent(t.id));}},[
        el('div',{class:'thumb'},[el('div',{class:'ava',text:CHL.initials(t.name).toUpperCase()})]),
        el('div',{class:'meta'},[el('div',{class:'t',text:t.name}),el('div',{class:'u',text:'Lv '+(t.level||1)+' · '+CHL.fmt(t.points||0)+' pts'})])
      ]));});
    }).catch(function(error){list.innerHTML='';list.appendChild(ui.empty('⚠️','Teams unavailable',error&&error.message||'The team service could not be reached. Please retry.'));});
  });
  function renderTeam(o, id){
    var teamId=String(id||''); o.appendChild(ui.spinner());
    CHL.apiRequest('/api/teams/'+encodeURIComponent(teamId)).then(async function(response){
      var t=response&&response.team; if(!t)throw new Error('The server did not return this team.');
      var members=[];
      try{var memberResponse=await CHL.apiRequest('/api/teams/'+encodeURIComponent(teamId)+'/members');members=memberResponse&&Array.isArray(memberResponse.members)?memberResponse.members:[];}catch(_){members=[];}
      o.innerHTML='';
      var details=el('div',{class:'card',style:'display:flex;gap:16px;align-items:center;flex-wrap:wrap'},[
        el('div',{class:'ava',style:'width:64px;height:64px;font-size:24px',text:CHL.initials(t.name).toUpperCase()}),
        el('div',{style:'flex:1;min-width:160px'},[el('div',{style:'font-size:20px;font-weight:800',text:t.name}),el('div',{style:'color:var(--mut)',text:'Level '+(t.level||1)+' · '+CHL.fmt(t.points||0)+' points'}),el('div',{style:'color:var(--mut);font-size:12px;margin-top:4px',text:members.length+' member'+(members.length===1?'':'s')})])
      ]); o.appendChild(details);
      var isOwner=!!(CHL.user&&String(t.owner_id)===String(CHL.user.id));
      var isMember=!!(CHL.user&&members.some(function(member){return String(member.user_id)===String(CHL.user.id);}));
      var action=el('button',{class:'btn primary',type:'button',text:isOwner?'Team owner':(isMember?'Leave team':'Join team')}); action.disabled=isOwner;
      action.addEventListener('click',async function(){
        if(!CHL.user){CHL.navigate('#/login');return;}
        if(isMember&&!window.confirm('Leave this team? You can request to join again later.'))return;
        action.disabled=true; action.textContent=isMember?'Leaving…':'Joining…';
        try{
          if(isMember){await CHL.authenticatedApiRequest('/api/teams/'+encodeURIComponent(teamId)+'/leave',{method:'DELETE',body:{}});CHL.toast('You left the team.');}
          else{await CHL.authenticatedApiRequest('/api/teams/'+encodeURIComponent(teamId)+'/join',{method:'POST',body:{}});CHL.toast('You joined the team.');}
          renderTeam(o,teamId);
        }catch(error){CHL.toast(error&&error.message||'The team membership could not be updated.');action.disabled=false;action.textContent=isOwner?'Team owner':(isMember?'Leave team':'Join team');}
      });
      details.appendChild(action);
      if(isOwner)o.appendChild(el('div',{class:'note',style:'margin-top:8px',text:'You own this team. Transfer ownership before leaving.'}));
      var memberPanel=el('div',{class:'card',style:'margin-top:12px'}); memberPanel.appendChild(el('div',{style:'font-weight:800;margin-bottom:8px',text:'Members'}));
      if(!members.length)memberPanel.appendChild(el('div',{class:'note',text:'Member details are currently unavailable.'}));
      else members.forEach(function(member){var profile=member.profile||{};var display=profile.display_name||profile.username||'Creator';memberPanel.appendChild(el('div',{class:'row between',style:'gap:10px;padding:7px 0;border-bottom:1px solid var(--line)'},[el('span',{text:display}),el('span',{class:'chip',text:member.role==='owner'?'Owner':(member.role||'Member')})]));});
      o.appendChild(memberPanel); o.appendChild(el('a',{href:'#/teams',class:'btn',style:'margin-top:12px;display:inline-flex'},'← All teams'));
    }).catch(function(error){o.innerHTML='';o.appendChild(ui.empty('⚠️','Team unavailable',error&&error.message||'This team could not be loaded.',el('a',{href:'#/teams',class:'btn',style:'margin-top:8px'},'All teams')));});
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
    o.appendChild(ui.pageHead('Creator profile','Discover their posts, community and activity.'));
    var h=String(handle||'').replace(/^@/,'').trim();
    var content=el('div',{class:'chl-profile-page'});o.appendChild(content);content.appendChild(ui.spinner());
    try{
      var result=await sb.from('profiles').select('id,username,display_name,bio,avatar_url,cover_url,privacy,followers_count,following_count,posts_count').eq('username',h).maybeSingle();
      if(result.error)throw result.error;
      var p=result.data;content.innerHTML='';
      if(!p){content.appendChild(ui.empty('👤','Creator not found','No account exists for @'+h+'.',el('a',{href:'#/discover',class:'btn',style:'margin-top:8px'},'Discover creators')));return;}
      if(CHL.user&&String(CHL.user.id)===String(p.id)){if(CHL.current.path.indexOf('/followers')>=0||CHL.current.path.indexOf('/following')>=0||CHL.current.path.indexOf('/friends')>=0){renderOwnRelations(content,p,CHL.current.path.indexOf('/followers')>=0?'followers':CHL.current.path.indexOf('/friends')>=0?'friends':'following');return;}renderOwnProfile(content);return;}
      var who=p.display_name||p.username||'Creator';
      var privacyResult=await sb.from('user_settings').select('privacy').eq('user_id',p.id).maybeSingle();
      var privacy=(privacyResult&&privacyResult.data&&privacyResult.data.privacy)||p.privacy||{};
      var blockedByMe=false, blockedMe=false, following=false, requested=false;
      if(CHL.user){
        var rels=await Promise.all([
          sb.from('follows').select('status').eq('follower_id',CHL.user.id).eq('followee_id',p.id).maybeSingle(),
          CHL.authenticatedApiRequest('/api/social/blocks?userId='+encodeURIComponent(p.id))
        ]);
        if(rels[0].error)throw rels[0].error;
        following=!!(rels[0].data&&rels[0].data.status==='accepted');requested=!!(rels[0].data&&rels[0].data.status==='pending');
        blockedByMe=!!(rels[1]&&rels[1].blockedByMe);blockedMe=!!(rels[1]&&rels[1].blockedMe);
      }
      var countResults=await Promise.all([
        sb.from('follows').select('follower_id',{count:'exact',head:true}).eq('followee_id',p.id).eq('status','accepted'),
        sb.from('follows').select('followee_id',{count:'exact',head:true}).eq('follower_id',p.id).eq('status','accepted'),
        sb.from('posts').select('id',{count:'exact',head:true}).eq('author_id',p.id).eq('is_draft',false).eq('is_test',false)
      ]);
      countResults.forEach(function(x){if(x.error)throw x.error;});
      var followerCount=countResults[0].count||0, followingCount=countResults[1].count||0, postCount=countResults[2].count||0;
      var header=el('section',{class:'card chl-profile-header'});
      var cover=el('div',{class:'chl-profile-cover'});if(p.cover_url)cover.appendChild(el('img',{src:p.cover_url,alt:'',loading:'lazy'}));header.appendChild(cover);
      var identity=el('div',{class:'chl-profile-identity'});
      if(p.avatar_url)identity.appendChild(el('img',{src:p.avatar_url,alt:who+' profile image',class:'chl-profile-avatar'}));else identity.appendChild(el('div',{class:'ava chl-profile-avatar-fallback',text:CHL.initials(who).toUpperCase()}));
      var detail=el('div',{class:'chl-profile-detail'});detail.appendChild(el('div',{class:'chl-profile-display-name',text:who}));detail.appendChild(el('div',{class:'sub',text:'@'+p.username}));if(p.bio)detail.appendChild(el('p',{class:'chl-profile-bio',text:p.bio}));
      var metrics=el('div',{class:'chl-profile-metrics'});
      function metric(label,count,href){var a=el('a',{href:href,class:'chl-profile-metric','aria-label':count+' '+label},[el('strong',{text:CHL.fmt(count)}),el('span',{text:label})]);metrics.appendChild(a);}
      metric('Posts',postCount,'#/profile/'+encodeURIComponent(p.username));metric('Followers',followerCount,'#/profile/'+encodeURIComponent(p.username)+'/followers');metric('Following',followingCount,'#/profile/'+encodeURIComponent(p.username)+'/following');detail.appendChild(metrics);identity.appendChild(detail);header.appendChild(identity);
      var actions=el('div',{class:'row wrap chl-profile-actions'});
      if(CHL.user){
        var followButton=el('button',{class:'btn '+(following?'':'primary'),type:'button',text:requested?'Requested · Cancel':following?'Following · Unfollow':(privacy.account==='private'?'Request to follow':'Follow')});
        followButton.addEventListener('click',async function(){if(blockedByMe){CHL.toast('Unblock this account before following or messaging it.');return;}if(blockedMe){CHL.toast('This creator has blocked your account, so following and messaging are unavailable.');return;}followButton.disabled=true;try{
          if(following||requested){var wasFollowing=following;await CHL.authenticatedApiRequest('/api/social/follows',{method:'DELETE',body:{userId:p.id}});following=false;requested=false;if(wasFollowing)followerCount=Math.max(0,followerCount-1);}
          else{var followResult=await CHL.authenticatedApiRequest('/api/social/follows',{method:'POST',body:{userId:p.id}});following=!!followResult.following;requested=!!followResult.requested;if(following)followerCount+=1;}
          followButton.textContent=requested?'Requested · Cancel':following?'Following · Unfollow':(privacy.account==='private'?'Request to follow':'Follow');followButton.classList.toggle('primary',!following&&!requested);CHL.toast(requested?'Follow request sent.':following?'You are now following @'+p.username:'Follow removed.');
          var fmetric=metrics.querySelectorAll('.chl-profile-metric')[1];if(fmetric)fmetric.querySelector('strong').textContent=CHL.fmt(followerCount);
        }catch(error){CHL.toast(error.message||'Could not update follow status.');}finally{followButton.disabled=false;}});actions.appendChild(followButton);
        var messageButton=el('button',{class:'btn',type:'button',text:'Message'});messageButton.addEventListener('click',async function(){if(blockedByMe){CHL.toast('Unblock this account before messaging it.');return;}if(blockedMe){CHL.toast('This creator has blocked your account, so messaging is unavailable.');return;}if(privacy.messages==='nobody'){CHL.toast('This creator is not accepting direct messages.');return;}messageButton.disabled=true;try{var c=await CHL.authenticatedApiRequest('/api/messages/conversations',{method:'POST',body:{recipientId:p.id}});if(!c||!c.conversationId)throw new Error('Conversation could not be opened.');CHL.navigate('#/messages/'+c.conversationId);}catch(error){CHL.toast(error.message||'Could not start conversation.');}finally{messageButton.disabled=false;}});actions.appendChild(messageButton);
        var blockButton=el('button',{class:'btn danger',type:'button',text:blockedByMe?'Unblock':'Block'});blockButton.addEventListener('click',async function(){var next=!blockedByMe;blockButton.disabled=true;try{await CHL.authenticatedApiRequest('/api/social/blocks',{method:next?'POST':'DELETE',body:{userId:p.id}});blockedByMe=next;blockButton.textContent=blockedByMe?'Unblock':'Block';postsPanel.style.display=blockedByMe||blockedMe?'none':'';if(blockedByMe){CHL.toast('Account blocked. Their content is hidden from this view.');}else{CHL.toast('Account unblocked.');loadPosts(true);}}catch(error){CHL.toast(error.message||'Could not update block status.');}finally{blockButton.disabled=false;}});actions.appendChild(blockButton);
        actions.appendChild(el('button',{class:'btn',type:'button',text:'Report',onclick:function(){CHL.navigate('#/report/user/'+encodeURIComponent(p.id));}}));
      }else actions.appendChild(el('a',{href:'#/login',class:'btn primary'},'Log in to follow or message'));
      header.appendChild(actions);content.appendChild(header);
      var postsPanel=el('section',{class:'card chl-profile-posts'});postsPanel.appendChild(el('div',{class:'chl-profile-posts-heading'},[el('strong',{text:'Posts'}),el('span',{class:'sub',text:postCount+' published'})]));content.appendChild(postsPanel);
      if(CHL.current.path.indexOf('/followers')>=0||CHL.current.path.indexOf('/following')>=0){
        postsPanel.innerHTML='';var isFollowers=CHL.current.path.indexOf('/followers')>=0;postsPanel.appendChild(el('div',{class:'chl-profile-posts-heading'},[el('strong',{text:isFollowers?'Followers':'Following'}),el('a',{href:'#/profile/'+encodeURIComponent(p.username),class:'btn',text:'Back to profile'})]));
        var relationList=el('div',{class:'chl-profile-relations'});var relationSentinel=el('div',{class:'chl-load-sentinel',text:'Loading accounts…'});postsPanel.appendChild(relationList);postsPanel.appendChild(relationSentinel);var relationOffset=0,relationBusy=false,relationHasMore=true;
        async function loadPeople(){if(relationBusy||!relationHasMore)return;relationBusy=true;try{var relationQuery=isFollowers?sb.from('follows').select('follower_id,created_at').eq('followee_id',p.id).eq('status','accepted'):sb.from('follows').select('followee_id,created_at').eq('follower_id',p.id).eq('status','accepted');var relationResult=await relationQuery.order('created_at',{ascending:false}).range(relationOffset,relationOffset+49);if(relationResult.error)throw relationResult.error;var edges=relationResult.data||[];var ids=edges.map(function(x){return isFollowers?x.follower_id:x.followee_id;});relationOffset+=edges.length;relationHasMore=edges.length===50;if(!ids.length&&relationOffset===0){relationList.appendChild(ui.empty('👥',isFollowers?'No followers yet':'Not following anyone yet','This list will update as the community grows.'));relationSentinel.remove();return;}if(ids.length){var peopleResult=await sb.from('profiles').select('id,username,display_name,avatar_url,bio').in('id',ids);if(peopleResult.error)throw peopleResult.error;var people=peopleResult.data||[];people.sort(function(a,b){return ids.indexOf(a.id)-ids.indexOf(b.id);});people.forEach(function(person){var name=person.display_name||person.username||'Creator';relationList.appendChild(el('a',{class:'chl-profile-person',href:'#/profile/'+encodeURIComponent(person.username)},[person.avatar_url?el('img',{src:person.avatar_url,alt:'',class:'chl-profile-person-avatar'}):el('div',{class:'ava chl-profile-person-avatar',text:CHL.initials(name).toUpperCase()}),el('div',{style:'min-width:0;flex:1'},[el('strong',{text:name}),el('div',{class:'sub',text:'@'+person.username}),person.bio?el('div',{class:'sub',text:person.bio}):el('span',{})]),el('span',{class:'sub',text:'View profile →'})]));});}relationSentinel.textContent=relationHasMore?'Scroll to load more accounts':'End of list';if(!relationHasMore&&relationObserver)relationObserver.disconnect();}catch(error){relationSentinel.textContent='Could not load accounts. Tap to retry.';relationSentinel.onclick=loadPeople;}finally{relationBusy=false;}}
        var relationObserver=null;if('IntersectionObserver' in window){relationObserver=new IntersectionObserver(function(entries){if(entries.some(function(entry){return entry.isIntersecting;}))loadPeople();},{rootMargin:'300px'});relationObserver.observe(relationSentinel);}else relationSentinel.addEventListener('click',loadPeople);loadPeople();return;
      }
      if(blockedMe){postsPanel.appendChild(ui.empty('🔒','Profile unavailable','This creator has restricted access to this profile.'));return;}
      if(blockedByMe){postsPanel.appendChild(ui.empty('🚫','You blocked this account','Unblock this creator to view their posts.'));return;}
      if((privacy.account==='private'||privacy.account==='followers')&&!following){postsPanel.appendChild(ui.empty('🔒',privacy.account==='private'?'Private profile':'Followers-only profile',privacy.account==='private'?'Follow and wait for approval to view posts.':'Follow this creator to view follower-only posts.'));return;}
      var postList=el('div',{class:'chl-profile-post-list'});var sentinel=el('div',{class:'chl-load-sentinel',text:'Scroll to load older posts'});postsPanel.appendChild(postList);postsPanel.appendChild(sentinel);var offset=0,pageSize=12,loading=false,hasMore=true;
      async function loadPosts(reset){if(loading)return;loading=true;if(reset){offset=0;hasMore=true;postList.innerHTML='';sentinel.textContent='Loading posts…';}try{var q=sb.from('posts').select('id,author_id,caption,kind,media,cover_url,created_at,view_count,like_count,comment_count,allow_comments,allow_repost').eq('author_id',p.id).eq('is_draft',false).eq('is_test',false).order('created_at',{ascending:false}).range(offset,offset+pageSize-1);var pr=await q;if(pr.error)throw pr.error;var posts=pr.data||[];if(reset&&posts.length===0){sentinel.remove();postList.appendChild(ui.empty('📝','No published posts yet','Published posts will appear here.'));return;}posts.forEach(function(post){postList.appendChild(renderEngagementPost(post));});offset+=posts.length;hasMore=posts.length===pageSize;sentinel.textContent=hasMore?'Scroll to load older posts':'You’re all caught up';if(!hasMore&&observer)observer.disconnect();}catch(error){sentinel.textContent='Could not load posts. Tap to retry.';sentinel.onclick=function(){loadPosts(false);};}finally{loading=false;}}
      var observer=null;if('IntersectionObserver' in window){observer=new IntersectionObserver(function(entries){if(entries.some(function(entry){return entry.isIntersecting;})&&hasMore)loadPosts(false);},{rootMargin:'400px'});observer.observe(sentinel);}else sentinel.addEventListener('click',function(){if(hasMore)loadPosts(false);});
      loadPosts(true);
    }catch(e){content.innerHTML='';content.appendChild(el('div',{class:'note',text:e.message||'Could not load this profile.'}));}
  }
  function renderEngagementPost(post){
    var card=el('article',{class:'card chl-engagement-post'});var heading=el('div',{class:'chl-engagement-post-heading'});heading.appendChild(el('div',{class:'chl-engagement-post-title',text:post.caption||post.kind||'Post'}));heading.appendChild(el('div',{class:'sub',text:CHL.ago(post.created_at)}));card.appendChild(heading);
    var media=Array.isArray(post.media)?post.media:[];var first=media[0];if(post.cover_url||first&&first.url){var url=post.cover_url||first.url;if((first&&first.type==='video')||post.kind==='video'||post.kind==='short'){card.appendChild(el('video',{src:url,poster:post.cover_url||undefined,controls:true,playsinline:true,preload:'metadata',class:'chl-post-media'}));}else card.appendChild(el('img',{src:url,alt:post.caption||'Creator post',loading:'lazy',class:'chl-post-media'}));}
    var stats=el('div',{class:'row wrap',style:'gap:12px;margin-top:10px'});stats.appendChild(el('span',{class:'sub',text:CHL.fmt(post.view_count||0)+' views'}));var likes=el('span',{class:'sub',text:CHL.fmt(post.like_count||0)+' likes'});stats.appendChild(likes);stats.appendChild(el('span',{class:'sub',text:CHL.fmt(post.comment_count||0)+' comments'}));card.appendChild(stats);
    var controls=el('div',{class:'row wrap',style:'gap:8px;margin-top:10px'});if(CHL.user){var likeButton=el('button',{class:'btn',type:'button',text:'♡ Like'});sb.from('likes').select('post_id').eq('post_id',post.id).eq('user_id',CHL.user.id).maybeSingle().then(function(r){if(!r.error&&r.data)likeButton.textContent='♥ Liked';});likeButton.addEventListener('click',async function(){likeButton.disabled=true;try{var exists=likeButton.textContent.indexOf('Liked')>=0;if(exists){var del=await sb.from('likes').delete().eq('post_id',post.id).eq('user_id',CHL.user.id);if(del.error)throw del.error;post.like_count=Math.max(0,(post.like_count||0)-1);likeButton.textContent='♡ Like';}else{var add=await sb.from('likes').insert({post_id:post.id,user_id:CHL.user.id});if(add.error&&add.error.code!=='23505')throw add.error;if(!add.error)post.like_count=(post.like_count||0)+1;likeButton.textContent='♥ Liked';}likes.textContent=CHL.fmt(post.like_count||0)+' likes';}catch(error){CHL.toast(error.message||'Could not update like.');}finally{likeButton.disabled=false;}});controls.appendChild(likeButton);}
    if(CHL.user){var saveButton=el('button',{class:'btn',type:'button',text:'Save'});var savedCollection=null;sb.from('saves').select('collection').eq('post_id',post.id).eq('user_id',CHL.user.id).order('created_at',{ascending:false}).limit(1).maybeSingle().then(function(r){if(!r.error&&r.data){savedCollection=r.data.collection||'default';saveButton.textContent='Saved · '+savedCollection;}});saveButton.addEventListener('click',async function(){saveButton.disabled=true;try{if(savedCollection){var d=await sb.from('saves').delete().eq('post_id',post.id).eq('user_id',CHL.user.id).eq('collection',savedCollection);if(d.error)throw d.error;saveButton.textContent='Save';savedCollection=null;CHL.toast('Post unsaved.');}else{var chosen=window.prompt('Save to collection','default');if(chosen===null)return;chosen=String(chosen||'').trim().slice(0,40);if(!chosen){CHL.toast('Enter a collection name.');return;}var a=await sb.from('saves').insert({post_id:post.id,user_id:CHL.user.id,collection:chosen});if(a.error&&a.error.code!=='23505')throw a.error;saveButton.textContent='Saved · '+chosen;savedCollection=chosen;CHL.toast('Post saved to '+chosen+'.');}}catch(error){CHL.toast(error.message||'Could not save post.');}finally{saveButton.disabled=false;}});controls.appendChild(saveButton);if(post.allow_repost!==false){var repostButton=el('button',{class:'btn',type:'button',text:'Repost'});sb.from('reposts').select('post_id').eq('post_id',post.id).eq('user_id',CHL.user.id).maybeSingle().then(function(r){if(!r.error&&r.data)repostButton.textContent='Reposted';});repostButton.addEventListener('click',async function(){repostButton.disabled=true;try{if(repostButton.textContent==='Reposted'){var d=await sb.from('reposts').delete().eq('post_id',post.id).eq('user_id',CHL.user.id);if(d.error)throw d.error;repostButton.textContent='Repost';}else{var a=await sb.from('reposts').insert({post_id:post.id,user_id:CHL.user.id});if(a.error&&a.error.code!=='23505')throw a.error;repostButton.textContent='Reposted';}CHL.toast(repostButton.textContent==='Reposted'?'Post reposted.':'Repost removed.');}catch(error){CHL.toast(error.message||'Could not repost.');}finally{repostButton.disabled=false;}});controls.appendChild(repostButton);}}
    var share=el('button',{class:'btn',type:'button',text:'Share'});share.addEventListener('click',async function(){var url=window.location.href.split('#')[0]+'#/post/'+encodeURIComponent(post.id);try{if(navigator.share)await navigator.share({title:post.caption||'Creator Hub Live post',url:url});else if(navigator.clipboard&&navigator.clipboard.writeText){await navigator.clipboard.writeText(url);CHL.toast('Post link copied.');}else window.prompt('Copy this post link',url);}catch(error){if(error&&error.name!=='AbortError')CHL.toast('Could not share this post.');}});controls.appendChild(share);
    controls.appendChild(el('a',{class:'btn',href:'#/post/'+post.id,text:'View post & comments'}));card.appendChild(controls);return card;
  }
  async function renderOwnRelations(outlet, profile, kind){
    outlet.innerHTML='';var isFollowers=kind==='followers',isFriends=kind==='friends';outlet.appendChild(ui.pageHead(isFollowers?'Your followers':isFriends?'Your friends':'People you follow','Browse your community.'));var back=el('a',{href:'#/profile',class:'btn',text:'Back to profile'});outlet.appendChild(back);var panel=el('section',{class:'card',style:'margin-top:12px'});outlet.appendChild(panel);var list=el('div',{class:'chl-profile-relations'});var sentinel=el('div',{class:'chl-load-sentinel',text:'Loading accounts…'});panel.appendChild(list);panel.appendChild(sentinel);var offset=0,busy=false,more=true,observer=null;
    async function load(){if(busy||!more)return;busy=true;try{var q=isFollowers?sb.from('follows').select('follower_id,created_at').eq('followee_id',profile.id).eq('status','accepted'):sb.from('follows').select('followee_id,created_at').eq('follower_id',profile.id).eq('status','accepted');var edges=await q.order('created_at',{ascending:false}).range(offset,offset+49);if(edges.error)throw edges.error;var rawRows=edges.data||[];offset+=rawRows.length;more=rawRows.length===50;var rows=rawRows;if(isFriends&&rawRows.length){var outgoing=rawRows.map(function(x){return x.followee_id;});var incoming=await sb.from('follows').select('follower_id').eq('followee_id',profile.id).eq('status','accepted').in('follower_id',outgoing);if(incoming.error)throw incoming.error;var mutual=new Set((incoming.data||[]).map(function(x){return String(x.follower_id);}));rows=rawRows.filter(function(x){return mutual.has(String(x.followee_id));}).map(function(x){return {follower_id:x.followee_id,created_at:x.created_at};});}var ids=rows.map(function(x){return isFollowers?x.follower_id:isFriends?x.follower_id:x.followee_id;});if(!ids.length&&(offset===0||!more)&&!list.children.length){list.appendChild(ui.empty('👥',isFollowers?'No followers yet':isFriends?'No mutual friends yet':'You are not following anyone yet','Your community lists update as people follow or unfollow.'));sentinel.remove();return;}if(ids.length){var people=await sb.from('profiles').select('id,username,display_name,avatar_url,bio').in('id',ids);if(people.error)throw people.error;var sorted=people.data||[];sorted.sort(function(a,b){return ids.indexOf(a.id)-ids.indexOf(b.id);});sorted.forEach(function(person){var name=person.display_name||person.username||'Creator';list.appendChild(el('a',{class:'chl-profile-person',href:'#/profile/'+encodeURIComponent(person.username)},[person.avatar_url?el('img',{src:person.avatar_url,alt:'',class:'chl-profile-person-avatar'}):el('div',{class:'ava chl-profile-person-avatar',text:CHL.initials(name).toUpperCase()}),el('div',{style:'flex:1;min-width:0'},[el('strong',{text:name}),el('div',{class:'sub',text:'@'+person.username})]),el('span',{class:'sub',text:'View profile →'})]));});}sentinel.textContent=more?'Scroll to load more accounts':'End of list';if(!more&&observer)observer.disconnect();}catch(error){sentinel.textContent='Could not load accounts. Tap to retry.';sentinel.onclick=load;}finally{busy=false;}}
    if('IntersectionObserver' in window){observer=new IntersectionObserver(function(entries){if(entries.some(function(entry){return entry.isIntersecting;}))load();},{rootMargin:'300px'});observer.observe(sentinel);}else sentinel.addEventListener('click',load);load();
  }
  CHL.route('/my-profile/followers',function(o){if(!CHL.user){CHL.navigate('#/login');return;}renderOwnRelations(o,CHL.profile||{id:CHL.user.id},'followers');});
  CHL.route('/my-profile/following',function(o){if(!CHL.user){CHL.navigate('#/login');return;}renderOwnRelations(o,CHL.profile||{id:CHL.user.id},'following');});
  CHL.route('/my-profile/friends',function(o){if(!CHL.user){CHL.navigate('#/login');return;}renderOwnRelations(o,CHL.profile||{id:CHL.user.id},'friends');});
  CHL.renderProfilePost = renderEngagementPost;
  CHL.renderOwnProfileRef = null; // own-profile handler lives in pages-wallet; delegate
  function renderOwnProfile(o){ if (CHL.ownProfile) CHL.ownProfile(o); }
})();
