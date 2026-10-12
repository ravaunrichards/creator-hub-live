/* Creator Hub Creator Network — persistent account settings. */
(function(){
  'use strict';
  var CHL = window.CHL; var el = CHL.el, ui = CHL.ui, sb = CHL.sb;
  var SNAV=[
    {h:'#/settings/profile',label:'Profile'},{h:'#/settings/security',label:'Security'},
    {h:'#/settings/privacy',label:'Privacy'},{h:'#/settings/notifications',label:'Notifications'},
    {h:'#/settings/payments',label:'Payments'},{h:'#/settings/live',label:'LIVE'}
  ];
  function snav(){ var bar=el('div',{class:'row wrap',style:'gap:8px;margin-bottom:16px'}); SNAV.forEach(function(it){ var on=CHL.current.path===it.h.replace('#',''); bar.appendChild(el('a',{href:it.h,class:'chip'+(on?' on':'')},it.label)); }); return bar; }
  function head(o,title,sub){ o.appendChild(ui.pageHead(title,sub)); if(!CHL.configured){ o.appendChild(ui.setupNotice()); return true;} o.appendChild(snav()); return false; }
  async function loadSettings(){
    if(!CHL.user) throw new Error('Authentication required.');
    var r=await sb.from('user_settings').select('privacy,notifications,live').eq('user_id',CHL.user.id).maybeSingle();
    if(r.error) throw r.error;
    return r.data || {privacy:{account:'public',messages:'everyone',comments:'everyone'},notifications:{follows:true,gifts:true,live:true,mentions:true,messages:true},live:{audience:'public',guest_permissions:'allowed'}};
  }
  async function saveSettings(value){
    var r=await sb.from('user_settings').upsert({user_id:CHL.user.id,privacy:value.privacy,notifications:value.notifications,live:value.live,updated_at:new Date().toISOString()},{onConflict:'user_id'});
    if(r.error) throw r.error;
    CHL.toast('Settings saved');
  }
  function check(name,label,checked){ return el('label',{class:'row',style:'gap:8px;margin:10px 0'},[el('input',{type:'checkbox',name:name,checked:!!checked}),el('span',{text:label})]); }

  CHL.route('/settings', function(o){ if(head(o,'Settings','Manage your account.')) return; o.appendChild(el('div',{class:'card',text:'Choose a settings category above. Account settings are stored with your profile and restored after reopening.'})); });

  CHL.route('/settings/profile', function(o){ if(head(o,'Profile settings','Edit your public profile.')) return; var p=CHL.profile||{}; var f=el('form',{style:'max-width:520px',onsubmit:function(e){e.preventDefault();saveProfile(f);}}); f.appendChild(CHL._field('Display name','display_name','')); f.appendChild(CHL._field('Username','username','')); f.appendChild(labelArea('Bio','bio')); f.appendChild(el('button',{class:'btn primary',type:'submit'},'Save changes')); f.display_name.value=p.display_name||''; f.username.value=p.username||''; if(f.bio) f.bio.value=p.bio||''; o.appendChild(f); });
  function labelArea(label,name){ var w=el('label',{class:'field'},[el('span',{text:label})]); w.appendChild(el('textarea',{class:'input',name:name,rows:'3'})); return w; }
  function saveProfile(f){ var u=CHL.user; if(!u) return; var patch={display_name:f.display_name.value.trim(),username:f.username.value.trim(),bio:f.bio?f.bio.value.trim():''}; if(!/^[a-z0-9_]{3,20}$/i.test(patch.username)){CHL.toast('Username: 3-20 letters/numbers/_');return;} sb.from('profiles').update(patch).eq('id',u.id).then(function(r){if(r&&r.error){CHL.toast(r.error.message);return;} CHL.refreshAuth().then(function(){CHL.toast('Profile saved');});}); }

  CHL.route('/settings/security', function(o){ if(head(o,'Security','Password, sessions and 2FA.')) return; o.appendChild(el('div',{class:'card'},[el('div',{style:'font-weight:700;margin-bottom:8px',text:'Password'}),el('button',{class:'btn',onclick:function(){if(CHL.user&&CHL.user.email){sb.auth.resetPasswordForEmail(CHL.user.email).then(function(r){CHL.toast(r.error?r.error.message:'Reset email sent');});}}},'Send password reset email'),el('div',{style:'font-weight:700;margin:16px 0 8px',text:'Sessions'}),el('button',{class:'btn',onclick:function(){sb.auth.signOut().then(function(){CHL.navigate('#/login');});}},'Log out') ])); });

  CHL.route('/settings/privacy', async function(o){ if(head(o,'Privacy','Who can see and contact you.')) return; var card=el('div',{class:'card'},[ui.spinner()]); o.appendChild(card); try{var s=await loadSettings(); card.innerHTML=''; var f=el('form',{onsubmit:async function(e){e.preventDefault();var v={privacy:{account:f.account.value,messages:f.messages.value,comments:f.comments.value},notifications:s.notifications,live:s.live};try{await saveSettings(v);}catch(err){CHL.toast(err.message||'Could not save settings.');}}}); f.appendChild(selectField('Account visibility','account',['public','followers','private'],s.privacy.account)); f.appendChild(selectField('Who can message you','messages',['everyone','followers','nobody'],s.privacy.messages)); f.appendChild(selectField('Who can comment','comments',['everyone','followers','nobody'],s.privacy.comments)); f.appendChild(el('button',{class:'btn primary',type:'submit'},'Save privacy settings')); card.appendChild(f);}catch(e){card.innerHTML='';card.appendChild(el('div',{class:'note',text:e.message||'Could not load settings.'}));}});

  CHL.route('/settings/notifications', async function(o){ if(head(o,'Notification settings','Choose what you get notified about.')) return; var card=el('div',{class:'card'},[ui.spinner()]); o.appendChild(card); try{var s=await loadSettings(); card.innerHTML=''; var f=el('form',{onsubmit:async function(e){e.preventDefault();var n={follows:f.follows.checked,gifts:f.gifts.checked,live:f.live.checked,mentions:f.mentions.checked,messages:f.messages.checked};try{await saveSettings({privacy:s.privacy,notifications:n,live:s.live});}catch(err){CHL.toast(err.message||'Could not save settings.');}}}); f.appendChild(check('follows','New followers',s.notifications.follows)); f.appendChild(check('gifts','Gifts',s.notifications.gifts)); f.appendChild(check('live','LIVE alerts',s.notifications.live)); f.appendChild(check('mentions','Mentions',s.notifications.mentions)); f.appendChild(check('messages','Messages',s.notifications.messages)); f.appendChild(el('button',{class:'btn primary',type:'submit'},'Save notification settings')); card.appendChild(f);}catch(e){card.innerHTML='';card.appendChild(el('div',{class:'note',text:e.message||'Could not load settings.'}));}});

  CHL.route('/settings/payments', function(o){
    if(head(o,'Payment settings','Manage the PayPal destination used for creator payout requests.')) return;
    if(!CHL.user){o.appendChild(ui.empty('💳','Sign in required','Sign in to view your payment settings.',el('a',{href:'#/login',class:'btn primary'},'Log in')));return;}
    var card=el('div',{class:'card',style:'max-width:640px;min-width:0'},[
      el('div',{style:'font-weight:700;margin-bottom:6px',text:'PayPal payout account'}),
      el('div',{class:'note',text:'Only your PayPal email is stored here. PayPal Client ID, Client Secret and access tokens must never be entered on this page.'})
    ]);
    var form=el('form',{style:'display:flex;flex-wrap:wrap;gap:10px;align-items:flex-end;margin-top:14px'});
    var input=el('input',{class:'input',type:'email',name:'paypalEmail',autocomplete:'email',required:true,placeholder:'name@example.com'});
    var field=el('label',{class:'field',style:'flex:1 1 260px;min-width:0'},[el('span',{text:'PayPal email address'}),input]);
    var save=el('button',{class:'btn primary',type:'submit'},'Save PayPal account');
    var feedback=el('div',{style:'width:100%'});
    form.appendChild(field);form.appendChild(save);form.appendChild(feedback);card.appendChild(form);o.appendChild(card);
    fetchPaypalInfo(input,feedback,save);
    form.addEventListener('submit',async function(event){
      event.preventDefault();feedback.innerHTML='';
      var email=String(input.value||'').trim().toLowerCase();
      if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)){feedback.appendChild(el('div',{class:'note',text:'Enter a valid PayPal email address.'}));return;}
      save.disabled=true;save.textContent='Saving…';
      try{
        var result=await CHL.authenticatedApiRequest('/api/payments/paypal/info',{method:'PUT',body:{paypalEmail:email}});
        if(!result||result.saved!==true)throw new Error('The backend did not confirm the PayPal account was saved.');
        input.value=result.paypalEmail||email;
        feedback.appendChild(el('div',{class:'note',text:'PayPal payout destination saved. This does not mean the account has been independently verified or that a payout has been sent.'}));
      }catch(error){feedback.appendChild(el('div',{class:'note',text:(error&&error.message)||'Could not save the PayPal payout destination.'}));}
      finally{save.disabled=false;save.textContent='Save PayPal account';}
    });
  });
  async function fetchPaypalInfo(input,feedback,save){
    try{
      var r=await CHL.authenticatedApiRequest('/api/payments/paypal/info');
      input.value=r&&r.paypalEmail||'';
      if(r&&r.paypalEmail)feedback.appendChild(el('div',{class:'note',text:(r.isVerified?'PayPal account status: marked verified. ':'PayPal account saved; independent verification has not been confirmed. ')+(r.updatedAt?'Last updated: '+new Date(r.updatedAt).toLocaleString(): '')}));
      else feedback.appendChild(el('div',{class:'note',text:'No PayPal payout account is saved yet.'}));
    }catch(e){feedback.appendChild(el('div',{class:'note',text:e.message||'Payment settings unavailable.'}));}
  }

  CHL.route('/settings/live', async function(o){ if(head(o,'LIVE settings','Defaults for your broadcasts.')) return; var card=el('div',{class:'card'},[ui.spinner()]); o.appendChild(card); try{var s=await loadSettings();card.innerHTML='';var f=el('form',{onsubmit:async function(e){e.preventDefault();var v={privacy:s.privacy,notifications:s.notifications,live:{audience:f.audience.value,guest_permissions:f.guest_permissions.value}};try{await saveSettings(v);}catch(err){CHL.toast(err.message||'Could not save settings.');}}});f.appendChild(selectField('Default audience','audience',['public','followers','private'],s.live.audience));f.appendChild(selectField('Guest permissions','guest_permissions',['allowed','host_only'],s.live.guest_permissions));f.appendChild(el('button',{class:'btn primary',type:'submit'},'Save LIVE settings'));card.appendChild(f);}catch(e){card.innerHTML='';card.appendChild(el('div',{class:'note',text:e.message||'Could not load settings.'}));}});

  function selectField(label,name,values,current){var w=el('label',{class:'field'},[el('span',{text:label})]);var s=el('select',{class:'input',name:name});values.forEach(function(v){s.appendChild(el('option',{value:v,selected:v===current},v));});w.appendChild(s);return w;}
})();
