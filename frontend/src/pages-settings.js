/* Creator Hub Live — persistent account settings. */
(function(){
  'use strict';
  var CHL = window.CHL; var el = CHL.el, ui = CHL.ui, sb = CHL.sb;
  var lastLoadedSettings = null;
  var SETTING_DEFAULTS = { privacy:{account:'public',messages:'everyone',comments:'everyone'}, notifications:{follows:true,gifts:true,live:true,mentions:true,messages:true,likes:true,comments:true}, live:{audience:'public',guest_permissions:'allowed',max_guests:8}, appearance:{theme:'dark',layout:'classic',font:'system',scale:'1',accent:'violet'} };
  var SNAV=[
    {h:'#/settings/profile',label:'Profile'},{h:'#/settings/security',label:'Security'},
    {h:'#/settings/privacy',label:'Privacy'},{h:'#/settings/notifications',label:'Notifications'},
    {h:'#/settings/payments',label:'Payments'},{h:'#/settings/live',label:'LIVE'},{h:'#/settings/appearance',label:'Appearance'}
  ];
  function snav(){ var bar=el('div',{class:'row wrap',style:'gap:8px;margin-bottom:16px'}); SNAV.forEach(function(it){ var on=CHL.current.path===it.h.replace('#',''); bar.appendChild(el('a',{href:it.h,class:'chip'+(on?' on':'')},it.label)); }); return bar; }
  function head(o,title,sub){ o.appendChild(ui.pageHead(title,sub)); if(!CHL.configured){ o.appendChild(ui.setupNotice()); return true;} o.appendChild(snav()); return false; }
  async function loadSettings(){
    if(!CHL.user) throw new Error('Authentication required.');
    var r=await sb.from('user_settings').select('privacy,notifications,live,appearance').eq('user_id',CHL.user.id).maybeSingle();
    if(r.error) throw r.error;
    var stored = r.data || {};
    lastLoadedSettings = { privacy:Object.assign({},SETTING_DEFAULTS.privacy,stored.privacy||{}), notifications:Object.assign({},SETTING_DEFAULTS.notifications,stored.notifications||{}), live:Object.assign({},SETTING_DEFAULTS.live,stored.live||{}), appearance:Object.assign({},SETTING_DEFAULTS.appearance,stored.appearance||{}) };
    return lastLoadedSettings;
  }
  async function saveSettings(value){
    var base = lastLoadedSettings || SETTING_DEFAULTS;
    // Keep the current appearance preferences when saving another settings category,
    // so changing privacy or LIVE controls never overwrites the appearance choices.
    var currentAppearance = window.CHLStyleSystem && typeof window.CHLStyleSystem.get === 'function'
      ? window.CHLStyleSystem.get()
      : base.appearance;
    var payload = {user_id:CHL.user.id,privacy:value.privacy||base.privacy,notifications:value.notifications||base.notifications,live:value.live||base.live,appearance:value.appearance||currentAppearance||base.appearance,updated_at:new Date().toISOString()};
    var r=await sb.from('user_settings').upsert(payload,{onConflict:'user_id'});
    if(r.error) throw r.error;
    lastLoadedSettings = {privacy:payload.privacy,notifications:payload.notifications,live:payload.live,appearance:payload.appearance};
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
    if(head(o,'Payment settings','PayPal is the only recharge and payout method.')) return;
    if(!CHL.user){o.appendChild(ui.empty('💳','Sign in required','Sign in to manage your PayPal payout email.',el('a',{href:'#/login',class:'btn primary'},'Log in')));return;}
    var card=el('div',{class:'card',style:'max-width:620px'},[el('div',{style:'font-weight:800;margin-bottom:6px',text:'PayPal payout account'}),el('p',{class:'sub',text:'Save the email address connected to your PayPal account. It is used for diamond payout requests; a submitted request is not paid automatically.'}),ui.spinner()]);
    o.appendChild(card); fetchPaypalInfo(card);
  });
  async function fetchPaypalInfo(card){
    try{
      var info=await CHL.authenticatedApiRequest('/api/payments/paypal/info');
      card.innerHTML='';
      card.appendChild(el('div',{style:'font-weight:800;margin-bottom:6px',text:'PayPal payout account'}));
      card.appendChild(el('p',{class:'sub',text:'This is the PayPal email used for diamond payout requests. Coin recharge uses secure PayPal checkout and does not require this payout email.'}));
      var f=el('form',{style:'max-width:500px'});
      var label=el('label',{class:'field'},[el('span',{text:'PayPal email address'})]);
      var input=el('input',{class:'input',type:'email',name:'paypalEmail',required:'required',autocomplete:'email',maxlength:'254',placeholder:'name@example.com'});
      input.value=info.paypalEmail||'';label.appendChild(input);f.appendChild(label);
      var status=el('div',{class:'note','aria-live':'polite',text:info.paypalEmail?(info.isVerified?'Current PayPal email is marked verified.':'Current PayPal email is saved but not marked verified.'):'No PayPal payout email has been saved yet.'});f.appendChild(status);
      var saveButton=el('button',{class:'btn primary',type:'submit',style:'margin-top:8px'},'Save PayPal email');f.appendChild(saveButton);
      f.addEventListener('submit',async function(event){
        event.preventDefault();var email=String(input.value||'').trim().toLowerCase();
        if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)){CHL.toast('Enter a valid PayPal email address.');return;}
        saveButton.disabled=true;saveButton.textContent='Saving…';status.textContent='';
        try{var result=await CHL.authenticatedApiRequest('/api/payments/paypal/info',{method:'PUT',body:{paypalEmail:email}});input.value=result.paypalEmail||email;status.textContent=result.isVerified?'PayPal email saved and marked verified.':'PayPal email saved. Verification is not confirmed.';CHL.toast('PayPal payout email saved.');}
        catch(error){status.textContent=error.message||'Could not save the PayPal email.';CHL.toast(status.textContent);}
        finally{saveButton.disabled=false;saveButton.textContent='Save PayPal email';}
      });
      card.appendChild(f);
      card.appendChild(el('div',{class:'note',style:'margin-top:12px',text:'Payout requests remain subject to review. An authorized administrator confirms the fiat amount and currency and sends the PayPal payout separately.'}));
    }catch(e){card.innerHTML='';card.appendChild(el('div',{class:'note',text:e.message||'Payment settings unavailable.'}));}
  }

  CHL.route('/settings/live', async function(o){
    if(head(o,'LIVE settings','Control who can join your guest stage.')) return;
    var card=el('div',{class:'card'},[ui.spinner()]); o.appendChild(card);
    try{
      var s=await loadSettings(); card.innerHTML='';
      var f=el('form',{onsubmit:async function(e){
        e.preventDefault();
        var v={privacy:s.privacy,notifications:s.notifications,live:{
          audience:f.elements.audience.value,
          guest_permissions:f.elements.guest_permissions.value,
          max_guests:Number(f.elements.max_guests.value)
        }};
        try{await saveSettings(v);}catch(err){CHL.toast(err.message||'Could not save settings.');}
      }});
      f.appendChild(selectField('Default audience','audience',['public','followers','private'],s.live.audience));
      f.appendChild(selectField('Who can request the guest stage','guest_permissions',[
        {value:'allowed',label:'Allow viewers to request to join'},
        {value:'host_only',label:'Host-only: accept invited guests, close viewer requests'}
      ],s.live.guest_permissions));
      f.appendChild(selectField('Maximum accepted guests','max_guests',[1,2,3,4,5,6,7,8].map(function(n){return {value:String(n),label:String(n)+' guest'+(n===1?'':'s')};}),String(s.live.max_guests||8)));
      f.appendChild(el('p',{class:'sub',text:'The host can review requests, accept or reject viewers, invite a creator by username, mute their published audio, stop video, and remove a guest. The host remains on stage separately from the guest limit.'}));
      f.appendChild(el('button',{class:'btn primary',type:'submit'},'Save LIVE settings')); card.appendChild(f);
    }catch(e){card.innerHTML='';card.appendChild(el('div',{class:'note',text:e.message||'Could not load settings.'}));}
  });

  CHL.route('/settings/appearance', async function(o){
    if(head(o,'Appearance','Personalize Creator Hub Live without a floating screen overlay.')) return;
    var card=el('div',{class:'card'},[ui.spinner()]); o.appendChild(card);
    try{
      var s=await loadSettings(); var style=window.CHLStyleSystem;
      if(!style) throw new Error('Appearance controls are unavailable. Reload Creator Hub Live and try again.');
      var current=Object.assign({},style.get(),s.appearance||{}); style.apply(current); current=style.get();
      card.innerHTML='';
      card.appendChild(el('p',{class:'sub',text:'Changes preview immediately and are saved to this device and your account.'}));
      var f=el('form',{style:'max-width:620px',onsubmit:async function(e){
        e.preventDefault();
        var next={theme:f.elements.theme.value,layout:f.elements.layout.value,font:f.elements.font.value,scale:f.elements.scale.value,accent:f.elements.accent.value};
        style.apply(next);
        try{await saveSettings({privacy:s.privacy,notifications:s.notifications,live:s.live,appearance:next});CHL.toast('Appearance saved.');}
        catch(err){CHL.toast(err.message||'Appearance could not be saved.');}
      }});
      f.appendChild(appearanceField('Color theme','theme',style.themes,current.theme));
      f.appendChild(appearanceField('Layout','layout',style.layouts,current.layout));
      f.appendChild(appearanceField('Font','font',style.fonts,current.font));
      f.appendChild(appearanceField('Text size','scale',style.scales,current.scale));
      f.appendChild(appearanceField('Accent color','accent',style.accents,current.accent));
      var status=el('div',{class:'note','aria-live':'polite',text:'Appearance changes do not change wallet prices, gifts, permissions or account settings.'});
      status.id='chl-ui-theme-status'; f.appendChild(status);
      f.appendChild(el('button',{class:'btn primary',type:'submit',style:'margin-top:8px'},'Save appearance'));
      f.appendChild(el('button',{class:'btn',type:'button',style:'margin:8px 0 0 8px',text:'Reset appearance',onclick:async function(){
        var defaults={theme:'dark',layout:'classic',font:'system',scale:'1',accent:'violet'};
        style.apply(defaults); Object.keys(defaults).forEach(function(key){f.elements[key].value=defaults[key];});
        try{await saveSettings({privacy:s.privacy,notifications:s.notifications,live:s.live,appearance:defaults});CHL.toast('Appearance reset and saved.');}
        catch(err){CHL.toast(err.message||'Appearance reset locally but could not be saved to your account.');}
      }}));
      card.appendChild(f);
    }catch(e){card.innerHTML='';card.appendChild(el('div',{class:'note',text:e.message||'Could not load appearance settings.'}));}
  });

  function appearanceField(label,name,items,current){
    var w=el('label',{class:'field'},[el('span',{text:label})]);
    var select=el('select',{class:'input',name:name,'data-chl-appearance':name});
    items.forEach(function(item){select.appendChild(el('option',{value:item.id,selected:item.id===current},item.label));});
    select.value=current;
    select.addEventListener('change',function(){var next=Object.assign({},window.CHLStyleSystem.get());next[name]=select.value;window.CHLStyleSystem.apply(next);});
    w.appendChild(select);return w;
  }
  function selectField(label,name,values,current){
    var w=el('label',{class:'field'},[el('span',{text:label})]);var s=el('select',{class:'input',name:name});
    values.forEach(function(v){var value=(v&&typeof v==='object')?v.value:String(v);var text=(v&&typeof v==='object')?v.label:String(v);s.appendChild(el('option',{value:value,selected:value===String(current)},text));});
    s.value=String(current);w.appendChild(s);return w;
  }
})();
