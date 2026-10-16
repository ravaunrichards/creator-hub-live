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
  function ensureMessagingStyles(){
    if(document.getElementById('chl-messaging-styles'))return;
    var style=document.createElement('style');style.id='chl-messaging-styles';
    style.textContent='.chl-messaging-layout{display:grid;grid-template-columns:minmax(0,.85fr) minmax(0,1.45fr);gap:12px;align-items:start}.chl-message-list,.chl-thread{min-width:0}.chl-conversation{width:100%;text-align:left;display:flex;gap:10px;align-items:center;margin:0 0 8px;padding:12px;border:1px solid var(--line,#353747);border-radius:13px;background:var(--panel,#171824);color:inherit;cursor:pointer}.chl-conversation[aria-current=true]{border-color:var(--chl-accent,#8b75ff);box-shadow:0 0 0 1px var(--chl-accent,#8b75ff)}.chl-conversation-preview{min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:var(--mut,#aaa)}.chl-message-feed{display:flex;flex-direction:column;gap:8px;max-height:55vh;overflow:auto;padding:4px 2px 12px}.chl-message-bubble{max-width:88%;align-self:flex-start;border:1px solid var(--line,#353747);border-radius:14px 14px 14px 4px;padding:10px 12px;overflow-wrap:anywhere;white-space:pre-wrap}.chl-message-bubble.own{align-self:flex-end;background:color-mix(in srgb,var(--chl-accent,#8b75ff) 17%,var(--panel,#171824));border-radius:14px 14px 4px 14px}.chl-message-meta{font-size:11px;color:var(--mut,#aaa);margin-top:5px}.chl-thread-form{display:flex;gap:8px;align-items:end}.chl-thread-form textarea{resize:vertical;min-height:44px;max-height:140px}.chl-notification-unread{border-left:3px solid var(--chl-accent,#8b75ff)}@media(max-width:740px){.chl-messaging-layout{grid-template-columns:minmax(0,1fr)}.chl-message-feed{max-height:44vh}.chl-thread-form{align-items:stretch}.chl-thread-form button{align-self:end}}';
    document.head.appendChild(style);
  }
  CHL.route('/messages', function(o,r){
    if(setup(o,'Messages','Private conversations, message history and read state.'))return;
    if(!CHL.user){o.appendChild(ui.empty('💬','Sign in to message','Log in to see conversations and send direct messages.',el('a',{href:'#/login',class:'btn primary',style:'margin-top:8px'},'Log in')));return;}
    ensureMessagingStyles();var conversationId=r.params&&r.params[0]||null;var layout=el('div',{class:'chl-messaging-layout'});o.appendChild(layout);
    var sidebar=el('section',{class:'card chl-message-list'});var thread=el('section',{class:'card chl-thread'});layout.appendChild(sidebar);layout.appendChild(thread);
    sidebar.appendChild(el('div',{style:'font-size:18px;font-weight:850;margin-bottom:10px',text:'Your conversations'}));
    var newForm=el('form',{style:'display:flex;gap:7px;margin-bottom:12px'});newForm.appendChild(el('input',{class:'input',name:'recipient',placeholder:'Creator username',autocomplete:'off','aria-label':'Creator username'}));var newButton=el('button',{class:'btn',type:'submit',text:'New chat'});newForm.appendChild(newButton);sidebar.appendChild(newForm);
    var list=el('div',{});sidebar.appendChild(list);var refreshButton=el('button',{class:'btn',type:'button',style:'margin-top:8px',text:'Refresh conversations'});sidebar.appendChild(refreshButton);
    async function loadConversations(){list.innerHTML='';list.appendChild(ui.spinner());refreshButton.disabled=true;try{var result=await CHL.authenticatedApiRequest('/api/messages/conversations');list.innerHTML='';var items=result&&result.conversations||[];if(!items.length){list.appendChild(ui.empty('💬','No conversations yet','Open a creator profile and choose Message, or enter a username above.'));return;}items.forEach(function(item){var who=item.isGroup?(item.title||'Group conversation'):(item.participant&&(item.participant.display_name||item.participant.username)||'Creator');var latest=item.lastMessage;var preview=latest?(String(latest.senderId)===String(CHL.user.id)?'You: ':'')+(latest.kind==='image'?'Photo':latest.kind==='voice'?'Voice message':latest.body||'Message'):'No messages yet';var children=[el('div',{class:'ava',style:'flex:0 0 38px;width:38px;height:38px',text:CHL.initials(who).toUpperCase()}),el('div',{style:'flex:1;min-width:0'},[el('div',{style:'font-weight:800;overflow:hidden;text-overflow:ellipsis;white-space:nowrap',text:who}),el('div',{class:'chl-conversation-preview',text:preview}),el('div',{class:'sub',style:'font-size:11px;margin-top:3px',text:latest?CHL.ago(latest.createdAt):CHL.ago(item.createdAt)})])];if(item.unread)children.push(el('span',{class:'badge',text:'New'}));var button=el('button',{class:'chl-conversation',type:'button','aria-current':String(item.id)===String(conversationId)?'true':'false',onclick:function(){CHL.navigate('#/messages/'+item.id);}},children);list.appendChild(button);});}catch(error){list.innerHTML='';list.appendChild(el('div',{class:'note',text:error.message||'Could not load conversations.'}));}finally{refreshButton.disabled=false;}}
    refreshButton.addEventListener('click',loadConversations);
    newForm.addEventListener('submit',async function(event){event.preventDefault();var handle=String(newForm.recipient.value||'').trim().replace(/^@/,'');if(!handle)return;newButton.disabled=true;newButton.textContent='Opening…';try{var result=await CHL.authenticatedApiRequest('/api/messages/conversations',{method:'POST',body:{recipient:handle}});if(!result||!result.conversationId)throw new Error('Conversation could not be opened.');CHL.navigate('#/messages/'+result.conversationId);}catch(error){CHL.toast(error.message||'Could not start a conversation.');}finally{newButton.disabled=false;newButton.textContent='New chat';}});
    async function loadThread(id){thread.innerHTML='';if(!id){thread.appendChild(ui.empty('✉️','Choose a conversation','Select a conversation on the left or start a new chat.'));return;}thread.appendChild(ui.spinner());try{var result=await CHL.authenticatedApiRequest('/api/messages/conversations/'+encodeURIComponent(id)+'/messages');thread.innerHTML='';var other=(result.participants||[]).find(function(user){return String(user.id)!==String(CHL.user.id);});var title=(other&&(other.display_name||other.username))||(result.conversation&&result.conversation.title)||'Conversation';thread.appendChild(el('div',{class:'row wrap',style:'justify-content:space-between;align-items:center;gap:8px;margin-bottom:10px'},[el('div',{style:'font-size:18px;font-weight:850',text:title}),el('a',{href:'#/messages',class:'btn',text:'Back to messages'})]));if(other&&other.username)thread.appendChild(el('div',{class:'sub',style:'margin-bottom:10px',text:'@'+other.username}));var feed=el('div',{class:'chl-message-feed','aria-live':'polite'});thread.appendChild(feed);var messages=result.messages||[];if(!messages.length)feed.appendChild(ui.empty('✉️','Start the conversation','Send a message below.'));messages.forEach(function(message){var bubble=el('div',{class:'chl-message-bubble'+(message.own?' own':'')});bubble.appendChild(el('div',{text:message.body||(message.kind==='image'?'Photo':message.kind==='voice'?'Voice message':'Message')}));var sender=(result.participants||[]).find(function(user){return String(user.id)===String(message.sender_id);});bubble.appendChild(el('div',{class:'chl-message-meta',text:(message.own?'You':(sender&&sender.username?'@'+sender.username:'Creator'))+' · '+new Date(message.created_at).toLocaleString()}));feed.appendChild(bubble);});
      var form=el('form',{class:'chl-thread-form',style:'margin-top:10px'});var messageInput=el('textarea',{class:'input',name:'body',rows:'2',maxlength:'5000',required:'required',placeholder:'Write a private message…','aria-label':'Write a private message',style:'flex:1'});form.appendChild(messageInput);var send=el('button',{class:'btn primary',type:'submit',text:'Send'});form.appendChild(send);thread.appendChild(form);form.addEventListener('submit',async function(event){event.preventDefault();var text=String(messageInput.value||'').trim();if(!text)return;if(text.length>5000){CHL.toast('Messages can contain up to 5,000 characters.');return;}send.disabled=true;send.textContent='Sending…';try{await CHL.authenticatedApiRequest('/api/messages/conversations/'+encodeURIComponent(id)+'/messages',{method:'POST',body:{body:text}});await loadThread(id);await loadConversations();}catch(error){CHL.toast(error.message||'Message could not be sent.');}finally{send.disabled=false;send.textContent='Send';}});feed.scrollTop=feed.scrollHeight;
    }catch(error){thread.innerHTML='';thread.appendChild(el('div',{class:'note',text:error.message||'Could not load this conversation.'}));}}
    loadConversations();loadThread(conversationId).then(function(){if(conversationId)loadConversations();});
  });

  CHL.route('/notifications', function(o){
    if(setup(o,'Notifications','Follow activity, gifts, direct messages and LIVE alerts.'))return;
    if(!CHL.user){o.appendChild(ui.empty('🔔','Sign in to view notifications','Log in to view your account activity.',el('a',{href:'#/login',class:'btn primary',style:'margin-top:8px'},'Log in')));return;}
    var toolbar=el('div',{class:'row wrap',style:'justify-content:space-between;gap:8px;margin-bottom:12px'});var summary=el('div',{class:'sub',text:'Loading notifications…'});var refresh=el('button',{class:'btn',type:'button',text:'Refresh'});var markAll=el('button',{class:'btn',type:'button',text:'Mark all as read'});toolbar.appendChild(summary);toolbar.appendChild(el('div',{class:'row wrap',style:'gap:8px'},[refresh,markAll]));o.appendChild(toolbar);var list=el('div',{class:'grid',style:'grid-template-columns:minmax(0,1fr);gap:8px'});o.appendChild(list);
    async function loadNotifications(){list.innerHTML='';list.appendChild(ui.spinner());refresh.disabled=true;try{var result=await sb.from('notifications').select('id,type,actor_id,data,read,created_at').eq('user_id',CHL.user.id).order('created_at',{ascending:false}).limit(60);if(result.error)throw result.error;var rows=result.data||[];var actorIds=Array.from(new Set(rows.map(function(row){return row.actor_id;}).filter(Boolean)));var actors=[];if(actorIds.length){var actorResult=await sb.from('profiles').select('id,username,display_name').in('id',actorIds);if(actorResult.error)throw actorResult.error;actors=actorResult.data||[];}var actorById={};actors.forEach(function(actor){actorById[String(actor.id)]=actor;});list.innerHTML='';var unread=rows.filter(function(row){return !row.read;}).length;summary.textContent=rows.length+' notifications · '+unread+' unread';markAll.disabled=!unread;if(!rows.length){list.appendChild(ui.empty('🔔','You are all caught up','New account activity will appear here.'));return;}rows.forEach(function(item){var actor=actorById[String(item.actor_id)]||{};var data=item.data&&typeof item.data==='object'?item.data:{};var type=String(item.type||'activity').toLowerCase();var label=type==='message'?'New message':type==='follow'?'New follower':type==='gift'?'Gift received':type==='live'?'LIVE alert':type==='live_guest_invite'?'LIVE guest invitation':type.replace(/[_-]+/g,' ').replace(/^./,function(ch){return ch.toUpperCase();});var name=actor.display_name||actor.username||'';var detail=type==='message'?(name?name+' sent you a message.':'You received a direct message.'):type==='follow'?(name?name+' followed you.':'You have a new follower.'):type==='gift'?(name?name+' sent you a gift.':'You received a gift.'):type==='live'?(name?name+' is LIVE.':'A creator you follow is LIVE.'):type==='live_guest_invite'?(name?name+' invited you to join a LIVE guest stage.':'You were invited to join a LIVE guest stage.'):name?name+' · '+label:label;var card=el('article',{class:'card'+(!item.read?' chl-notification-unread':'')});card.appendChild(el('div',{class:'row wrap',style:'justify-content:space-between;align-items:start;gap:8px'},[el('div',{style:'font-weight:850',text:label}),el('div',{class:'sub',style:'font-size:11px',text:CHL.ago(item.created_at)})]));card.appendChild(el('div',{style:'margin-top:6px',text:detail}));var actions=el('div',{class:'row wrap',style:'gap:8px;margin-top:10px'});if(type==='message'&&data.conversation_id)actions.appendChild(el('a',{class:'btn',href:'#/messages/'+data.conversation_id,text:'Open message'}));else if(type==='live_guest_invite'&&data.live_id)actions.appendChild(el('a',{class:'btn primary',href:'#/live/'+encodeURIComponent(data.live_id),text:'Open LIVE'}));else if(actor.username)actions.appendChild(el('a',{class:'btn',href:'#/profile/'+actor.username,text:'View profile'}));if(!item.read)actions.appendChild(el('button',{class:'btn',type:'button',text:'Mark read',onclick:async function(){var update=await sb.from('notifications').update({read:true}).eq('id',item.id).eq('user_id',CHL.user.id);if(update.error){CHL.toast(update.error.message||'Could not mark as read.');return;}loadNotifications();}}));card.appendChild(actions);list.appendChild(card);});}catch(error){list.innerHTML='';summary.textContent='Notifications unavailable';list.appendChild(el('div',{class:'note',text:error.message||'Could not load notifications.'}));}finally{refresh.disabled=false;}}
    async function markAllRead(){markAll.disabled=true;try{var result=await sb.from('notifications').update({read:true}).eq('user_id',CHL.user.id).eq('read',false);if(result.error)throw result.error;await loadNotifications();}catch(error){CHL.toast(error.message||'Could not mark notifications as read.');markAll.disabled=false;}}
    refresh.addEventListener('click',loadNotifications);markAll.addEventListener('click',markAllRead);loadNotifications();
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
