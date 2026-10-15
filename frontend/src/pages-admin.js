/* Creator Hub Live \u2014 Admin Center. All routes gated to admin profiles by the router. */
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
    o.appendChild(el('div',{class:'row',style:'gap:8px;margin-bottom:4px'},[ el('span',{class:'pill',text:'\uD83D\uDD12 ADMIN'}) ]));
    o.appendChild(ui.pageHead(title,sub));
    if(!CHL.configured){ o.appendChild(ui.setupNotice()); return true; }
    o.appendChild(anav()); return false;
  }

  function countCard(label, table, filter){
    var c=ui.statCard('\u2026',label);
    var q=sb.from(table).select('*',{count:'exact',head:true});
    if(filter) q=filter(q);
    q.then(function(r){ c.querySelector('.stat-v').textContent=CHL.fmt(r.count||0); }).catch(function(){ c.querySelector('.stat-v').textContent='0'; });
    return c;
  }

  CHL.route('/admin', function(o){ if(head(o,'Admin Dashboard','Platform overview \u2014 real counts from the database.')) return;
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
        if(r&&r.error){ wrap.appendChild(el('div',{class:'note',text:'Table \u201c'+table+'\u201d: '+r.error.message})); return; }
        if(!rows.length){ wrap.appendChild(ui.empty('\uD83D\uDCED','Nothing here yet','No rows in '+table+'. Real data appears as the platform is used.')); return; }
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
  listPage('/admin/teams','Teams','Manage teams.','teams',['id','name','level','points']);
  listPage('/admin/leagues','Leagues','League seasons and divisions.','league_seasons',['id','name','status']);
  listPage('/admin/rankings','Rankings','Computed leaderboards.','rankings',['id','scope','subject_id','points']);
  listPage('/admin/moderation','Moderation','Moderation actions log.','moderation_actions',['id','actor_id','action','target_id']);
  listPage('/admin/reports','Reports','User reports queue.','reports',['id','reporter_id','type','status']);
  listPage('/admin/verification','Verification','Verification requests.','profiles',['id','username','display_name']);
  listPage('/admin/audit','Audit log','Every sensitive admin action is logged.','admin_audit_logs',['id','admin_id','action','created_at']);

  CHL.route('/admin/settings', function(o){ if(head(o,'Platform settings','Feature flags, currency, countries and languages.')) return;
    var wrap=el('div',{class:'card',style:'overflow:auto'}); o.appendChild(wrap); wrap.appendChild(ui.spinner());
    sb.from('platform_settings').select('key,value').limit(100).then(function(r){ wrap.innerHTML='';
      if(r&&r.error){ wrap.appendChild(el('div',{class:'note',text:r.error.message})); return; }
      var rows=(r&&r.data)||[];
      if(!rows.length){ wrap.appendChild(ui.empty('\u2699\uFE0F','No settings yet','Platform settings are stored here.')); return; }
      rows.forEach(function(s){ wrap.appendChild(el('div',{class:'row between',style:'padding:8px 0;border-bottom:1px solid var(--line)'},[ el('b',{text:s.key}), el('span',{style:'color:var(--mut)',text:String(s.value)}) ])); });
    }).catch(function(e){ wrap.innerHTML=''; wrap.appendChild(el('div',{class:'note',text:e.message})); });
  });
})();
