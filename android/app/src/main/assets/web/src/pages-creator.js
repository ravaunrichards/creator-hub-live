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
    {h:'#/creator/live',label:'LIVE'},{h:'#/creator/live/history',label:'Session history'},
    {h:'#/creator/live/schedule',label:'Schedule'},{h:'#/creator/earnings',label:'Earnings'},
    {h:'#/creator/subscriptions',label:'Subscribers'},{h:'#/creator/gifts',label:'Gifts'}
  ];

  /* ---- creator overview + subpages ---- */
  CHL.route('/creator', function(o){
    if (guard(o,'Creator Center','Manage your content, LIVE, earnings and subscribers.')) return;
    if(!CHL.user){o.appendChild(ui.empty('🔐','Sign in required','Sign in to open Creator Center.',el('a',{href:'#/login',class:'btn primary'},'Sign in')));return;}
    o.appendChild(subnav(CREATOR_NAV));
    var stat=el('div',{class:'grid stat'}); o.appendChild(stat);
    stat.appendChild(ui.statCard('\u2026','Followers')); stat.appendChild(ui.statCard('\u2026','Streams')); stat.appendChild(ui.statCard('\u2026','Diamonds'));
    Promise.all([
      sb.from('follows').select('*',{count:'exact',head:true}).eq('followee_id',CHL.user.id),
      sb.from('live_sessions').select('*',{count:'exact',head:true}).eq('host_id',CHL.user.id),
      sb.from('wallets').select('diamond_balance').eq('user_id',CHL.user.id).maybeSingle()
    ]).then(function(res){ if(res.some(function(x){return x.error;}))throw (res.find(function(x){return x.error;}).error); stat.innerHTML='';
      stat.appendChild(ui.statCard(CHL.fmt(res[0].count||0),'Followers'));
      stat.appendChild(ui.statCard(CHL.fmt(res[1].count||0),'Streams'));
      stat.appendChild(ui.statCard(CHL.fmt((res[2].data&&res[2].data.diamond_balance)||0),'Diamonds'));
    }).catch(function(e){stat.innerHTML='';stat.appendChild(el('div',{class:'note',text:'Creator metrics could not be loaded: '+(e.message||'request failed')}));});
    o.appendChild(el('div',{class:'row wrap',style:'gap:10px;margin-top:16px'},[
      el('a',{href:'#/create',class:'btn primary'},'\u25B6 Go LIVE'),
      el('a',{href:'#/creator/analytics',class:'btn'},'View analytics')
    ]));
  });
CHL.route('/creator/analytics', function(o){
    if (guard(o,'Creator Analytics','Real metrics from your account — calculated from saved posts, follows, LIVE sessions and the verified gift ledger.')) return;
    o.appendChild(subnav(CREATOR_NAV));
    if (!CHL.user) { o.appendChild(ui.empty('🔐','Sign in required','Sign in to view your private creator analytics.',el('a',{href:'#/login',class:'btn primary'},'Sign in'))); return; }
    var grid=el('div',{class:'grid stat'});o.appendChild(grid);grid.appendChild(ui.spinner());
    sb.rpc('get_my_creator_metrics').then(function(r){
      if(r.error)throw r.error;var m=r.data||{};grid.innerHTML='';
      [['followers','Followers'],['following','Following'],['posts','Published posts'],['views','Post views'],['likes','Likes'],['comments','Comments'],['streams','LIVE sessions'],['live_now','Live now'],['viewer_events','Recorded LIVE viewers'],['gifts_received','Gifts received'],['diamonds_from_gifts','Diamonds from gifts'],['coins_spent_gifting','Coins spent gifting']].forEach(function(x){grid.appendChild(ui.statCard(CHL.fmt(Number(m[x[0]])||0),x[1]));});
      o.appendChild(el('div',{class:'note',text:'These are cumulative totals from available database records, not estimated reach or third-party TikTok analytics. Watch time and external platform metrics are unavailable unless a verified provider integration supplies them.'}));
    }).catch(function(e){grid.innerHTML='';grid.appendChild(el('div',{class:'note',text:'Analytics unavailable: '+(e.message||'request failed')+'. Confirm migration 0023 and access to get_my_creator_metrics().' }));});
  });
  CHL.route('/creator/live', function(o){
    if (guard(o,'LIVE Center','Start a broadcast and manage your current stream.')) return;
    if(!CHL.user){o.appendChild(ui.empty('🔐','Sign in required','Sign in before starting or managing a LIVE.',el('a',{href:'#/login',class:'btn primary'},'Sign in')));return;}
    o.appendChild(subnav(CREATOR_NAV));
    o.appendChild(el('a',{href:'#/create',class:'btn primary'},'\u25B6 Start a new LIVE'));
  });
CHL.route('/creator/live/history', function(o){
    if (guard(o,'LIVE Session History','Real past sessions only. Replay controls appear when a verified recording provider is connected.')) return;
    o.appendChild(subnav(CREATOR_NAV));
    if (!CHL.user) { o.appendChild(ui.empty('🔐','Sign in required','Sign in to view your LIVE session history.',el('a',{href:'#/login',class:'btn primary'},'Sign in'))); return; }
    var list=el('div',{class:'grid',style:'grid-template-columns:minmax(0,1fr);gap:8px'});o.appendChild(list);list.appendChild(ui.spinner());
    sb.from('live_sessions').select('id,title,started_at,ended_at,status,viewer_count').eq('host_id',CHL.user.id).order('started_at',{ascending:false}).limit(50).then(function(r){
      if(r.error)throw r.error;list.innerHTML='';var rows=r.data||[];
      if(!rows.length){list.appendChild(ui.empty('📺','No LIVE sessions yet','Your saved broadcast sessions appear after you start a LIVE.'));return;}
      rows.forEach(function(x){list.appendChild(el('div',{class:'tile',style:'min-width:0;overflow-wrap:anywhere'},[
        el('div',{class:'meta',style:'min-width:0'},[el('div',{class:'t',text:x.title||'Untitled LIVE'}),el('div',{class:'u',text:(x.started_at?new Date(x.started_at).toLocaleString():'Start time unavailable')+' · '+String(x.status||'unknown').toUpperCase()}),el('div',{class:'u',text:CHL.fmt(Number(x.viewer_count)||0)+' recorded viewer count'+(x.ended_at?' · Ended '+new Date(x.ended_at).toLocaleString():'')})]),el('a',{href:'#/live/'+x.id,class:'btn small'},'Open session')
      ]));});
    }).catch(function(e){list.innerHTML='';list.appendChild(el('div',{class:'note',text:'LIVE history could not be loaded: '+(e.message||'request failed')}));});
  });
  CHL.route('/creator/live/schedule', function(o){
    if (guard(o,'LIVE Schedule','Create and cancel upcoming LIVE plans. Scheduling notifies followers in the app; it never starts a broadcast automatically.')) return;
    o.appendChild(subnav(CREATOR_NAV));
    if (!CHL.user) { o.appendChild(ui.empty('🔐','Sign in required','Sign in to schedule a LIVE.',el('a',{href:'#/login',class:'btn primary'},'Sign in'))); return; }
    var card=el('div',{class:'card',style:'max-width:780px;min-width:0;margin-bottom:14px'});card.appendChild(el('h3',{class:'section-title',text:'Schedule a LIVE'}));var f=el('form',{class:'form-stack'});
    f.appendChild(ui.field('LIVE title','title','What will you go LIVE about?'));f.appendChild(ui.field('Description','description','Optional details'));
    var category=el('select',{class:'input',name:'category'},['Just Chatting','Music','Gaming','IRL','Dance','Sports','Education','Culture','Other'].map(function(x){return el('option',{value:x,text:x});}));f.appendChild(el('label',{class:'field'},[el('span',{text:'Category'}),category]));
    var starts=el('input',{class:'input',name:'starts_at',type:'datetime-local',required:true});var minDate=new Date(Date.now()+60000);starts.min=new Date(minDate.getTime()-minDate.getTimezoneOffset()*60000).toISOString().slice(0,16);f.appendChild(el('label',{class:'field'},[el('span',{text:'Start time (device time zone)'}),starts]));
    var audience=el('select',{class:'input',name:'audience'},[['public','Public'],['followers','Followers only'],['private','Private']].map(function(x){return el('option',{value:x[0],text:x[1]});}));f.appendChild(el('label',{class:'field'},[el('span',{text:'Audience'}),audience]));
    var notify=el('input',{type:'checkbox',name:'notify_followers',checked:true});f.appendChild(el('label',{class:'row',style:'gap:8px;align-items:center'},[notify,el('span',{text:'Notify followers who allow LIVE notifications'})]));var feedback=el('div',{});f.appendChild(el('div',{class:'row wrap',style:'gap:8px'},[el('button',{class:'btn primary',type:'submit'},'Save schedule'),el('a',{href:'#/schedule',class:'btn'},'View public schedule')]));f.appendChild(feedback);card.appendChild(f);o.appendChild(card);
    f.addEventListener('submit',async function(e){e.preventDefault();feedback.innerHTML='';var date=new Date(starts.value);if(!f.elements.title.value.trim()||!Number.isFinite(date.getTime())||date.getTime()<=Date.now()){feedback.appendChild(el('div',{class:'note',text:'Enter a title and choose a valid future date and time.'}));return;}var button=f.querySelector('button[type=submit]');button.disabled=true;try{var r=await sb.from('live_schedules').insert({creator_id:CHL.user.id,title:f.elements.title.value.trim(),description:f.elements.description.value.trim(),category:category.value,starts_at:date.toISOString(),audience:audience.value,notify_followers:notify.checked,status:'scheduled'}).select('id').single();if(r.error)throw r.error;feedback.appendChild(el('div',{class:'note',text:'LIVE schedule saved. It will not automatically start your camera or broadcast.'}));f.reset();notify.checked=true;loadSchedules();}catch(err){feedback.appendChild(el('div',{class:'note',text:'Could not save schedule: '+(err.message||'request failed')+'. Confirm migration 0023 is applied.'}));}finally{button.disabled=false;}});
    var schedules=el('div',{class:'grid',style:'grid-template-columns:minmax(0,1fr);gap:8px'});o.appendChild(el('h3',{class:'section-title',text:'Your upcoming schedules'}));o.appendChild(schedules);
    function loadSchedules(){schedules.innerHTML='';schedules.appendChild(ui.spinner());sb.from('live_schedules').select('id,title,description,category,starts_at,audience,status,notify_followers').eq('creator_id',CHL.user.id).eq('status','scheduled').order('starts_at',{ascending:true}).limit(50).then(function(r){if(r.error)throw r.error;schedules.innerHTML='';var rows=r.data||[];if(!rows.length){schedules.appendChild(ui.empty('📅','Nothing scheduled','Your saved upcoming broadcasts appear here.'));return;}rows.forEach(function(x){var cancel=el('button',{class:'btn small',type:'button',text:'Cancel schedule',onclick:async function(e){var b=e.currentTarget;if(!window.confirm('Cancel this scheduled LIVE?'))return;b.disabled=true;try{var u=await sb.from('live_schedules').update({status:'cancelled'}).eq('id',x.id).eq('creator_id',CHL.user.id);if(u.error)throw u.error;CHL.toast('Schedule cancelled.');loadSchedules();}catch(err){CHL.toast(err.message||'Could not cancel schedule.');b.disabled=false;}}});schedules.appendChild(el('div',{class:'tile',style:'min-width:0;overflow-wrap:anywhere'},[el('div',{class:'meta',style:'min-width:0'},[el('div',{class:'t',text:x.title}),el('div',{class:'u',text:new Date(x.starts_at).toLocaleString()+' · '+x.category+' · '+x.audience}),x.description?el('div',{class:'u',text:x.description}):null]),cancel]));});}).catch(function(e){schedules.innerHTML='';schedules.appendChild(el('div',{class:'note',text:'Schedules unavailable: '+(e.message||'request failed')}));});}
    loadSchedules();
  });
  CHL.route('/schedule', function(o){
    if (guard(o,'LIVE Schedule','Upcoming public creator broadcasts published by real accounts.')) return;
    o.appendChild(el('div',{class:'row wrap',style:'gap:8px;margin-bottom:12px'},[el('a',{href:'#/creator/live/schedule',class:'btn primary'},'＋ Schedule a LIVE'),el('a',{href:'#/discover',class:'btn'},'Live now')]));var list=el('div',{class:'grid',style:'grid-template-columns:minmax(0,1fr);gap:8px'});o.appendChild(list);list.appendChild(ui.spinner());
    sb.from('live_schedules').select('id,creator_id,title,description,category,starts_at,creator:profiles!live_schedules_creator_id_fkey(username,display_name)').eq('status','scheduled').eq('audience','public').gte('starts_at',new Date().toISOString()).order('starts_at',{ascending:true}).limit(60).then(function(r){if(r.error)throw r.error;list.innerHTML='';var rows=r.data||[];if(!rows.length){list.appendChild(ui.empty('📅','No public LIVE schedules yet','When creators publish upcoming broadcasts, they will appear here.'));return;}rows.forEach(function(x){var p=x.creator||{};list.appendChild(el('div',{class:'tile',style:'min-width:0;overflow-wrap:anywhere'},[el('div',{class:'meta',style:'min-width:0'},[el('div',{class:'t',text:x.title}),el('div',{class:'u',text:(p.display_name||p.username||'Creator')+' · '+new Date(x.starts_at).toLocaleString()+' · '+x.category}),x.description?el('div',{class:'u',text:x.description}):null]),el('a',{href:'#/profile/'+encodeURIComponent(p.username||''),class:'btn small'},'Creator profile')]));});}).catch(function(e){list.innerHTML='';list.appendChild(el('div',{class:'note',text:'Public schedule unavailable: '+(e.message||'request failed')+'. Confirm migration 0023 is applied.'}));});
  });
  CHL.route('/creator/earnings', function(o){
    if (guard(o,'Earnings','Diamond balance and creator payout requests from the server-authoritative ledger.')) return;
    if(!CHL.user){o.appendChild(ui.empty('🔐','Sign in required','Sign in to view balances and payout requests.',el('a',{href:'#/login',class:'btn primary'},'Sign in')));return;}
    o.appendChild(subnav(CREATOR_NAV));
    var stat=el('div',{class:'grid stat'}); o.appendChild(stat);
    stat.appendChild(ui.statCard('…','Diamond balance'));
    stat.appendChild(ui.statCard('…','Pending requests'));
    stat.appendChild(ui.statCard('…','Paid requests'));
    o.appendChild(el('div',{class:'note',style:'margin:12px 0'},'PayPal is the initial payout destination. Diamond-to-currency conversion is not configured in this release, so an authorized administrator must confirm the actual fiat amount. Requests reserve/deduct diamonds when submitted. Rejected requests are refunded by the server ledger.'));
    var requestCard=el('div',{class:'card',style:'max-width:700px;min-width:0;margin-bottom:14px'});
    requestCard.appendChild(el('div',{class:'t',text:'Request a payout'}));
    requestCard.appendChild(el('div',{class:'u',text:'Save a PayPal email in Settings → Payments first. Submitting a request does not send money automatically.'}));
    var form=el('form',{style:'display:flex;gap:10px;flex-wrap:wrap;align-items:flex-end;margin-top:12px'});
    var amount=el('input',{class:'input',type:'number',name:'amount',min:'1',max:'1000000000',step:'1',inputmode:'numeric',required:true,placeholder:'Whole number of diamonds'});
    var amountWrap=el('label',{class:'field',style:'flex:1 1 220px;min-width:0'},[el('span',{text:'Diamonds to request'}),amount]);
    var submit=el('button',{class:'btn primary',type:'submit'},'Submit payout request');
    var feedback=el('div',{style:'width:100%'});form.appendChild(amountWrap);form.appendChild(submit);form.appendChild(feedback);requestCard.appendChild(form);o.appendChild(requestCard);
    var history=el('div',{class:'card',style:'min-width:0;overflow:auto'});history.appendChild(el('div',{class:'t',text:'Payout request history'}));o.appendChild(history);
    var requestKey=newPayoutKey();
    form.addEventListener('submit',async function(event){
      event.preventDefault();feedback.innerHTML='';
      var n=Number(amount.value);
      if(!Number.isSafeInteger(n)||n<=0||n>1000000000){feedback.appendChild(el('div',{class:'note',text:'Enter a whole-number amount between 1 and 1,000,000,000 diamonds.'}));return;}
      submit.disabled=true;submit.textContent='Submitting…';
      try{
        var result=await CHL.authenticatedApiRequest('/api/creator/payouts',{method:'POST',headers:{'Idempotency-Key':requestKey},body:{amount:n}});
        if(!result||!result.request||!result.request.id)throw new Error('The backend did not confirm the request. Refresh payout history before retrying.');
        feedback.appendChild(el('div',{class:'note',text:'Payout request recorded. Reference: '+result.request.reference+'. No PayPal transfer has been sent yet.'}));
        amount.value='';requestKey=newPayoutKey();loadBalance();loadHistory();
      }catch(error){feedback.appendChild(el('div',{class:'note',text:(error&&error.message)||'Could not submit payout request.'}));}
      finally{submit.disabled=false;submit.textContent='Submit payout request';}
    });
    function newPayoutKey(){return 'creator-payout-'+(window.crypto&&typeof window.crypto.randomUUID==='function'?window.crypto.randomUUID():(Date.now().toString(36)+'-'+Math.random().toString(36).slice(2)+'-'+Math.random().toString(36).slice(2)));}
    function loadBalance(){
      CHL.authenticatedApiRequest('/api/wallet').then(function(r){stat.children[0].querySelector('.stat-v').textContent=CHL.fmt(Number(r&&r.diamondBalance)||0);})
        .catch(function(){stat.children[0].querySelector('.stat-v').textContent='Unavailable';});
    }
    function loadHistory(){
      history.innerHTML='';history.appendChild(el('div',{class:'t',text:'Payout request history'}));history.appendChild(ui.spinner());
      CHL.authenticatedApiRequest('/api/creator/payouts').then(function(r){
        history.innerHTML='';history.appendChild(el('div',{class:'t',text:'Payout request history'}));
        var rows=r&&r.requests||[];
        stat.children[1].querySelector('.stat-v').textContent=CHL.fmt(rows.filter(function(x){return x.status==='pending'||x.status==='approved';}).length);
        stat.children[2].querySelector('.stat-v').textContent=CHL.fmt(rows.filter(function(x){return x.status==='paid';}).length);
        if(!rows.length){history.appendChild(ui.empty('💰','No payout requests yet','Your payout request history will appear here after you submit a request.'));return;}
        rows.forEach(function(x){
          var lines=[el('div',{class:'t',text:CHL.fmt(Number(x.amount)||0)+' diamonds · '+String(x.status||'unknown').toUpperCase()}),el('div',{class:'u',text:'Created: '+(x.created_at?new Date(x.created_at).toLocaleString():'—')}),el('div',{class:'u',text:'Reference: '+String(x.reference||'—')}),el('div',{class:'u',text:x.fiat_amount!=null?'Recorded payout: '+String(x.fiat_currency||'USD')+' '+Number(x.fiat_amount).toFixed(2):'Fiat amount has not been confirmed.'})];
          if(x.admin_note)lines.push(el('div',{class:'u',text:'Administrator note: '+x.admin_note}));
          if(x.paypal_transaction_id)lines.push(el('div',{class:'u',text:'PayPal transaction: '+x.paypal_transaction_id}));
          history.appendChild(el('div',{class:'tile',style:'margin-top:10px;min-width:0;overflow-wrap:anywhere'},lines));
        });
      }).catch(function(error){history.innerHTML='';history.appendChild(el('div',{class:'t',text:'Payout request history'}));history.appendChild(el('div',{class:'note',text:(error&&error.message)||'Could not load payout history.'}));});
    }
    loadBalance();loadHistory();
  });
CHL.route('/creator/subscriptions', function(o){
    if (guard(o,'Subscribers & Membership Tiers','Manage public tier information and review subscriptions stored in the database.')) return;
    o.appendChild(subnav(CREATOR_NAV));if(!CHL.user){o.appendChild(ui.empty('🔐','Sign in required','Sign in to manage creator tiers.',el('a',{href:'#/login',class:'btn primary'},'Sign in')));return;}
    var formCard=el('div',{class:'card',style:'max-width:780px;min-width:0;margin-bottom:14px'});formCard.appendChild(el('h3',{class:'section-title',text:'Create a membership tier'}));var f=el('form',{class:'form-stack'});f.appendChild(ui.field('Tier name','name','Supporter'));f.appendChild(ui.field('Monthly price (USD)','price','4.99','number'));f.elements.price.min='0.5';f.elements.price.max='10000';f.elements.price.step='0.01';f.appendChild(ui.field('Badge (optional)','badge','Supporter'));f.appendChild(ui.field('Emoji (optional)','emoji','⭐'));var perks=el('textarea',{class:'input',name:'perks',rows:'3',maxlength:'1000',placeholder:'One perk per line'});f.appendChild(el('label',{class:'field'},[el('span',{text:'Perks — one per line'}),perks]));var msg=el('div',{});var save=el('button',{class:'btn primary',type:'submit'},'Save tier');f.appendChild(save);f.appendChild(msg);formCard.appendChild(f);o.appendChild(formCard);
    f.addEventListener('submit',async function(e){e.preventDefault();msg.innerHTML='';var name=f.elements.name.value.trim(),price=Number(f.elements.price.value);if(!name||!Number.isFinite(price)||price<0.5||price>10000){msg.appendChild(el('div',{class:'note',text:'Enter a tier name and valid monthly price from $0.50 to $10,000 USD.'}));return;}save.disabled=true;try{var r=await sb.from('subscription_tiers').insert({creator_id:CHL.user.id,name:name,price:price,currency:'USD',badge:f.elements.badge.value.trim()||null,emoji:f.elements.emoji.value.trim()||null,perks:f.elements.perks.value.split(/\r?\n/).map(function(x){return x.trim();}).filter(Boolean).slice(0,12),active:true}).select('id').single();if(r.error)throw r.error;msg.appendChild(el('div',{class:'note',text:'Tier saved. Recurring billing is not enabled until a real billing provider and verified webhook are configured; no payment has been taken.'}));f.reset();loadTiers();}catch(err){msg.appendChild(el('div',{class:'note',text:'Could not save tier: '+(err.message||'request failed')+'. Confirm migration 0023 and subscription_tiers policies.'}));}finally{save.disabled=false;}});
    var tiers=el('div',{class:'grid',style:'grid-template-columns:minmax(0,1fr);gap:8px'});o.appendChild(el('h3',{class:'section-title',text:'Your tiers and recorded subscriber counts'}));o.appendChild(tiers);
    function loadTiers(){tiers.innerHTML='';tiers.appendChild(ui.spinner());sb.from('subscription_tiers').select('id,name,price,currency,badge,emoji,perks,active').eq('creator_id',CHL.user.id).order('price',{ascending:true}).then(async function(r){if(r.error)throw r.error;tiers.innerHTML='';var rows=r.data||[];if(!rows.length){tiers.appendChild(ui.empty('⭐','No tiers yet','Create a tier above. Active tiers are listed publicly.'));return;}for(var i=0;i<rows.length;i++){var x=rows[i],sr=await sb.from('subscriptions').select('id,status,subscriber_id,created_at').eq('tier_id',x.id).order('created_at',{ascending:false}).limit(100);if(sr.error)throw sr.error;var count=(sr.data||[]).filter(function(y){return y.status==='active';}).length;var toggle=el('button',{class:'btn small',type:'button',text:x.active?'Deactivate':'Activate',onclick:async function(tier,e){var b=e.currentTarget;b.disabled=true;try{var u=await sb.from('subscription_tiers').update({active:!tier.active}).eq('id',tier.id).eq('creator_id',CHL.user.id);if(u.error)throw u.error;loadTiers();}catch(err){CHL.toast(err.message||'Could not update tier.');b.disabled=false;}}.bind(null,x)});tiers.appendChild(el('div',{class:'tile',style:'min-width:0;overflow-wrap:anywhere'},[el('div',{class:'meta',style:'min-width:0'},[el('div',{class:'t',text:(x.emoji||'⭐')+' '+x.name+' · '+x.currency+' '+Number(x.price).toFixed(2)+'/month'}),el('div',{class:'u',text:(x.active?'Public offer':'Inactive offer')+' · '+count+' active recorded subscription(s)'}),el('div',{class:'u',text:(Array.isArray(x.perks)?x.perks:[]).join(' · ')||'No perks listed'})]),el('div',{class:'row wrap',style:'gap:6px'},[toggle])]));}}).catch(function(e){tiers.innerHTML='';tiers.appendChild(el('div',{class:'note',text:'Tier list unavailable: '+(e.message||'request failed')}));});}
    loadTiers();
  });
  CHL.route('/creator/gifts', function(o){renderGiftHistory(o,'received');});
  CHL.route('/gifts', function(o){renderGiftHistory(o,'both');});
  async function renderGiftHistory(o,mode){
    if (guard(o,mode==='received'?'Gifts Received':'Gift History','Real gift transactions only. Wallet changes come from the server-authoritative gift ledger.')) return;
    if(!CHL.user){o.appendChild(ui.empty('🔐','Sign in required','Sign in to view gift history.',el('a',{href:'#/login',class:'btn primary'},'Sign in')));return;}
    var totals=el('div',{class:'grid stat'});o.appendChild(totals);var list=el('div',{class:'grid',style:'grid-template-columns:minmax(0,1fr);gap:8px'});o.appendChild(list);list.appendChild(ui.spinner());
    try{var q=sb.from('gift_transactions').select('id,gift_id,sender_id,recipient_id,coin_cost,diamond_value,created_at');q=mode==='received'?q.eq('recipient_id',CHL.user.id):q.or('sender_id.eq.'+CHL.user.id+',recipient_id.eq.'+CHL.user.id);var r=await q.order('created_at',{ascending:false}).limit(100);if(r.error)throw r.error;var rows=r.data||[];var coins=rows.reduce(function(a,x){return a+(x.sender_id===CHL.user.id?Number(x.coin_cost)||0:0);},0),diamonds=rows.reduce(function(a,x){return a+(x.recipient_id===CHL.user.id?Number(x.diamond_value)||0:0);},0);totals.appendChild(ui.statCard(CHL.fmt(rows.length),'Gift transactions'));totals.appendChild(ui.statCard(CHL.fmt(coins),'Coins sent'));totals.appendChild(ui.statCard(CHL.fmt(diamonds),'Diamonds received'));if(!rows.length){list.appendChild(ui.empty('🎁','No gifts recorded yet','Transactions appear here after successful server-confirmed gifts.'));return;}var giftIds=[...new Set(rows.map(function(x){return x.gift_id;}))],userIds=[...new Set(rows.map(function(x){return x.sender_id===CHL.user.id?x.recipient_id:x.sender_id;}))];var gs=await sb.from('gifts').select('id,name,graphic_url,coin_price,diamond_value').in('id',giftIds);if(gs.error)throw gs.error;var ps=await sb.from('profiles').select('id,username,display_name').in('id',userIds);if(ps.error)throw ps.error;var gm={},pm={};(gs.data||[]).forEach(function(x){gm[x.id]=x;});(ps.data||[]).forEach(function(x){pm[x.id]=x;});rows.forEach(function(x){var g=gm[x.gift_id]||{},otherId=x.sender_id===CHL.user.id?x.recipient_id:x.sender_id,p=pm[otherId]||{},label=x.sender_id===CHL.user.id?'Sent to ':'Received from ';list.appendChild(el('div',{class:'tile',style:'min-width:0;overflow-wrap:anywhere'},[el('div',{style:'font-size:22px',text:'🎁'}),el('div',{class:'meta',style:'min-width:0'},[el('div',{class:'t',text:(g.name||'Gift')+' · '+label+(p.display_name||p.username||'Creator')}),el('div',{class:'u',text:(x.sender_id===CHL.user.id?x.coin_cost+' coins spent':x.diamond_value+' diamonds earned')+' · '+new Date(x.created_at).toLocaleString()}),el('div',{class:'u',text:'Reference '+x.id})])]));});}
    catch(e){list.innerHTML='';list.appendChild(el('div',{class:'note',text:'Gift history unavailable: '+(e.message||'request failed')+'. Check migration 0020 and gift row security.'}));}
  }
  CHL.route('/subscriptions', async function(o){
    if (guard(o,'Creator Memberships','Browse creator tiers and review recorded membership history. No recurring payment is simulated.')) return;
    if(!CHL.user){o.appendChild(ui.empty('🔐','Sign in required','Sign in to review your memberships.',el('a',{href:'#/login',class:'btn primary'},'Sign in')));return;}
    var owned=el('div',{class:'grid',style:'grid-template-columns:minmax(0,1fr);gap:8px'});o.appendChild(el('h3',{class:'section-title',text:'Your subscriptions'}));o.appendChild(owned);owned.appendChild(ui.spinner());
    try{var sr=await sb.from('subscriptions').select('id,tier_id,status,current_period_end,created_at').eq('subscriber_id',CHL.user.id).order('created_at',{ascending:false}).limit(100);if(sr.error)throw sr.error;owned.innerHTML='';var subs=sr.data||[];if(!subs.length)owned.appendChild(ui.empty('⭐','No subscription records','Checkout becomes available after a real billing provider and cancellation/webhook flow are configured. No payment is taken on this screen.'));else{var tids=[...new Set(subs.map(function(x){return x.tier_id;}))];var tr=await sb.from('subscription_tiers').select('id,name,price,currency,creator_id').in('id',tids);if(tr.error)throw tr.error;var creators=[...new Set((tr.data||[]).map(function(x){return x.creator_id;}))];var pr=await sb.from('profiles').select('id,username,display_name').in('id',creators);if(pr.error)throw pr.error;var tm={},pm={};(tr.data||[]).forEach(function(x){tm[x.id]=x;});(pr.data||[]).forEach(function(x){pm[x.id]=x;});subs.forEach(function(x){var t=tm[x.tier_id]||{},p=pm[t.creator_id]||{};owned.appendChild(el('div',{class:'tile'},[el('div',{class:'meta'},[el('div',{class:'t',text:(t.name||'Tier')+' · '+(p.display_name||p.username||'Creator')}),el('div',{class:'u',text:(t.currency||'USD')+' '+Number(t.price||0).toFixed(2)+' · '+String(x.status).toUpperCase()+(x.current_period_end?' · Ends '+new Date(x.current_period_end).toLocaleDateString():'')})])]));});}}
    catch(e){owned.innerHTML='';owned.appendChild(el('div',{class:'note',text:'Subscriptions unavailable: '+(e.message||'request failed')}));}
    var catalog=el('div',{class:'grid',style:'grid-template-columns:minmax(0,1fr);gap:8px'});o.appendChild(el('h3',{class:'section-title',text:'Available creator tiers'}));o.appendChild(catalog);catalog.appendChild(ui.spinner());
    try{var r=await sb.from('subscription_tiers').select('id,creator_id,name,price,currency,badge,emoji,perks').eq('active',true).neq('creator_id',CHL.user.id).order('price',{ascending:true}).limit(100);if(r.error)throw r.error;catalog.innerHTML='';var rows=r.data||[];if(!rows.length){catalog.appendChild(ui.empty('⭐','No active tiers available','Creators have not published active membership tiers yet.'));return;}var ids=[...new Set(rows.map(function(x){return x.creator_id;}))];var ps=await sb.from('profiles').select('id,username,display_name').in('id',ids);if(ps.error)throw ps.error;var map={};(ps.data||[]).forEach(function(x){map[x.id]=x;});rows.forEach(function(x){var p=map[x.creator_id]||{};catalog.appendChild(el('div',{class:'tile',style:'min-width:0'},[el('div',{class:'meta',style:'min-width:0'},[el('div',{class:'t',text:(x.emoji||'⭐')+' '+x.name+' · '+x.currency+' '+Number(x.price).toFixed(2)+'/month'}),el('div',{class:'u',text:'By '+(p.display_name||p.username||'Creator')+(x.badge?' · '+x.badge:'')}),el('div',{class:'u',text:(Array.isArray(x.perks)?x.perks:[]).join(' · ')||'No perks listed'})]),el('a',{href:'#/profile/'+encodeURIComponent(p.username||''),class:'btn small'},'View creator'),el('div',{class:'u',text:'Checkout is unavailable until a billing provider, verified webhooks and cancellation/refund flow are implemented.'})]));});}catch(e){catalog.innerHTML='';catalog.appendChild(el('div',{class:'note',text:'Membership catalog unavailable: '+(e.message||'request failed')+'. Confirm migration 0023 is applied.'}));}
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
      var matchesBox=el('div',{class:'card',style:'min-width:0;margin-top:16px'});
      matchesBox.appendChild(el('h3',{text:'Fixtures and results',style:'margin:0 0 8px'}));
      box.appendChild(matchesBox);
      CHL.authenticatedApiRequest('/api/leagues/matches'+(div?'?division='+encodeURIComponent(div):'')).then(function(matchData){
        var matches=matchData&&matchData.matches||[];
        if(!matches.length){matchesBox.appendChild(ui.empty('⚽','No fixtures published','Fixtures appear after an administrator generates the round-robin schedule. No scores are fabricated.'));return;}
        matches.forEach(function(m){
          var h=Array.isArray(m.home_team)?m.home_team[0]:m.home_team;
          var a=Array.isArray(m.away_team)?m.away_team[0]:m.away_team;
          var home=h&&h.name||String(m.home_team_id||'').slice(0,8);
          var away=a&&a.name||String(m.away_team_id||'').slice(0,8);
          var score=m.home_score==null||m.away_score==null?'—':String(m.home_score)+' : '+String(m.away_score);
          matchesBox.appendChild(el('div',{class:'tile',style:'margin:8px 0;min-width:0;overflow-wrap:anywhere'},[
            el('div',{class:'t',text:home+'  '+score+'  '+away}),
            el('div',{class:'u',text:'Division '+m.division_code+' · Round '+(m.round_number||'—')+' · '+String(m.status||'unknown').toUpperCase()+(m.played_at?' · '+new Date(m.played_at).toLocaleDateString():'')})
          ]));
        });
      }).catch(function(error){matchesBox.appendChild(el('div',{class:'note',text:(error&&error.message)||'Fixtures could not be loaded.'}));});
    }).catch(function(error){
      var detail=(error && error.message) || 'The request failed without a response.';
      var code=(error && error.code) ? ' ['+error.code+']' : '';
      var status=(error && error.status) ? ' (HTTP '+error.status+')' : '';
      box.appendChild(ui.empty('⚠️','Standings unavailable','League request failed: '+detail+code+status));
    });
    o.appendChild(el('div',{class:'note',text:'Standings are calculated on the server from completed match results. Points, rankings, promotion and relegation are not client-editable.'}));
  });
CHL.route('/rankings', function(o){
    if (guard(o,'Creator Rankings','Leaderboards read from real public creator activity. No seeded scores or purchased placements.')) return;
    var selected='followers',tabs=el('div',{class:'row wrap',style:'gap:7px;margin-bottom:12px'}),list=el('div',{class:'grid',style:'grid-template-columns:minmax(0,1fr);gap:8px'});o.appendChild(tabs);o.appendChild(list);
    var defs=[['followers','Followers'],['views','Post views'],['gifts_sent','Coins spent gifting'],['diamonds_received','Diamonds received'],['live_viewers','Live now viewers']];
    defs.forEach(function(x){tabs.appendChild(el('button',{class:'btn small'+(x[0]===selected?' primary':''),type:'button',text:x[1],onclick:function(){selected=x[0];Array.from(tabs.children).forEach(function(b){b.classList.toggle('primary',b.textContent===x[1]);});load();}}));});
    async function load(){list.innerHTML='';list.appendChild(ui.spinner());try{var r=await sb.rpc('get_public_creator_rankings',{p_metric:selected,p_limit:30});if(r.error)throw r.error;list.innerHTML='';var rows=(r.data||[]).filter(function(x){return Number(x.score)>0;});if(!rows.length){list.appendChild(ui.empty('🏆','No ranking activity yet','This leaderboard needs real '+(selected==='followers'?'follower':selected==='views'?'view':selected==='gifts_sent'?'gift transaction':selected==='diamonds_received'?'diamond ledger':'LIVE viewer')+' records. No sample scores are inserted.'));return;}rows.forEach(function(x,i){list.appendChild(el('a',{class:'tile',href:'#/profile/'+encodeURIComponent(x.username),style:'text-decoration:none;min-width:0'},[el('div',{class:'rank-number',text:'#'+(i+1)}),el('div',{class:'ava',text:CHL.initials(x.display_name||x.username).toUpperCase()}),el('div',{class:'meta',style:'min-width:0;flex:1'},[el('div',{class:'t',text:x.display_name||x.username}),el('div',{class:'u',text:'@'+x.username})]),el('div',{style:'font-weight:800;white-space:nowrap'},CHL.fmt(Number(x.score)||0))]));});}catch(e){list.innerHTML='';list.appendChild(el('div',{class:'note',text:'Rankings unavailable: '+(e.message||'request failed')+'. Confirm migration 0023 is applied.'}));}}
    load();
  });
  /* ---- public profile /profile/:username ---- */
  CHL.route('/profile', function(o,r){
    if (!CHL.configured){ o.appendChild(ui.pageHead('Profile')); o.appendChild(ui.setupNotice()); return; }
    if (r.params && r.params.length){ renderPublicProfile(o, r.params[0]); return; }
    if (!CHL.user){ CHL.navigate('#/login'); return; }
    renderOwnProfile(o);
  });

  async function renderPublicProfile(o, handle){
    o.appendChild(ui.spinner());
    var h=String(handle).replace(/^@/,'');
    try{
      var res=await sb.from('profiles').select('id,username,display_name,bio,avatar_url,cover_url,followers_count,following_count,posts_count,privacy').eq('username',h).maybeSingle();
      if(res.error)throw res.error;
      o.innerHTML='';var p=res.data;
      if(!p){o.appendChild(ui.empty('👤','Creator not found','No account exists for @'+h+'.',el('a',{href:'#/discover',class:'btn',style:'margin-top:8px'},'Discover creators')));return;}
      var who=p.display_name||p.username;var relation=null;
      if(CHL.user&&CHL.user.id!==p.id){var fr=await sb.from('follows').select('status').eq('follower_id',CHL.user.id).eq('followee_id',p.id).maybeSingle();if(!fr.error)relation=fr.data;}
      var actions=el('div',{class:'row wrap',style:'gap:8px'});
      if(CHL.user&&CHL.user.id!==p.id){
        var followBtn=el('button',{class:'btn primary',type:'button',text:relation?(relation.status==='pending'?'Requested':'Following'):'＋ Follow',onclick:async function(){
          if(!CHL.user){CHL.navigate('#/login');return;}followBtn.disabled=true;
          try{if(relation){var d=await sb.from('follows').delete().eq('follower_id',CHL.user.id).eq('followee_id',p.id);if(d.error)throw d.error;relation=null;followBtn.textContent='＋ Follow';CHL.toast('Unfollowed @'+p.username);}else{var privacy=(p.privacy&&p.privacy.account)||'public';var status=privacy==='public'?'accepted':'pending';var ins=await sb.from('follows').insert({follower_id:CHL.user.id,followee_id:p.id,status:status});if(ins.error)throw ins.error;relation={status:status};followBtn.textContent=status==='pending'?'Requested':'Following';CHL.toast(status==='pending'?'Follow request sent':'Following @'+p.username);}}
          catch(e){CHL.toast(e.message||'Could not update follow.');}finally{followBtn.disabled=false;}
        }});actions.appendChild(followBtn);actions.appendChild(el('button',{class:'btn',type:'button',onclick:async function(){if(!CHL.user){CHL.navigate('#/login');return;}try{var dm=await sb.rpc('create_or_get_direct_conversation',{p_other_user:p.id});if(dm.error)throw dm.error;CHL.navigate('#/messages/'+dm.data);}catch(e){CHL.toast(e.message||'Could not start a conversation. Confirm migration 0021 and the recipient messaging settings.');}}},'Message'));actions.appendChild(el('a',{href:'#/report/user/'+p.id,class:'btn'},'Report'));
      }
      var pic=p.avatar_url&&/^https:\/\//.test(p.avatar_url)?el('img',{src:p.avatar_url,alt:'',loading:'lazy',style:'width:72px;height:72px;object-fit:cover;border-radius:50%'}):el('div',{class:'ava',style:'width:72px;height:72px;font-size:26px;display:flex;align-items:center;justify-content:center',text:CHL.initials(who).toUpperCase()});
      var headCard=el('section',{class:'card profile-header'},[
        el('div',{class:'row wrap',style:'gap:14px;align-items:center'},[pic,el('div',{style:'flex:1;min-width:150px'},[el('div',{style:'font-size:21px;font-weight:800',text:who}),el('div',{class:'u',text:'@'+p.username}),p.bio?el('p',{style:'margin:8px 0 0;white-space:pre-wrap;overflow-wrap:anywhere',text:p.bio}):null]),actions]),
        el('div',{class:'row wrap',style:'gap:20px;margin-top:14px'},[el('div',{},[el('b',{text:CHL.fmt(p.posts_count||0)}),el('span',{class:'u',text:' Posts',style:'margin-left:4px'})]),el('div',{},[el('b',{text:CHL.fmt(p.followers_count||0)}),el('span',{class:'u',text:' Followers',style:'margin-left:4px'})]),el('div',{},[el('b',{text:CHL.fmt(p.following_count||0)}),el('span',{class:'u',text:' Following',style:'margin-left:4px'})])])
      ]);o.appendChild(headCard);
      var wall=el('div',{class:'grid',style:'grid-template-columns:minmax(0,1fr);gap:12px;max-width:820px;margin-top:12px'});o.appendChild(el('h3',{class:'section-title',text:'Public posts'}));o.appendChild(wall);wall.appendChild(ui.spinner());
      var posts=await sb.from('posts').select('id,author_id,kind,caption,media,cover_url,hashtags,sound_id,allow_comments,allow_repost,like_count,comment_count,created_at,author:profiles!posts_author_id_fkey(id,username,display_name)').eq('author_id',p.id).eq('is_draft',false).eq('is_test',false).order('created_at',{ascending:false}).limit(30);
      if(posts.error)throw posts.error;wall.innerHTML='';var rows=posts.data||[];if(!rows.length)wall.appendChild(ui.empty('📝','No public posts yet','This creator has not published any public posts.'));rows.forEach(function(x){wall.appendChild(el('div',{},[CHL.el('a',{href:'#/post/'+x.id,class:'chip',style:'display:inline-flex;margin-bottom:6px'},'Open post'),profilePostPreview(x)]));});
    }catch(e){o.innerHTML='';o.appendChild(el('div',{class:'note',text:e.message||'Could not load this creator profile.'}));}
  }
  function profilePostPreview(p){var who=(p.author&&(p.author.display_name||p.author.username))||'Creator';var box=el('article',{class:'card'});box.appendChild(el('div',{class:'u',text:'@'+(p.author&&p.author.username||'creator')+' · '+CHL.ago(p.created_at)}));box.appendChild(el('div',{style:'white-space:pre-wrap;overflow-wrap:anywhere;margin-top:8px',text:p.caption||''}));(Array.isArray(p.media)?p.media:[]).filter(function(m){return m&&typeof m.url==='string'&&/^https:\/\//.test(m.url);}).slice(0,2).forEach(function(m){box.appendChild(el(m.type&&m.type.indexOf('video')===0?'video':'img',{src:m.url,controls:m.type&&m.type.indexOf('video')===0?'controls':null,alt:'Post media',loading:'lazy',style:'width:100%;max-height:360px;object-fit:contain;border-radius:10px;margin-top:8px'}));});if(Array.isArray(p.hashtags)&&p.hashtags.length)box.appendChild(el('div',{class:'u',text:p.hashtags.map(function(t){return '#'+t;}).join(' '),style:'margin-top:8px'}));return box;}

  CHL.renderOwnProfileRef = null; // own-profile handler lives in pages-wallet; delegate
  function renderOwnProfile(o){ if (CHL.ownProfile) CHL.ownProfile(o); }
})();
