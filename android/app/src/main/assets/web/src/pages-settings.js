/* Creator Hub Live \u2014 settings (+subpages) and match room. */
(function(){
  'use strict';
  var CHL = window.CHL; var el = CHL.el, ui = CHL.ui, sb = CHL.sb;

  var SNAV=[
    {h:'#/settings/profile',label:'Profile'},{h:'#/settings/security',label:'Security'},
    {h:'#/settings/privacy',label:'Privacy'},{h:'#/settings/notifications',label:'Notifications'},
    {h:'#/settings/payments',label:'Payments'},{h:'#/settings/live',label:'LIVE'}
  ];
  function snav(){
    var bar=el('div',{class:'row wrap',style:'gap:8px;margin-bottom:16px'});
    SNAV.forEach(function(it){ var on=CHL.current.path===it.h.replace('#',''); bar.appendChild(el('a',{href:it.h,class:'chip'+(on?' on':'')},it.label)); });
    return bar;
  }
  function head(o,title,sub){ o.appendChild(ui.pageHead(title,sub)); if(!CHL.configured){ o.appendChild(ui.setupNotice()); return true;} o.appendChild(snav()); return false; }

  CHL.route('/settings', function(o){ if(head(o,'Settings','Manage your account.')) return;
    o.appendChild(el('div',{class:'card',text:'Choose a settings category above.'})); });

  CHL.route('/settings/profile', function(o){ if(head(o,'Profile settings','Edit your public profile.')) return;
    var p=CHL.profile||{};
    var f=el('form',{style:'max-width:520px',onsubmit:function(e){ e.preventDefault(); saveProfile(f); }});
    f.appendChild(CHL._field('Display name','display_name',''));
    f.appendChild(CHL._field('Username','username',''));
    f.appendChild(labelArea('Bio','bio'));
    f.appendChild(el('button',{class:'btn primary',type:'submit'},'Save changes'));
    f.display_name.value=p.display_name||''; f.username.value=p.username||''; if(f.bio) f.bio.value=p.bio||'';
    o.appendChild(f);
  });
  function labelArea(label,name){ var w=el('label',{class:'field'},[ el('span',{text:label}) ]); w.appendChild(el('textarea',{class:'input',name:name,rows:'3'})); return w; }
  function saveProfile(f){
    var u=CHL.user; if(!u) return;
    var patch={display_name:f.display_name.value.trim(),username:f.username.value.trim(),bio:f.bio?f.bio.value.trim():''};
    if(!/^[a-z0-9_]{3,20}$/i.test(patch.username)){ CHL.toast('Username: 3-20 letters/numbers/_'); return; }
    sb.from('profiles').update(patch).eq('id',u.id).then(function(r){ if(r&&r.error){ CHL.toast(r.error.message); return;} CHL.refreshAuth().then(function(){ CHL.toast('Profile saved'); }); });
  }

  CHL.route('/settings/security', function(o){ if(head(o,'Security','Password, sessions and 2FA.')) return;
    o.appendChild(el('div',{class:'card'},[
      el('div',{style:'font-weight:700;margin-bottom:8px',text:'Password'}),
      el('button',{class:'btn',onclick:function(){ if(CHL.user&&CHL.user.email){ sb.auth.resetPasswordForEmail(CHL.user.email).then(function(){ CHL.toast('Reset email sent'); }); } }},'Send password reset email'),
      el('div',{style:'font-weight:700;margin:16px 0 8px',text:'Sessions'}),
      el('button',{class:'btn',onclick:function(){ sb.auth.signOut().then(function(){ CHL.navigate('#/login'); }); }},'Log out of all devices')
    ]));
  });
  CHL.route('/settings/privacy', function(o){ if(head(o,'Privacy','Who can see and contact you.')) return;
    o.appendChild(el('div',{class:'card',text:'Account visibility, who can DM you, blocked and muted accounts. Stored per-user with Row Level Security.'})); });
  CHL.route('/settings/notifications', function(o){ if(head(o,'Notification settings','Choose what you get notified about.')) return;
    o.appendChild(el('div',{class:'card',text:'Toggle follows, gifts, LIVE alerts, mentions and messages.'})); });
  CHL.route('/settings/payments', function(o){ if(head(o,'Payment settings','Manage payout accounts (stored masked).')) return;
    o.appendChild(el('div',{class:'card'},[ el('div',{style:'font-weight:700;margin-bottom:6px',text:'Payout account'}), el('div',{style:'color:var(--mut)',text:'PayPal  r\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022@gmail.com (example mask)'}), el('div',{class:'note',html:'Full account details are entered through secure admin configuration, never stored in the browser.'}) ])); });
  CHL.route('/settings/live', function(o){ if(head(o,'LIVE settings','Defaults for your broadcasts.')) return;
    o.appendChild(el('div',{class:'card',text:'Default audience, moderator list, guest permissions and filters.'})); });

  /* ---- match room ---- */
  CHL.route('/match', function(o,r){
    o.appendChild(ui.pageHead('LIVE Match'));
    if(!CHL.configured){ o.appendChild(ui.setupNotice()); return; }
    if(!r.id){ o.appendChild(ui.empty('\u2694\uFE0F','No match selected','Matches start from inside a LIVE room.')); return; }
    o.appendChild(ui.empty('\u2694\uFE0F','Match not found','This match may have ended.', el('a',{href:'#/discover',class:'btn',style:'margin-top:8px'},'Back to Discover')));
  });
})();
