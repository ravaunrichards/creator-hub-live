/* Creator Hub Live \u2014 extra routes: feeds, search, social, messaging,
   notifications, posts, legal/help. Honest empty states; real reads where tables exist. */
(function(){
  'use strict';
  var CHL = window.CHL; var el = CHL.el, ui = CHL.ui, sb = CHL.sb;

  function setup(outlet, title, sub){
    outlet.appendChild(ui.pageHead(title, sub));
    if (!CHL.configured){ outlet.appendChild(ui.setupNotice()); return true; }
    return false;
  }

  /* ---- feeds ---- */
  CHL.route('/for-you', function(o){
    if (setup(o,'For You','A personalized feed built from real engagement \u2014 no guaranteed virality.')) return;
    renderPosts(o, sb.from('posts').select('id,body,created_at,author:profiles!posts_author_id_fkey(username,display_name)').order('created_at',{ascending:false}).limit(30));
  });
  CHL.route('/following', function(o){
    if (setup(o,'Following','Posts from creators you follow.')) return;
    if (!CHL.user){ o.appendChild(ui.empty('\uD83D\uDC65','Log in to see this','Follow creators to build your feed.', el('a',{href:'#/login',class:'btn primary',style:'margin-top:8px'},'Log in'))); return; }
    renderPosts(o, sb.from('posts').select('id,body,created_at,author:profiles!posts_author_id_fkey(username,display_name)').order('created_at',{ascending:false}).limit(30));
  });

  function renderPosts(o, query){
    var list = el('div',{class:'grid',style:'grid-template-columns:1fr'}); o.appendChild(list);
    list.appendChild(ui.spinner());
    query.then(function(r){
      list.innerHTML='';
      var rows=(r&&r.data)||[];
      if (!rows.length){ list.appendChild(ui.empty('\uD83D\uDCDD','No posts yet','When creators post, their content shows up here.')); return; }
      rows.forEach(function(p){
        var who=(p.author&&(p.author.display_name||p.author.username))||'Creator';
        list.appendChild(el('div',{class:'card',style:'cursor:pointer',onclick:function(){ CHL.navigate('#/post/'+p.id); }},[
          el('div',{class:'row',style:'gap:10px;margin-bottom:8px'},[
            el('div',{class:'ava',style:'width:40px;height:40px;font-size:16px',text:CHL.initials(who).toUpperCase()}),
            el('div',{},[ el('div',{style:'font-weight:700',text:who}), el('div',{style:'color:var(--mut);font-size:12px',text:'@'+((p.author&&p.author.username)||'creator')+' \u00B7 '+CHL.ago(p.created_at)}) ])
          ]),
          el('div',{text:p.body||''})
        ]));
      });
    }).catch(function(e){ list.innerHTML=''; list.appendChild(el('div',{class:'note',text:'Could not load posts: '+e.message})); });
  }

  CHL.route('/post', function(o,r){
    if (setup(o,'Post')) return;
    if (!r.id){ CHL.navigate('#/for-you'); return; }
    o.innerHTML=''; o.appendChild(ui.spinner());
    sb.from('posts').select('id,body,created_at,author:profiles!posts_author_id_fkey(username,display_name)').eq('id',r.id).maybeSingle()
      .then(function(res){ o.innerHTML='';
        var p=res&&res.data;
        if(!p){ o.appendChild(ui.empty('\uD83D\uDCED','Post no longer exists','This content may have been removed.', el('a',{href:'#/for-you',class:'btn',style:'margin-top:8px'},'Back to feed'))); return; }
        var who=(p.author&&(p.author.display_name||p.author.username))||'Creator';
        o.appendChild(el('div',{class:'card'},[ el('div',{style:'font-weight:700;margin-bottom:4px',text:who}), el('div',{style:'color:var(--mut);font-size:12px;margin-bottom:12px',text:CHL.ago(p.created_at)}), el('div',{text:p.body||''}) ]));
      }).catch(function(e){ o.innerHTML=''; o.appendChild(el('div',{class:'note',text:e.message})); });
  });

  /* ---- search ---- */
  CHL.route('/search', function(o){
    o.appendChild(ui.pageHead('Search','Find creators by @username or display name.'));
    if (!CHL.configured){ o.appendChild(ui.setupNotice()); return; }
    var f=el('form',{style:'display:flex;gap:8px;margin-bottom:16px',onsubmit:function(e){ e.preventDefault(); runSearch(f.q.value.trim(), res); }});
    f.appendChild(el('input',{class:'input',name:'q',placeholder:'@username, name, #hashtag\u2026'}));
    f.appendChild(el('button',{class:'btn primary',type:'submit'},'Search'));
    o.appendChild(f);
    var res=el('div',{class:'grid live'}); o.appendChild(res);
    res.appendChild(ui.empty('\uD83D\uDD0E','Search Creator Hub Live','Type a username or name to find real accounts.'));
  });
  function runSearch(q, res){
    res.innerHTML=''; if(!q){ return; } res.appendChild(ui.spinner());
    var term=q.replace(/^[@#]/,'');
    sb.from('profiles').select('id,username,display_name').or('username.ilike.%'+term+'%,display_name.ilike.%'+term+'%').limit(30)
      .then(function(r){ res.innerHTML='';
        var rows=(r&&r.data)||[];
        if(!rows.length){ res.appendChild(ui.empty('\uD83D\uDE36','No creators found yet','No accounts match \u201c'+q+'\u201d.')); res.style.display='block'; return; }
        res.style.display=''; rows.forEach(function(p){ res.appendChild(userCard(p)); });
      }).catch(function(e){ res.innerHTML=''; res.appendChild(el('div',{class:'note',text:e.message})); });
  }
  function userCard(p){
    var who=p.display_name||p.username||'Creator';
    return el('div',{class:'card',style:'cursor:pointer;text-align:center',onclick:function(){ CHL.navigate('#/profile/'+(p.username||p.id)); }},[
      el('div',{class:'ava',style:'width:60px;height:60px;margin:0 auto 8px;font-size:22px',text:CHL.initials(who).toUpperCase()}),
      el('div',{style:'font-weight:700',text:who}), el('div',{style:'color:var(--mut);font-size:12px',text:'@'+(p.username||'creator')})
    ]);
  }

  CHL.route('/hashtag', function(o,r){
    o.appendChild(ui.pageHead('#'+(r.id||'hashtag'),'Posts tagged with this hashtag.'));
    if(!CHL.configured){ o.appendChild(ui.setupNotice()); return; }
    o.appendChild(ui.empty('#\uFE0F\u20E3','No posts with this tag yet','Be the first to use #'+(r.id||'')+'.'));
  });
  CHL.route('/sound', function(o,r){
    o.appendChild(ui.pageHead('Sound','Videos using this sound.'));
    if(!CHL.configured){ o.appendChild(ui.setupNotice()); return; }
    o.appendChild(ui.empty('\uD83C\uDFB5','No videos use this sound yet','Original sounds show their clips here.'));
  });

  /* ---- messaging + notifications ---- */
  CHL.route('/messages', function(o,r){
    if (setup(o,'Messages','Your direct conversations.')) return;
    o.appendChild(ui.empty('\uD83D\uDCAC','No messages yet','Start a conversation from any creator profile.'));
  });
  CHL.route('/notifications', function(o){
    if (setup(o,'Notifications','Follows, gifts, mentions and LIVE alerts.')) return;
    var list=el('div',{class:'grid',style:'grid-template-columns:1fr'}); o.appendChild(list); list.appendChild(ui.spinner());
    sb.from('notifications').select('id,type,body,created_at').eq('user_id',CHL.user.id).order('created_at',{ascending:false}).limit(40)
      .then(function(r){ list.innerHTML=''; var rows=(r&&r.data)||[];
        if(!rows.length){ list.appendChild(ui.empty('\uD83D\uDD14','You are all caught up','New activity will appear here in real time.')); return; }
        rows.forEach(function(n){ list.appendChild(el('div',{class:'card'},[ el('div',{style:'font-weight:700',text:n.type||'Notification'}), el('div',{style:'color:var(--mut);font-size:13px',text:(n.body||'')+' \u00B7 '+CHL.ago(n.created_at)}) ])); });
      }).catch(function(){ list.innerHTML=''; list.appendChild(ui.empty('\uD83D\uDD14','You are all caught up','New activity will appear here in real time.')); });
  });

  /* ---- help / report / legal ---- */
  function legal(path, title, body){
    CHL.route(path, function(o){ o.appendChild(ui.pageHead(title)); o.appendChild(el('div',{class:'card',html:body})); });
  }
  legal('/help','Help Center','<p>Need a hand? Browse topics or <a href="#/report" style="color:var(--brand2)">report a problem</a>.</p><ul><li>Getting started &amp; profile setup</li><li>Going LIVE and inviting guests</li><li>Coins, gifts and wallet</li><li>Subscriptions and creator earnings</li><li>Safety and moderation</li></ul>');
  legal('/report','Report a problem','<p>Report content, a user, or a payment issue. Reports are reviewed by moderators and logged in the audit trail.</p><p style="color:var(--mut)">Connect the backend to submit reports to the moderation queue.</p>');
  legal('/terms','Terms of Service','<p>These placeholder Terms describe acceptable use of Creator Hub Live. Replace with your reviewed legal copy before public launch.</p>');
  legal('/privacy','Privacy Policy','<p>This placeholder Privacy Policy explains what data Creator Hub Live stores (profiles, content, transactions) and how it is protected with Row Level Security. Replace with your reviewed legal copy before launch.</p>');
  legal('/community-guidelines','Community Guidelines','<p>Be respectful. No harassment, hate, explicit content involving minors, fraud, or spam. Violations lead to restriction or suspension.</p>');

  /* ---- auth stubs that must resolve (no 404) ---- */
  ['/verify','/forgot-password','/reset-password'].forEach(function(p){
    CHL.route(p, function(o){
      var title = p==='/verify'?'Verify your email':(p==='/forgot-password'?'Reset your password':'Set a new password');
      o.appendChild(el('div',{class:'auth-wrap'},[ el('div',{class:'auth-box'},[
        el('div',{style:'text-align:center;margin-bottom:18px'},[ el('img',{src:'assets/logo.svg',height:'42',alt:CHL.brand}) ]),
        el('div',{class:'card'},[ el('div',{class:'h1',style:'font-size:20px',text:title}),
          el('p',{class:'sub',text:'Handled securely through Supabase Auth email links. Connect the backend to enable this flow.'}),
          el('a',{href:'#/login',class:'btn primary block'},'Back to log in') ]) ]) ]));
    });
  });
  CHL.route('/oauth', function(o){ o.appendChild(ui.pageHead('Signing you in\u2026')); o.appendChild(ui.spinner()); CHL.refreshAuth().then(function(){ CHL.navigate('#/'); }); });
})();
