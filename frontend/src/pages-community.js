/* Creator Hub Creator Network — real community features; no seeded scores or automatic money awards. */
(function () {
  'use strict';
  var CHL = window.CHL, el = CHL.el, ui = CHL.ui, sb = CHL.sb;
  function requireUser(outlet, title, description) {
    outlet.appendChild(ui.pageHead(title, description));
    if (!CHL.configured) { var notice = ui.setupNotice(); if (notice) outlet.appendChild(notice); return false; }
    if (!CHL.user) { outlet.appendChild(ui.empty('🔐', 'Sign in required', 'Sign in to use this creator feature.', el('a', { href: '#/login', class: 'btn primary' }, 'Log in'))); return false; }
    return true;
  }
  function err(parent, error, prefix) { parent.innerHTML = ''; parent.appendChild(el('div', { class: 'note', text: (prefix ? prefix + ': ' : '') + ((error && error.message) || 'The request failed. Try again after checking the database migrations and service status.') })); }
  function linkProfile(username) { return '#/profile/' + encodeURIComponent(username); }
  function metricLabel(key) { return ({followers:'followers',posts:'posts',views:'post views',streams:'LIVE sessions',gifts_received:'gifts received',diamonds_from_gifts:'diamonds received',coins_spent_gifting:'coins spent gifting'})[key] || key; }
  function statusChip(status) { return el('span', { class: 'chip', text: String(status || 'unknown').replace(/_/g,' ').toUpperCase() }); }

  CHL.route('/gift-rankings', function (o) {
    o.appendChild(ui.pageHead('Gift Rankings', 'Daily, weekly and monthly leaderboards from completed gift transactions. Rankings are read-only and use actual ledger records.'));
    var period = 'weekly', metric = 'received';
    var periods = el('div', { class: 'row wrap', style: 'gap:7px;margin-bottom:10px' });
    var metrics = el('div', { class: 'row wrap', style: 'gap:7px;margin-bottom:12px' });
    var list = el('div', { class: 'grid', style: 'grid-template-columns:minmax(0,1fr);gap:8px;max-width:820px' });
    [['daily','Last 24 hours'],['weekly','Last 7 days'],['monthly','Last 30 days']].forEach(function (x) { periods.appendChild(el('button', { class: 'btn small' + (x[0] === period ? ' primary' : ''), type: 'button', onclick: function () { period=x[0]; mark(periods,x[0]); load(); } }, x[1])); });
    [['received','Diamonds received'],['sent','Coins spent gifting']].forEach(function (x) { metrics.appendChild(el('button', { class: 'btn small' + (x[0] === metric ? ' primary' : ''), type: 'button', onclick: function () { metric=x[0]; mark(metrics,x[0]); load(); } }, x[1])); });
    o.appendChild(periods); o.appendChild(metrics); o.appendChild(list); load();
    function mark(group, value) { Array.from(group.children).forEach(function (b) { b.classList.toggle('primary', b.dataset.value === value); }); }
    function setValues(group, values) { Array.from(group.children).forEach(function (b, i) { b.dataset.value = values[i][0]; }); }
    setValues(periods,[['daily'],['weekly'],['monthly']]); setValues(metrics,[['received'],['sent']]);
    async function load() {
      list.innerHTML = ''; list.appendChild(ui.spinner());
      try {
        if (!CHL.configured) throw new Error('Supabase is not configured.');
        var r = await sb.rpc('get_public_gift_rankings', { p_period: period, p_metric: metric, p_limit: 50 });
        if (r.error) throw r.error; list.innerHTML = '';
        var rows = (r.data || []).filter(function (x) { return Number(x.score) > 0; });
        if (!rows.length) { list.appendChild(ui.empty('🎁', 'No gift rankings yet', 'This period has no qualifying completed gift transactions. No sample rankings are created.')); return; }
        rows.forEach(function (x, index) { list.appendChild(el('a', { class: 'tile', href: linkProfile(x.username), style: 'text-decoration:none;min-width:0' }, [
          el('div', { class: 'rank-number', text: '#' + (index + 1) }),
          el('div', { class: 'ava', text: CHL.initials(x.display_name || x.username).toUpperCase() }),
          el('div', { class: 'meta', style: 'min-width:0;flex:1' }, [el('div', { class: 't', text: x.display_name || x.username }), el('div', { class: 'u', text: '@' + x.username + ' · ' + CHL.fmt(Number(x.gift_count) || 0) + ' gift transaction(s)' })]),
          el('div', { style: 'font-weight:800;white-space:nowrap' }, CHL.fmt(Number(x.score) || 0))
        ])); });
      } catch (e) { err(list, e, 'Gift rankings unavailable'); }
    }
  });

  CHL.route('/hall-of-fame', function (o) {
    o.appendChild(ui.pageHead('Hall of Fame', 'Creator leaders ranked from existing public records. These are live data views, not manually invented historical winners.'));
    var wrap = el('div', { class: 'grid', style: 'grid-template-columns:minmax(0,1fr);gap:14px;max-width:920px' }); o.appendChild(wrap);
    [['followers','Follower leaders'],['views','Post-view leaders'],['gifts_sent','Gift supporters'],['diamonds_received','Gift recipients']].forEach(function (def) {
      var section = el('section', { class: 'card' }); section.appendChild(el('h2', { class: 'section-title', text: def[1] })); section.appendChild(ui.spinner()); wrap.appendChild(section);
      sb.rpc('get_public_creator_rankings', { p_metric: def[0], p_limit: 10 }).then(function (r) {
        section.innerHTML = ''; section.appendChild(el('h2', { class: 'section-title', text: def[1] }));
        if (r.error) { section.appendChild(el('div', { class: 'note', text: r.error.message || 'This leaderboard is unavailable.' })); return; }
        var rows = (r.data || []).filter(function (x) { return Number(x.score) > 0; });
        if (!rows.length) { section.appendChild(el('div', { class: 'u', text: 'No qualifying records yet.' })); return; }
        rows.slice(0, 3).forEach(function (x, index) { section.appendChild(el('a', { href: linkProfile(x.username), class: 'row', style: 'padding:7px 0;gap:10px;text-decoration:none;min-width:0' }, [el('span', { class: 'rank-number', text: '#' + (index + 1) }), el('span', { style: 'min-width:0;flex:1;overflow-wrap:anywhere', text: (x.display_name || x.username) + ' · @' + x.username }), el('strong', { text: CHL.fmt(Number(x.score) || 0) })])); });
      }).catch(function (e) { section.innerHTML = ''; section.appendChild(el('h2', { class: 'section-title', text: def[1] })); section.appendChild(el('div', { class: 'note', text: e.message || 'Leaderboard request failed.' })); });
    });
    wrap.appendChild(el('div', { class: 'note', text: 'For daily/weekly/monthly gift periods, use Gift Rankings. Hall of Fame lists are based on all-time aggregates exposed by the database ranking function.' }));
  });

  CHL.route('/achievements', async function (o) {
    if (!requireUser(o, 'Achievements & badges', 'Milestones are computed from real creator metrics. No badges or progress are inserted just by opening this page.')) return;
    var grid = el('div', { class: 'grid settings-grid' }); o.appendChild(grid); grid.appendChild(ui.spinner());
    try {
      var r = await sb.rpc('get_my_creator_metrics'); if (r.error) throw r.error;
      var m = r.data || {};
      var definitions = [
        ['first_post','First post','posts',1,'Publish your first post.'],['content_builder','Content builder','posts',10,'Publish 10 posts.'],
        ['first_follower','First follower','followers',1,'Gain a follower.'],['community_builder','Community builder','followers',100,'Reach 100 followers.'],
        ['first_live','First LIVE','streams',1,'Complete a first LIVE session.'],['live_regular','LIVE regular','streams',10,'Host 10 LIVE sessions.'],
        ['first_gift','First gift received','gifts_received',1,'Receive a real gift.'],['gift_creator','Gift creator','diamonds_from_gifts',1000,'Receive 1,000 diamonds from gifts.'],
        ['viewer_magnet','Viewer magnet','views',1000,'Reach 1,000 total post views.']
      ];
      grid.innerHTML = '';
      definitions.forEach(function (d) { var value = Number(m[d[2]]) || 0, earned = value >= d[3]; grid.appendChild(el('article', { class: 'card', style: 'min-width:0' }, [
        el('div', { class: 'row wrap', style: 'justify-content:space-between;gap:8px' }, [el('strong', { text: d[1] }), el('span', { class: 'chip', text: earned ? 'Earned' : 'In progress' })]),
        el('p', { class: 'u', text: d[4] }),
        el('div', { class: 'progress', style: 'height:6px;background:var(--line);border-radius:8px;overflow:hidden;margin:10px 0' }, [el('div', { style: 'height:100%;width:' + Math.min(100,Math.floor(value/d[3]*100)) + '%;background:var(--brand)' })]),
        el('div', { class: 'u', text: CHL.fmt(value) + ' / ' + CHL.fmt(d[3]) + ' ' + metricLabel(d[2]) })
      ])); });
      grid.appendChild(el('div', { class: 'note', text: 'Milestone rules are displayed here and derived from your current account metrics. These are platform achievements, not accredited qualifications or cash rewards.' }));
    } catch (e) { err(grid, e, 'Achievements unavailable'); }
  });

  CHL.route('/missions', async function (o) {
    if (!requireUser(o, 'Challenges & missions', 'Complete a configured mission using actual platform activity. Rewards are reviewed manually and are not automatically credited.')) return;
    var area = el('div', { class: 'grid', style: 'grid-template-columns:minmax(0,1fr);gap:12px;max-width:900px' }); o.appendChild(area); area.appendChild(ui.spinner());
    try {
      var values = await Promise.all([
        sb.from('creator_missions').select('id,title,description,metric_key,target_value,reward_label,reward_details,starts_at,ends_at').eq('active',true).order('created_at',{ascending:false}),
        sb.from('creator_mission_claims').select('id,mission_id,achieved_value,status,reviewer_note,requested_at').eq('user_id',CHL.user.id),
        sb.rpc('get_my_creator_metrics')
      ]);
      values.forEach(function (x) { if (x.error) throw x.error; });
      var missions=values[0].data||[], claims=values[1].data||[], metrics=values[2].data||{}, byMission={}; claims.forEach(function (c) { byMission[c.mission_id]=c; }); area.innerHTML='';
      if (!missions.length) area.appendChild(ui.empty('🎯','No active missions','Administrators have not published an active challenge yet. No sample missions are seeded.'));
      missions.forEach(function (mission) { var actual=Number(metrics[mission.metric_key])||0,target=Number(mission.target_value)||1,claim=byMission[mission.id]; var card=el('article',{class:'card',style:'min-width:0'},[
        el('div',{class:'row wrap',style:'justify-content:space-between;gap:8px'},[el('h2',{class:'section-title',text:mission.title}),claim?statusChip(claim.status):el('span',{class:'chip',text:actual>=target?'Goal reached':'In progress'})]),
        el('p',{text:mission.description||'No additional instructions were provided.'}),
        el('div',{class:'u',text:CHL.fmt(actual)+' / '+CHL.fmt(target)+' '+metricLabel(mission.metric_key)}),
        el('div',{class:'progress',style:'height:6px;background:var(--line);border-radius:8px;overflow:hidden;margin:10px 0'},[el('div',{style:'height:100%;width:'+Math.min(100,Math.floor(actual/target*100))+'%;background:var(--brand)'})]),
        el('strong',{text:'Reward: '+mission.reward_label}),el('p',{class:'u',text:mission.reward_details||'Reward details have not been provided.'})
      ]);
      if (!claim) card.appendChild(el('button',{class:'btn primary',type:'button',disabled:actual<target,onclick:async function(event){var b=event.currentTarget;b.disabled=true;try{var r=await sb.rpc('claim_creator_mission',{p_mission_id:mission.id});if(r.error)throw r.error;CHL.toast('Claim submitted for manual review.');CHL.render();}catch(e){CHL.toast(e.message||'Mission claim failed. Confirm migration 0024 is applied.');b.disabled=false;}}},actual>=target?'Claim reward for review':'Complete the goal to claim'));
      else if(claim.reviewer_note) card.appendChild(el('div',{class:'note',text:'Reviewer note: '+claim.reviewer_note}));
      area.appendChild(card);
      });
      area.appendChild(el('div',{class:'note',text:'Only administrators can create missions and review reward claims. A claim is not a promise that a prize has been delivered. No coin or diamond balance is changed by mission claims.'}));
    } catch (e) { err(area, e, 'Missions unavailable'); }
  });

  CHL.route('/battles', async function (o) {
    if (!requireUser(o, 'Creator Battles', 'Invite another creator to a planned battle. Invitations have real statuses; the platform does not invent scores, winners or prizes.')) return;
    var formCard = el('section', { class: 'card form-stack', style: 'max-width:900px' });
    formCard.appendChild(el('h2', { class: 'section-title', text: 'Invite a creator' }));
    var search = el('form', { class: 'row wrap', style: 'gap:8px', onsubmit: function (event) { event.preventDefault(); searchCreators(search.query.value.trim()); } });
    search.appendChild(el('input', { class: 'input', name: 'query', placeholder: 'Search by creator name or @username', style: 'flex:1;min-width:180px', required: true })); search.appendChild(el('button', { class: 'btn', type: 'submit' }, 'Search')); formCard.appendChild(search);
    var found = el('div', { class: 'grid', style: 'grid-template-columns:minmax(0,1fr);gap:8px' }); formCard.appendChild(found);
    var selected = null, selectedLabel = el('div', { class: 'note', text: 'Choose a creator from the search results.' }); formCard.appendChild(selectedLabel);
    var invite = el('form', { class: 'form-stack', onsubmit: async function (event) { event.preventDefault(); if (!selected) { CHL.toast('Search and choose a creator first.'); return; } var btn=invite.querySelector('button[type=submit]');btn.disabled=true;try { var at=invite.scheduled.value?new Date(invite.scheduled.value).toISOString():null;var r=await sb.rpc('create_creator_battle',{p_opponent_id:selected.id,p_title:invite.title.value.trim(),p_message:invite.message.value.trim(),p_scheduled_at:at});if(r.error)throw r.error;CHL.toast('Battle invitation sent.');invite.reset();selected=null;selectedLabel.textContent='Choose a creator from the search results.';found.innerHTML='';await loadBattles();}catch(e){CHL.toast(e.message||'Could not send the battle invitation. Confirm migration 0024 and invitation privacy rules.');}finally{btn.disabled=false;} } });
    invite.appendChild(el('label',{class:'field'},[el('span',{class:'field-label',text:'Battle title'},el('span',{})),el('input',{class:'input',name:'title',required:true,minlength:'1',maxlength:'120',placeholder:'e.g. Music vs Music'})]));
    invite.appendChild(el('label',{class:'field'},[el('span',{class:'field-label',text:'Message (optional)'}),el('textarea',{class:'input',name:'message',rows:'3',maxlength:'1000',placeholder:'Explain the proposed format or terms.'})]));
    invite.appendChild(el('label',{class:'field'},[el('span',{class:'field-label',text:'Proposed date and time (optional)' }),el('input',{class:'input',name:'scheduled',type:'datetime-local'})]));
    invite.appendChild(el('div',{class:'note',text:'No coins, gifts, scores or prizes are wagered or awarded by this invitation workflow.'})); invite.appendChild(el('button',{class:'btn primary',type:'submit'},'Send battle invitation')); formCard.appendChild(invite); o.appendChild(formCard);
    var list = el('div', { class: 'grid', style: 'grid-template-columns:minmax(0,1fr);gap:10px;max-width:900px' }); o.appendChild(el('h2',{class:'section-title',text:'Your battle invitations'})); o.appendChild(list); list.appendChild(ui.spinner());
    async function searchCreators(term) {
      found.innerHTML=''; found.appendChild(ui.spinner());
      try { var q=term.replace(/^@/,'').replace(/[%_,()]/g,' ').trim().slice(0,60);if(!q)throw new Error('Enter a search term.');var r=await sb.from('profiles').select('id,username,display_name').neq('id',CHL.user.id).or('username.ilike.%'+q+'%,display_name.ilike.%'+q+'%').limit(12);if(r.error)throw r.error;found.innerHTML='';var rows=r.data||[];if(!rows.length){found.appendChild(ui.empty('🔎','No matching creators','Try a different username.'));return;}rows.forEach(function(p){var card=el('div',{class:'card row wrap',style:'justify-content:space-between;gap:8px'},[el('div',{style:'min-width:0'},[el('strong',{text:p.display_name||p.username}),el('div',{class:'u',text:'@'+p.username})])]);card.appendChild(el('button',{class:'btn small',type:'button',onclick:function(){selected=p;selectedLabel.textContent='Selected creator: @'+p.username;}} ,'Choose'));found.appendChild(card);}); }
      catch(e){err(found,e,'Creator search failed');}
    }
    async function loadBattles() {
      list.innerHTML='';list.appendChild(ui.spinner());
      try { var q=await sb.from('creator_battles').select('id,challenger_id,opponent_id,title,message,scheduled_at,status,created_at,updated_at,completed_at').or('challenger_id.eq.'+CHL.user.id+',opponent_id.eq.'+CHL.user.id).order('created_at',{ascending:false}).limit(100);if(q.error)throw q.error;var rows=q.data||[];list.innerHTML='';if(!rows.length){list.appendChild(ui.empty('⚔️','No battle invitations yet','Search for another creator above to send an invitation.'));return;}var ids=[];rows.forEach(function(x){ids.push(x.challenger_id,x.opponent_id);});ids=Array.from(new Set(ids));var p=await sb.from('profiles').select('id,username,display_name').in('id',ids);if(p.error)throw p.error;var profiles={};(p.data||[]).forEach(function(x){profiles[x.id]=x;});rows.forEach(function(row){var sent=row.challenger_id===CHL.user.id,other=profiles[sent?row.opponent_id:row.challenger_id],card=el('article',{class:'card'});card.appendChild(el('div',{class:'row wrap',style:'justify-content:space-between;gap:8px'},[el('strong',{text:row.title}),statusChip(row.status)]));card.appendChild(el('div',{class:'u',text:(sent?'To @':'From @')+((other&&other.username)||'creator')+(row.scheduled_at?' · '+new Date(row.scheduled_at).toLocaleString():'')}));if(row.message)card.appendChild(el('p',{text:row.message}));var actions=el('div',{class:'row wrap',style:'gap:7px;margin-top:8px'});function action(name, rpcName){actions.appendChild(el('button',{class:'btn small',type:'button',text:name,onclick:async function(event){var b=event.currentTarget;b.disabled=true;try{var result=await sb.rpc('respond_creator_battle',{p_battle_id:row.id,p_action:rpcName});if(result.error)throw result.error;CHL.toast('Battle status updated.');await loadBattles();}catch(e){CHL.toast(e.message||'Could not change battle status.');b.disabled=false;}}},name));}
        if(row.status==='pending'&&!sent){action('Accept','accept');action('Decline','decline');}
        if(sent&&(row.status==='pending'||row.status==='accepted'))action('Cancel invitation','cancel');
        if(row.status==='accepted'){action('Mark completed','complete');}
        if(actions.children.length)card.appendChild(actions);list.appendChild(card);
      }); } catch(e) { err(list,e,'Battle invitations unavailable'); }
    }
    await loadBattles();
  });

  CHL.route('/admin/community', async function (o) {
    o.appendChild(ui.pageHead('Community administration', 'Configure missions, review real reward claims, and process creator-verification applications.'));
    if (!CHL.user || !(CHL.isAdmin && CHL.isAdmin())) { o.appendChild(ui.empty('🔒','Admin access only','Sign in with an administrator account.')); return; }
    var missionSection=el('section',{class:'card form-stack'});missionSection.appendChild(el('h2',{class:'section-title',text:'Create a mission'}));
    var mf=el('form',{class:'form-stack',onsubmit:async function(event){event.preventDefault();var b=mf.querySelector('button[type=submit]');b.disabled=true;try{var data={title:mf.title.value.trim(),description:mf.description.value.trim(),metric_key:mf.metric.value,target_value:Number(mf.target.value),reward_label:mf.reward.value.trim(),reward_details:mf.details.value.trim(),active:mf.active.checked,created_by:CHL.user.id};var r=await sb.from('creator_missions').insert(data);if(r.error)throw r.error;CHL.toast(data.active?'Mission published.':'Mission saved as inactive.');mf.reset();await loadMissions();}catch(e){CHL.toast(e.message||'Could not create mission. Confirm migration 0024.');}finally{b.disabled=false;}}});
    mf.appendChild(field('Mission title',el('input',{class:'input',name:'title',required:true,maxlength:'120'})));
    mf.appendChild(field('Description',el('textarea',{class:'input',name:'description',rows:'3',maxlength:'1500'})));
    var metric=el('select',{class:'input',name:'metric'},[['followers','Followers'],['posts','Published posts'],['views','Post views'],['streams','LIVE sessions'],['gifts_received','Gifts received'],['diamonds_from_gifts','Diamonds received'],['coins_spent_gifting','Coins spent gifting']].map(function(x){return el('option',{value:x[0]},x[1]);}));mf.appendChild(field('Required metric',metric));
    mf.appendChild(field('Target value',el('input',{class:'input',name:'target',type:'number',min:'1',step:'1',required:true})));
    mf.appendChild(field('Reward / recognition label',el('input',{class:'input',name:'reward',required:true,maxlength:'120',placeholder:'Certificate of recognition, featured creator…'})));
    mf.appendChild(field('Reward details',el('textarea',{class:'input',name:'details',rows:'3',maxlength:'1500'})));
    mf.appendChild(el('label',{class:'row',style:'gap:8px'},[el('input',{type:'checkbox',name:'active'}),el('span',{text:'Publish immediately (unchecked saves inactive)'})]));
    mf.appendChild(el('div',{class:'note',text:'Only publish rewards that have been approved and can actually be fulfilled. This page does not transfer money, coins, or diamonds.'}));mf.appendChild(el('button',{class:'btn primary',type:'submit'},'Create mission'));missionSection.appendChild(mf);o.appendChild(missionSection);
    var missions=el('div',{class:'grid',style:'grid-template-columns:minmax(0,1fr);gap:8px'});o.appendChild(el('h2',{class:'section-title',text:'Configured missions'}));o.appendChild(missions);
    var claims=el('div',{class:'grid',style:'grid-template-columns:minmax(0,1fr);gap:8px'});o.appendChild(el('h2',{class:'section-title',text:'Reward claims for review'}));o.appendChild(claims);
    var verifications=el('div',{class:'grid',style:'grid-template-columns:minmax(0,1fr);gap:8px'});o.appendChild(el('h2',{class:'section-title',text:'Creator verification applications'}));o.appendChild(verifications);
    function field(label, control){return el('label',{class:'field'},[el('span',{class:'field-label',text:label}),control]);}
    async function loadMissions(){missions.innerHTML='';missions.appendChild(ui.spinner());try{var r=await sb.from('creator_missions').select('id,title,metric_key,target_value,reward_label,active,created_at').order('created_at',{ascending:false});if(r.error)throw r.error;missions.innerHTML='';if(!(r.data||[]).length){missions.appendChild(ui.empty('🎯','No missions configured','Create a mission above.'));return;}r.data.forEach(function(m){var card=el('div',{class:'card row wrap',style:'justify-content:space-between;gap:8px'},[el('div',{style:'min-width:0'},[el('strong',{text:m.title}),el('div',{class:'u',text:metricLabel(m.metric_key)+' target: '+m.target_value+' · '+m.reward_label})]),el('button',{class:'btn small',type:'button',text:m.active?'Deactivate':'Activate',onclick:async function(event){var b=event.currentTarget;b.disabled=true;try{var u=await sb.from('creator_missions').update({active:!m.active,updated_at:new Date().toISOString()}).eq('id',m.id);if(u.error)throw u.error;await loadMissions();}catch(e){CHL.toast(e.message||'Could not update mission.');b.disabled=false;}}},m.active?'Deactivate':'Activate')]);missions.appendChild(card);});}catch(e){err(missions,e,'Mission list unavailable');}}
    async function loadClaims(){claims.innerHTML='';claims.appendChild(ui.spinner());try{var r=await sb.from('creator_mission_claims').select('id,mission_id,user_id,achieved_value,status,reviewer_note,requested_at').order('requested_at',{ascending:false}).limit(200);if(r.error)throw r.error;var rows=r.data||[];claims.innerHTML='';if(!rows.length){claims.appendChild(ui.empty('🎁','No reward claims','Claims will appear when a creator reaches an active mission goal and submits it.'));return;}var ids=Array.from(new Set(rows.map(function(x){return x.user_id;}))),mids=Array.from(new Set(rows.map(function(x){return x.mission_id;})));var p=await sb.from('profiles').select('id,username,display_name').in('id',ids);if(p.error)throw p.error;var m=await sb.from('creator_missions').select('id,title,reward_label').in('id',mids);if(m.error)throw m.error;var pm={},mm={};(p.data||[]).forEach(function(x){pm[x.id]=x;});(m.data||[]).forEach(function(x){mm[x.id]=x;});rows.forEach(function(c){var profile=pm[c.user_id]||{},mission=mm[c.mission_id]||{},card=el('article',{class:'card'});card.appendChild(el('div',{class:'row wrap',style:'justify-content:space-between;gap:8px'},[el('strong',{text:(profile.display_name||profile.username||c.user_id)+' · '+(mission.title||'Mission claim')}),statusChip(c.status)]));card.appendChild(el('div',{class:'u',text:'Evidence metric value: '+CHL.fmt(c.achieved_value)+' · '+(mission.reward_label||'Reward label unavailable')}));var note=el('textarea',{class:'input',rows:'2',maxlength:'1500',placeholder:'Optional reviewer note'});note.value=c.reviewer_note||'';card.appendChild(note);var actions=el('div',{class:'row wrap',style:'gap:7px;margin-top:8px'});[['Approve','approved'],['Reject','rejected'],['Mark fulfilled','fulfilled']].forEach(function(a){actions.appendChild(el('button',{class:'btn small',type:'button',text:a[0],disabled:a[1]==='fulfilled'&&c.status!=='approved',onclick:async function(event){var b=event.currentTarget;b.disabled=true;try{var u=await sb.from('creator_mission_claims').update({status:a[1],reviewer_note:note.value.trim(),reviewed_by:CHL.user.id,reviewed_at:new Date().toISOString()}).eq('id',c.id);if(u.error)throw u.error;CHL.toast('Claim status updated.');await loadClaims();}catch(e){CHL.toast(e.message||'Could not update reward claim.');b.disabled=false;}}},a[0]));});card.appendChild(actions);claims.appendChild(card);});}catch(e){err(claims,e,'Reward review unavailable');}}
    async function loadVerifications(){verifications.innerHTML='';verifications.appendChild(ui.spinner());try{var r=await sb.from('creator_verification_requests').select('id,user_id,reason,evidence_url,status,reviewer_note,submitted_at').order('submitted_at',{ascending:false}).limit(200);if(r.error)throw r.error;var rows=r.data||[];verifications.innerHTML='';if(!rows.length){verifications.appendChild(ui.empty('✅','No applications','Creator verification applications will appear here.'));return;}var ids=Array.from(new Set(rows.map(function(x){return x.user_id;})));var p=await sb.from('profiles').select('id,username,display_name').in('id',ids);if(p.error)throw p.error;var pp={};(p.data||[]).forEach(function(x){pp[x.id]=x;});rows.forEach(function(v){var profile=pp[v.user_id]||{},card=el('article',{class:'card'});card.appendChild(el('div',{class:'row wrap',style:'justify-content:space-between;gap:8px'},[el('strong',{text:(profile.display_name||profile.username||v.user_id)+' · @'+(profile.username||'unknown')}),statusChip(v.status)]));card.appendChild(el('p',{text:v.reason}));if(v.evidence_url)card.appendChild(el('a',{href:v.evidence_url,target:'_blank',rel:'noopener noreferrer',text:'Open evidence link'}));var note=el('textarea',{class:'input',rows:'2',maxlength:'1500',placeholder:'Reviewer note'});note.value=v.reviewer_note||'';card.appendChild(note);var actions=el('div',{class:'row wrap',style:'gap:7px;margin-top:8px'});[['Approve verification','verified'],['Reject','rejected']].forEach(function(a){actions.appendChild(el('button',{class:'btn small',type:'button',text:a[0],onclick:async function(event){var b=event.currentTarget;b.disabled=true;try{var up=await sb.from('creator_verification_requests').update({status:a[1],reviewer_note:note.value.trim(),reviewed_by:CHL.user.id,reviewed_at:new Date().toISOString()}).eq('id',v.id);if(up.error)throw up.error;if(a[1]==='verified'){var badge=await sb.from('public_creator_badges').upsert({user_id:v.user_id,badge_type:'verified_creator'},{onConflict:'user_id,badge_type'});if(badge.error)throw badge.error;}else{var drop=await sb.from('public_creator_badges').delete().eq('user_id',v.user_id).eq('badge_type','verified_creator');if(drop.error)throw drop.error;}CHL.toast('Verification status saved.');await loadVerifications();}catch(e){CHL.toast(e.message||'Could not update verification application.');b.disabled=false;}}},a[0]));});card.appendChild(actions);verifications.appendChild(card);});}catch(e){err(verifications,e,'Verification review unavailable');}}
    await Promise.all([loadMissions(),loadClaims(),loadVerifications()]);
  });
})();
