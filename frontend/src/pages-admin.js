/* Creator Hub Live — Admin Center. All routes gated to admin profiles by the router. */
(function(){
  'use strict';
  var CHL = window.CHL; var el = CHL.el, ui = CHL.ui, sb = CHL.sb;

  var ANAV=[
    ['#/admin','Dashboard'],['#/admin/users','Users'],['#/admin/content','Content'],
    ['#/admin/live','LIVE'],['#/admin/payments','Payments'],['#/admin/coins','Coins'],
    ['#/admin/diamonds','Diamonds'],['#/admin/gifts','Gifts'],['#/admin/subscriptions','Subscriptions'],
    ['#/admin/payouts','Payouts'],['#/admin/teams','Teams'],['#/admin/leagues','Leagues'],
    ['#/admin/rankings','Rankings'],['#/admin/moderation','Moderation'],['#/admin/reports','Reports'],
    ['#/admin/verification','Verification'],['#/admin/settings','Settings'],['#/admin/audit','Audit']
  ];
  function anav(){
    var bar=el('div',{class:'row wrap',style:'gap:6px;margin-bottom:16px'});
    ANAV.forEach(function(it){ var on=CHL.current.path===it[0].replace('#',''); bar.appendChild(el('a',{href:it[0],class:'chip'+(on?' on':'')},it[1])); });
    return bar;
  }
  function head(o,title,sub){
    o.appendChild(el('div',{class:'row',style:'gap:8px;margin-bottom:4px'},[ el('span',{class:'pill',text:'🔒 ADMIN'}) ]));
    o.appendChild(ui.pageHead(title,sub));
    if(!CHL.configured){ o.appendChild(ui.setupNotice()); return true; }
    o.appendChild(anav()); return false;
  }

  function countCard(label, table, filter){
    var c=ui.statCard('…',label);
    var q=sb.from(table).select('*',{count:'exact',head:true});
    if(filter) q=filter(q);
    q.then(function(r){ c.querySelector('.stat-v').textContent=CHL.fmt(r.count||0); }).catch(function(){ c.querySelector('.stat-v').textContent='0'; });
    return c;
  }

  CHL.route('/admin', function(o){ if(head(o,'Admin Dashboard','Platform overview — real counts from the database.')) return;
    var stat=el('div',{class:'grid stat'}); o.appendChild(stat);
    stat.appendChild(countCard('Users','profiles'));
    stat.appendChild(countCard('Live now','live_sessions',function(q){ return q.eq('status','live'); }));
    stat.appendChild(countCard('Posts','posts'));
    stat.appendChild(countCard('Gift tx','gift_transactions'));
    stat.appendChild(countCard('Payments','payments'));
    stat.appendChild(countCard('Teams','teams'));
    o.appendChild(el('div',{class:'note',html:'The admin account must be provisioned securely (set <code>is_admin=true</code> or <code>role=\'admin\'</code> on your profile row). Admin credentials are never hard-coded.'}));
  });

  function listPage(path,title,sub,table,cols){
    CHL.route(path, function(o){ if(head(o,title,sub)) return;
      var wrap=el('div',{class:'card',style:'overflow:auto'}); o.appendChild(wrap); wrap.appendChild(ui.spinner());
      sb.from(table).select(cols.join(',')).limit(50).then(function(r){ wrap.innerHTML='';
        var rows=(r&&r.data)||[];
        if(r&&r.error){ wrap.appendChild(el('div',{class:'note',text:'Table “'+table+'”: '+r.error.message})); return; }
        if(!rows.length){ wrap.appendChild(ui.empty('📭','Nothing here yet','No rows in '+table.'. Real data appears as the platform is used.')); return; }
        var t=el('table',{style:'width:100%;border-collapse:collapse;font-size:13px'});
        var hr=el('tr'); cols.forEach(function(c){ hr.appendChild(el('th',{style:'text-align:left;padding:8px;border-bottom:1px solid var(--line);color:var(--mut)',text:c})); }); t.appendChild(hr);
        rows.forEach(function(row){ var tr=el('tr'); cols.forEach(function(c){ tr.appendChild(el('td',{style:'padding:8px;border-bottom:1px solid var(--line)',text:String(row[c]==null?'':row[c]).slice(0,40)})); }); t.appendChild(tr); });
        wrap.appendChild(t);
      }).catch(function(e){ wrap.innerHTML=''; wrap.appendChild(el('div',{class:'note',text:e.message})); });
    });
  }

  listPage('/admin/users','Users','Manage, verify, restrict and suspend accounts.','profiles',['id','username','display_name']);
  listPage('/admin/content','Content','Review and moderate posts.','posts',['id','author_id','created_at']);
  listPage('/admin/live','LIVE','Monitor and manage live sessions.','live_sessions',['id','title','status','viewer_count']);
  listPage('/admin/payments','Payments','All payment records (idempotent ledger).','payments',['id','user_id','status','provider']);
  listPage('/admin/coins','Coins','Coin ledger entries.','coin_ledger',['id','user_id','amount','balance_after']);
  listPage('/admin/diamonds','Diamonds','Diamond ledger entries.','diamond_ledger',['id','user_id','amount','balance_after']);
  listPage('/admin/gifts','Gifts','Gift transactions.','gift_transactions',['id','sender_id','recipient_id','coins']);
  listPage('/admin/subscriptions','Subscriptions','Active and past subscriptions.','subscriptions',['id','subscriber_id','creator_id','status']);
  listPage('/admin/payouts','Payouts','Creator payout requests (accounts stored masked).','payouts',['id','user_id','amount','status']);
  
  // Custom Teams Route (with division_code support)
  CHL.route('/admin/teams', function(o){ if(head(o,'Teams','Manage registered teams and division allocations.')) return;
    var wrap=el('div',{class:'card',style:'overflow:auto'}); o.appendChild(wrap); wrap.appendChild(ui.spinner());
    sb.from('teams').select('id,name,division_code,created_at').limit(50).then(function(r){ wrap.innerHTML='';
      var rows=(r&&r.data)||[];
      if(r&&r.error){ wrap.appendChild(el('div',{class:'note',text:r.error.message})); return; }
      if(!rows.length){ wrap.appendChild(ui.empty('⚽','No teams yet','Teams will appear here once registered.')); return; }
      var t=el('table',{style:'width:100%;border-collapse:collapse;font-size:13px'});
      var hr=el('tr'); ['ID','Name','Division','Created'].forEach(function(c){ hr.appendChild(el('th',{style:'text-align:left;padding:8px;border-bottom:1px solid var(--line);color:var(--mut)',text:c})); }); t.appendChild(hr);
      rows.forEach(function(row){ 
        var tr=el('tr'); 
        [row.id, row.name, row.division_code, new Date(row.created_at).toLocaleDateString()].forEach(function(val){ 
          tr.appendChild(el('td',{style:'padding:8px;border-bottom:1px solid var(--line)',text:String(val||'').slice(0,40)})); 
        }); 
        t.appendChild(tr); 
      });
      wrap.appendChild(t);
    }).catch(function(e){ wrap.innerHTML=''; wrap.appendChild(el('div',{class:'note',text:e.message})); });
  });

  // Custom Leagues & Seasons Management Route
  CHL.route('/admin/leagues', function(o){ if(head(o,'Leagues & Seasons','Manage competitive seasons, standings, and authoritative match records.')) return;
    
    var container = el('div',{style:'display:flex;flex-direction:column;gap:16px'});
    o.appendChild(container);

    var seasonsCard = el('div',{class:'card',style:'overflow:auto'});
    container.appendChild(seasonsCard);
    seasonsCard.appendChild(ui.spinner());

    sb.from('league_seasons').select('*').order('created_at',{ascending:false}).then(function(r){
      seasonsCard.innerHTML='<h3 style="margin-top:0">League Seasons</h3>';
      var seasons = (r&&r.data)||[];
      if(!seasons.length){
        seasonsCard.appendChild(el('div',{class:'note',text:'No seasons scheduled yet.'}));
        return;
      }
      var t=el('table',{style:'width:100%;border-collapse:collapse;font-size:13px'});
      var hr=el('tr'); ['Name','Status','Starts','Ends','Actions'].forEach(function(c){ hr.appendChild(el('th',{style:'text-align:left;padding:8px;border-bottom:1px solid var(--line);color:var(--mut)',text:c})); }); t.appendChild(hr);
      
      seasons.forEach(function(s){
        var tr=el('tr');
        tr.appendChild(el('td',{style:'padding:8px;border-bottom:1px solid var(--line)',text:s.name}));
        tr.appendChild(el('td',{style:'padding:8px;border-bottom:1px solid var(--line)',text:s.status}));
        tr.appendChild(el('td',{style:'padding:8px;border-bottom:1px solid var(--line)',text:new Date(s.starts_at).toLocaleDateString()}));
        tr.appendChild(el('td',{style:'padding:8px;border-bottom:1px solid var(--line)',text:new Date(s.ends_at).toLocaleDateString()}));
        
        var actionsTd = el('td',{style:'padding:8px;border-bottom:1px solid var(--line);display:flex;gap:6px'});
        if(s.status === 'scheduled' || s.status === 'active'){
          var initBtn = el('button',{class:'btn sm',text:'Initialize'});
          initBtn.onclick = function(){
            initBtn.disabled = true;
            sb.rpc('initialize_league_season', { p_season: s.id }).then(function(res){
              if(res.error) alert('Error: '+res.error.message);
              else { alert('Season initialized successfully!'); location.reload(); }
            });
          };
          actionsTd.appendChild(initBtn);
        }
        if(s.status === 'active'){
          var finBtn = el('button',{class:'btn sm',text:'Finalize & Promote',style:'background:#e11d48;color:#fff'});
          finBtn.onclick = function(){
            if(!confirm('Finalize season? This will compute promotions and relegations.')) return;
            sb.rpc('finalize_league_season', { p_season: s.id }).then(function(res){
              if(res.error) alert('Error: '+res.error.message);
              else { alert('Season finalized successfully!'); location.reload(); }
            });
          };
          actionsTd.appendChild(finBtn);
        }
        tr.appendChild(actionsTd);
        t.appendChild(tr);
      });
      seasonsCard.appendChild(t);
    }).catch(function(e){ seasonsCard.innerHTML='<div class="note">'+e.message+'</div>'; });
  });

  listPage('/admin/rankings','Rankings','Computed leaderboards.','rankings',['id','scope','subject_id','points']);
  listPage('/admin/moderation','Moderation','Moderation actions log.','moderation_actions',['id','actor_id','action','target_id']);
  listPage('/admin/reports','Reports','User reports queue.','reports',['id','reporter_id','type','status']);
  listPage('/admin/verification','Verification','Verification requests.','profiles',['id','username','display_name']);
  listPage('/admin/audit','Audit log','Every sensitive admin action is logged.','admin_audit_logs',['id','admin_id','action','created_at']);

  CHL.route('/admin/settings', function(o){ if(head(o,'Platform settings','Feature flags, currency, countries and languages.')) return;
    var wrap=el('div',{class:'card',style:'overflow:auto'}); o.appendChild(wrap); wrap.appendChild(ui.spinner/* Creator Hub Live — Admin Center. All routes gated to admin profiles by the router. */
(function(){
  'use strict';
  var CHL = window.CHL; var el = CHL.el, ui = CHL.ui, sb = CHL.sb;

  var ANAV=[
    ['#/admin','Dashboard'],['#/admin/users','Users'],['#/admin/content','Content'],
    ['#/admin/live','LIVE'],['#/admin/payments','Payments'],['#/admin/coins','Coins'],
    ['#/admin/diamonds','Diamonds'],['#/admin/gifts','Gifts'],['#/admin/subscriptions','Subscriptions'],
    ['#/admin/payouts','Payouts'],['#/admin/teams','Teams'],['#/admin/leagues','Leagues'],
    ['#/admin/rankings','Rankings'],['#/admin/moderation','Moderation'],['#/admin/reports','Reports'],
    ['#/admin/verification','Verification'],['#/admin/settings','Settings'],['#/admin/audit','Audit']
  ];
  function anav(){
    var bar=el('div',{class:'row wrap',style:'gap:6px;margin-bottom:16px'});
    ANAV.forEach(function(it){ var on=CHL.current.path===it[0].replace('#',''); bar.appendChild(el('a',{href:it[0],class:'chip'+(on?' on':'')},it[1])); });
    return bar;
  }
  function head(o,title,sub){
    o.appendChild(el('div',{class:'row',style:'gap:8px;margin-bottom:4px'},[ el('span',{class:'pill',text:'🔒 ADMIN'}) ]));
    o.appendChild(ui.pageHead(title,sub));
    if(!CHL.configured){ o.appendChild(ui.setupNotice()); return true; }
    o.appendChild(anav()); return false;
  }

  function countCard(label, table, filter){
    var c=ui.statCard('…',label);
    var q=sb.from(table).select('*',{count:'exact',head:true});
    if(filter) q=filter(q);
    q.then(function(r){ c.querySelector('.stat-v').textContent=CHL.fmt(r.count||0); }).catch(function(){ c.querySelector('.stat-v').textContent='0'; });
    return c;
  }

  CHL.route('/admin', function(o){ if(head(o,'Admin Dashboard','Platform overview — real counts from the database.')) return;
    var stat=el('div',{class:'grid stat'}); o.appendChild(stat);
    stat.appendChild(countCard('Users','profiles'));
    stat.appendChild(countCard('Live now','live_sessions',function(q){ return q.eq('status','live'); }));
    stat.appendChild(countCard('Posts','posts'));
    stat.appendChild(countCard('Gift tx','gift_transactions'));
    stat.appendChild(countCard('Payments','payments'));
    stat.appendChild(countCard('Teams','teams'));
    o.appendChild(el('div',{class:'note',html:'The admin account must be provisioned securely (set <code>is_admin=true</code> or <code>role=\'admin\'</code> on your profile row). Admin credentials are never hard-coded.'}));
  });

  function listPage(path,title,sub,table,cols){
    CHL.route(path, function(o){ if(head(o,title,sub)) return;
      var wrap=el('div',{class:'card',style:'overflow:auto'}); o.appendChild(wrap); wrap.appendChild(ui.spinner());
      sb.from(table).select(cols.join(',')).limit(50).then(function(r){ wrap.innerHTML='';
        var rows=(r&&r.data)||[];
        if(r&&r.error){ wrap.appendChild(el('div',{class:'note',text:'Table “'+table+'”: '+r.error.message})); return; }
        if(!rows.length){ wrap.appendChild(ui.empty('📭','Nothing here yet','No rows in '+table.'. Real data appears as the platform is used.')); return; }
        var t=el('table',{style:'width:100%;border-collapse:collapse;font-size:13px'});
        var hr=el('tr'); cols.forEach(function(c){ hr.appendChild(el('th',{style:'text-align:left;padding:8px;border-bottom:1px solid var(--line);color:var(--mut)',text:c})); }); t.appendChild(hr);
        rows.forEach(function(row){ var tr=el('tr'); cols.forEach(function(c){ tr.appendChild(el('td',{style:'padding:8px;border-bottom:1px solid var(--line)',text:String(row[c]==null?'':row[c]).slice(0,40)})); }); t.appendChild(tr); });
        wrap.appendChild(t);
      }).catch(function(e){ wrap.innerHTML=''; wrap.appendChild(el('div',{class:'note',text:e.message})); });
    });
  }

  listPage('/admin/users','Users','Manage, verify, restrict and suspend accounts.','profiles',['id','username','display_name']);
  listPage('/admin/content','Content','Review and moderate posts.','posts',['id','author_id','created_at']);
  listPage('/admin/live','LIVE','Monitor and manage live sessions.','live_sessions',['id','title','status','viewer_count']);
  listPage('/admin/payments','Payments','All payment records (idempotent ledger).','payments',['id','user_id','status','provider']);
  listPage('/admin/coins','Coins','Coin ledger entries.','coin_ledger',['id','user_id','amount','balance_after']);
  listPage('/admin/diamonds','Diamonds','Diamond ledger entries.','diamond_ledger',['id','user_id','amount','balance_after']);
  listPage('/admin/gifts','Gifts','Gift transactions.','gift_transactions',['id','sender_id','recipient_id','coins']);
  listPage('/admin/subscriptions','Subscriptions','Active and past subscriptions.','subscriptions',['id','subscriber_id','creator_id','status']);
  listPage('/admin/payouts','Payouts','Creator payout requests (accounts stored masked).','payouts',['id','user_id','amount','status']);
  
  // Custom Teams Route (with division_code support)
  CHL.route('/admin/teams', function(o){ if(head(o,'Teams','Manage registered teams and division allocations.')) return;
    var wrap=el('div',{class:'card',style:'overflow:auto'}); o.appendChild(wrap); wrap.appendChild(ui.spinner());
    sb.from('teams').select('id,name,division_code,created_at').limit(50).then(function(r){ wrap.innerHTML='';
      var rows=(r&&r.data)||[];
      if(r&&r.error){ wrap.appendChild(el('div',{class:'note',text:r.error.message})); return; }
      if(!rows.length){ wrap.appendChild(ui.empty('⚽','No teams yet','Teams will appear here once registered.')); return; }
      var t=el('table',{style:'width:100%;border-collapse:collapse;font-size:13px'});
      var hr=el('tr'); ['ID','Name','Division','Created'].forEach(function(c){ hr.appendChild(el('th',{style:'text-align:left;padding:8px;border-bottom:1px solid var(--line);color:var(--mut)',text:c})); }); t.appendChild(hr);
      rows.forEach(function(row){ 
        var tr=el('tr'); 
        [row.id, row.name, row.division_code, new Date(row.created_at).toLocaleDateString()].forEach(function(val){ 
          tr.appendChild(el('td',{style:'padding:8px;border-bottom:1px solid var(--line)',text:String(val||'').slice(0,40)})); 
        }); 
        t.appendChild(tr); 
      });
      wrap.appendChild(t);
    }).catch(function(e){ wrap.innerHTML=''; wrap.appendChild(el('div',{class:'note',text:e.message})); });
  });

  // Custom Leagues & Seasons Management Route
  CHL.route('/admin/leagues', function(o){ if(head(o,'Leagues & Seasons','Manage competitive seasons, standings, and authoritative match records.')) return;
    
    var container = el('div',{style:'display:flex;flex-direction:column;gap:16px'});
    o.appendChild(container);

    var seasonsCard = el('div',{class:'card',style:'overflow:auto'});
    container.appendChild(seasonsCard);
    seasonsCard.appendChild(ui.spinner());

    sb.from('league_seasons').select('*').order('created_at',{ascending:false}).then(function(r){
      seasonsCard.innerHTML='<h3 style="margin-top:0">League Seasons</h3>';
      var seasons = (r&&r.data)||[];
      if(!seasons.length){
        seasonsCard.appendChild(el('div',{class:'note',text:'No seasons scheduled yet.'}));
        return;
      }
      var t=el('table',{style:'width:100%;border-collapse:collapse;font-size:13px'});
      var hr=el('tr'); ['Name','Status','Starts','Ends','Actions'].forEach(function(c){ hr.appendChild(el('th',{style:'text-align:left;padding:8px;border-bottom:1px solid var(--line);color:var(--mut)',text:c})); }); t.appendChild(hr);
      
      seasons.forEach(function(s){
        var tr=el('tr');
        tr.appendChild(el('td',{style:'padding:8px;border-bottom:1px solid var(--line)',text:s.name}));
        tr.appendChild(el('td',{style:'padding:8px;border-bottom:1px solid var(--line)',text:s.status}));
        tr.appendChild(el('td',{style:'padding:8px;border-bottom:1px solid var(--line)',text:new Date(s.starts_at).toLocaleDateString()}));
        tr.appendChild(el('td',{style:'padding:8px;border-bottom:1px solid var(--line)',text:new Date(s.ends_at).toLocaleDateString()}));
        
        var actionsTd = el('td',{style:'padding:8px;border-bottom:1px solid var(--line);display:flex;gap:6px'});
        if(s.status === 'scheduled' || s.status === 'active'){
          var initBtn = el('button',{class:'btn sm',text:'Initialize'});
          initBtn.onclick = function(){
            initBtn.disabled = true;
            sb.rpc('initialize_league_season', { p_season: s.id }).then(function(res){
              if(res.error) alert('Error: '+res.error.message);
              else { alert('Season initialized successfully!'); location.reload(); }
            });
          };
          actionsTd.appendChild(initBtn);
        }
        if(s.status === 'active'){
          var finBtn = el('button',{class:'btn sm',text:'Finalize & Promote',style:'background:#e11d48;color:#fff'});
          finBtn.onclick = function(){
            if(!confirm('Finalize season? This will compute promotions and relegations.')) return;
            sb.rpc('finalize_league_season', { p_season: s.id }).then(function(res){
              if(res.error) alert('Error: '+res.error.message);
              else { alert('Season finalized successfully!'); location.reload(); }
            });
          };
          actionsTd.appendChild(finBtn);
        }
        tr.appendChild(actionsTd);
        t.appendChild(tr);
      });
      seasonsCard.appendChild(t);
    }).catch(function(e){ seasonsCard.innerHTML='<div class="note">'+e.message+'</div>'; });
  });

  listPage('/admin/rankings','Rankings','Computed leaderboards.','rankings',['id','scope','subject_id','points']);
  listPage('/admin/moderation','Moderation','Moderation actions log.','moderation_actions',['id','actor_id','action','target_id']);
  listPage('/admin/reports','Reports','User reports queue.','reports',['id','reporter_id','type','status']);
  listPage('/admin/verification','Verification','Verification requests.','profiles',['id','username','display_name']);
  listPage('/admin/audit','Audit log','Every sensitive admin action is logged.','admin_audit_logs',['id','admin_id','action','created_at']);

  CHL.route('/admin/settings', function(o){ if(head(o,'Platform settings','Feature flags, currency, countries and languages.')) return;
    var wrap=el('div',{class:'card',style:'overflow:auto'}); o.appendChild(wrap); wrap.appendChild(ui.spinner
