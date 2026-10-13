/* Creator Hub Creator Network — persistent account settings. */
(function(){
  'use strict';
  var CHL = window.CHL; var el = CHL.el, ui = CHL.ui, sb = CHL.sb;
  var SNAV=[
    {h:'#/settings/profile',label:'Profile'},{h:'#/settings/security',label:'Security'},
    {h:'#/settings/privacy',label:'Privacy'},{h:'#/settings/notifications',label:'Notifications'},
    {h:'#/settings/payments',label:'Payments'},{h:'#/settings/live',label:'LIVE'},{h:'#/settings/accessibility',label:'Accessibility'},{h:'#/settings/appearance',label:'Appearance'},{h:'#/settings/language',label:'Language'}
  ];
  function snav(){ var bar=el('div',{class:'row wrap',style:'gap:8px;margin-bottom:16px'}); SNAV.forEach(function(it){ var on=CHL.current.path===it.h.replace('#',''); bar.appendChild(el('a',{href:it.h,class:'chip'+(on?' on':'')},it.label)); }); return bar; }
  function head(o,title,sub){ o.appendChild(ui.pageHead(title,sub)); if(!CHL.configured){ o.appendChild(ui.setupNotice()); return true;} o.appendChild(snav()); return false; }
  async function loadSettings(){
    if(!CHL.user) throw new Error('Authentication required.');
    var results=await Promise.all([
      sb.from('user_settings').select('privacy,notifications,live').eq('user_id',CHL.user.id).maybeSingle(),
      sb.from('profiles').select('privacy').eq('id',CHL.user.id).maybeSingle()
    ]);
    if(results[0].error) throw results[0].error;
    if(results[1].error) throw results[1].error;
    var stored=results[0].data||{};
    var profilePrivacy=results[1].data&&results[1].data.privacy;
    return {
      privacy:profilePrivacy||stored.privacy||{account:'public',messages:'everyone',comments:'everyone'},
      notifications:Object.assign({follows:true,gifts:true,live:true,mentions:true,messages:true,likes:true,comments:true,battles:true},stored.notifications||{}),
      live:Object.assign({audience:'public',guest_permissions:'allowed'},stored.live||{})
    };
  }
  async function saveSettings(value){
    var r=await sb.rpc('save_my_user_settings',{p_privacy:value.privacy,p_notifications:value.notifications,p_live:value.live});
    if(r.error) throw r.error;
    CHL.toast('Settings saved securely to your account');
  }
  function check(name,label,checked){ return el('label',{class:'row',style:'gap:8px;margin:10px 0'},[el('input',{type:'checkbox',name:name,checked:!!checked}),el('span',{text:label})]); }

  CHL.route('/settings', function(o){
    if(head(o,'Settings','Organized controls for your account, content, LIVE experience and device.')) return;
    var groups=[
      ['Account',[['Edit profile','Display name, username, bio, profile and cover images.','#/settings/profile'],['Account information','Email status, account ID and membership details.','#/settings/account'],['Password & login','Password reset and sign-out.','#/settings/security'],['Connected accounts','Review linked sign-in identities.','#/settings/connected'],['Followers & following','Review the creators connected to your account.','#/profile/followers'],['Blocked accounts','Manage accounts you have blocked.','#/settings/blocked']]],
      ['Privacy & safety',[['Privacy settings','Account visibility, messages and comments.','#/settings/privacy'],['Messaging settings','Who can start a conversation with you.','#/settings/messaging'],['Verification','Submit an application for manual creator verification review.','#/settings/verification'],['Download your data','Export available account-owned records.','#/settings/data'],['Data & connectivity','Check browser, Supabase and backend status.','#/settings/connectivity'],['Deactivate or delete account','Account access and permanent deletion controls.','#/settings/deletion']]],
      ['Notifications & creator tools',[['Notification settings','Choose activity alerts, including battle invitations.','#/settings/notifications'],['Payment settings','Manage your PayPal payout destination.','#/settings/payments'],['Wallet','Coin balance, payment methods and transaction history.','#/wallet'],['LIVE defaults','Set your audience and guest-permission defaults.','#/settings/live'],['Creator statistics','View recorded creator activity and earnings.','#/creator/analytics']]],
      ['Experience & information',[['Appearance','Compact, Balanced or Spacious layouts with Dark, Light or Follow Device themes.','#/settings/appearance'],['Accessibility','Text scale, reduced motion and contrast.','#/settings/accessibility'],['Language & region','Speech language and account profile language/region.','#/settings/language'],['Terms & privacy','Read terms, privacy policy and community rules.','#/settings/legal'],['Help & support','Help topics and safety reporting.','#/help'],['About CHL CREATOR HUB','Platform details and current feature scope.','#/about']]]
    ];
    groups.forEach(function(g){var section=el('section',{class:'settings-group'});section.appendChild(el('h2',{class:'section-title',text:g[0]}));var grid=el('div',{class:'grid settings-grid'});g[1].forEach(function(x){grid.appendChild(el('a',{class:'card settings-card',href:x[2]},[el('div',{style:'font-weight:750',text:x[0]}),el('div',{class:'u',text:x[1]}),el('span',{class:'u',text:'Open settings →',style:'margin-top:7px'} )]));});section.appendChild(grid);o.appendChild(section);});
    o.appendChild(el('button',{class:'btn',type:'button',style:'margin-top:6px',onclick:async function(){try{var r=await sb.auth.signOut();if(r.error)throw r.error;CHL.user=null;CHL.profile=null;CHL.navigate('#/login');}catch(e){CHL.toast(e.message||'Could not sign out.');}}},'Log out'));
  });

  CHL.route('/settings/profile', function(o){
    if(head(o,'Profile settings','Edit your public profile details. Image upload requires the configured Supabase Storage bucket and user-owned upload policies.')) return;
    if(!CHL.user){o.appendChild(ui.empty('🔐','Sign in required','Sign in to edit your profile.',el('a',{href:'#/login',class:'btn primary'},'Log in')));return;}
    var p=CHL.profile||{};
    var f=el('form',{class:'card form-stack',style:'max-width:760px',onsubmit:function(e){e.preventDefault();saveProfile(f);}});
    f.appendChild(CHL._field('Display name','display_name','Your display name'));
    f.appendChild(CHL._field('Username','username','3–30 letters, numbers, dots or underscores'));
    f.appendChild(labelArea('Bio (up to 500 characters)','bio'));
    f.bio.maxLength=500;
    f.appendChild(CHL._field('Country / region','country','Country or region'));
    f.appendChild(CHL._field('Profile language','language','e.g. en-JM'));
    f.appendChild(CHL._field('Creator category','creator_category','e.g. Music, Gaming, Lifestyle'));
    f.appendChild(el('label',{class:'field'},[el('span',{class:'field-label',text:'Profile / avatar image (optional)'}),el('input',{class:'input',type:'file',name:'avatar_file',accept:'image/jpeg,image/png,image/webp'})]));
    f.appendChild(el('label',{class:'field'},[el('span',{class:'field-label',text:'Cover image (optional)'}),el('input',{class:'input',type:'file',name:'cover_file',accept:'image/jpeg,image/png,image/webp'})]));
    f.appendChild(el('div',{class:'note',text:'Images upload to the configured creator-content bucket. If that bucket or its policies do not allow profile media, the form reports the error instead of pretending the upload worked.'}));
    f.appendChild(el('button',{class:'btn primary',type:'submit'},'Save profile'));
    f.display_name.value=p.display_name||'';f.username.value=p.username||'';f.bio.value=p.bio||'';f.country.value=p.country||'';f.language.value=p.language||'en';f.creator_category.value=p.creator_category||'';
    o.appendChild(f);
  });
  function labelArea(label,name){ var w=el('label',{class:'field'},[el('span',{text:label})]); w.appendChild(el('textarea',{class:'input',name:name,rows:'3'})); return w; }
  async function saveProfile(f){
    var u=CHL.user;if(!u)return;var btn=f.querySelector('button[type=submit]');btn.disabled=true;var original=btn.textContent;btn.textContent='Saving…';
    try{
      var username=f.username.value.trim();
      if(!/^[A-Za-z0-9_.]{3,30}$/.test(username))throw new Error('Username must be 3–30 letters, numbers, dots or underscores.');
      if(f.display_name.value.trim().length>80)throw new Error('Display name must be 80 characters or fewer.');
      if(f.bio.value.trim().length>500)throw new Error('Bio must be 500 characters or fewer.');
      if(username!==(CHL.profile&&CHL.profile.username||'')){var duplicate=await sb.from('profiles').select('id').eq('username',username).neq('id',u.id).maybeSingle();if(duplicate.error)throw duplicate.error;if(duplicate.data)throw new Error('That username is already in use.');}
      var bucket=(CHL.cfg.storage&&CHL.cfg.storage.bucket)||'';
      async function upload(control,name){var file=control.files&&control.files[0];if(!file)return null;if(!bucket)throw new Error('Profile image upload is not configured: set the creator-content Storage bucket first.');if(!/^image\/(jpeg|png|webp)$/.test(file.type))throw new Error('Choose a JPEG, PNG or WebP image.');if(file.size>8*1024*1024)throw new Error('Each profile image must be 8 MB or smaller.');var ext=file.type==='image/jpeg'?'jpg':file.type.split('/')[1];var path=u.id+'/'+name+'-'+CHL.uuid()+'.'+ext;var result=await sb.storage.from(bucket).upload(path,file,{upsert:false,contentType:file.type});if(result.error)throw result.error;var url=sb.storage.from(bucket).getPublicUrl(result.data.path);if(!url.data||!url.data.publicUrl)throw new Error('Storage did not return a public URL.');return url.data.publicUrl;}
      var avatar=await upload(f.avatar_file,'avatar');var cover=await upload(f.cover_file,'cover');
      var patch={display_name:f.display_name.value.trim(),username:username,bio:f.bio.value.trim(),country:f.country.value.trim()||null,language:f.language.value.trim()||'en',creator_category:f.creator_category.value.trim()||null,updated_at:new Date().toISOString()};
      if(avatar)patch.avatar_url=avatar;if(cover)patch.cover_url=cover;
      var saved=await sb.from('profiles').update(patch).eq('id',u.id);if(saved.error)throw saved.error;
      await CHL.refreshAuth();CHL.toast('Profile saved.');CHL.render();
    }catch(e){CHL.toast((e&&e.message)||'Could not save profile.');}
    finally{btn.disabled=false;btn.textContent=original;}
  }

  CHL.route('/settings/security', function(o){
    if(head(o,'Password & login','Send a secure password-reset email or sign out of this device.'))return;
    var reset=el('button',{class:'btn',type:'button',onclick:async function(event){var b=event.currentTarget;b.disabled=true;try{if(!CHL.user||!CHL.user.email)throw new Error('No account email is available for password recovery.');var r=await sb.auth.resetPasswordForEmail(CHL.user.email,{redirectTo:location.origin+location.pathname+'#/reset-password'});if(r.error)throw r.error;CHL.toast('If the address belongs to an account, a password-reset email has been requested.');}catch(e){CHL.toast(e.message||'Could not request a password-reset email.');}finally{b.disabled=false;}}},'Send password reset email');
    var logout=el('button',{class:'btn',type:'button',onclick:async function(event){var b=event.currentTarget;b.disabled=true;try{var r=await sb.auth.signOut();if(r.error)throw r.error;CHL.user=null;CHL.profile=null;CHL.navigate('#/login');}catch(e){CHL.toast(e.message||'Could not sign out.');b.disabled=false;}}},'Log out');
    o.appendChild(el('div',{class:'card form-stack',style:'max-width:650px'},[el('h2',{class:'section-title',text:'Password recovery'}),el('p',{class:'u',text:'Two-factor authentication and active-session management are not implemented in this release. Do not treat this page as providing those protections.'}),reset,el('hr',{}),el('h2',{class:'section-title',text:'Current device'}),logout]));
  });

  CHL.route('/settings/privacy', async function(o){ if(head(o,'Privacy','Who can see and contact you.')) return; var card=el('div',{class:'card'},[ui.spinner()]); o.appendChild(card); try{var s=await loadSettings(); card.innerHTML=''; var f=el('form',{onsubmit:async function(e){e.preventDefault();var v={privacy:{account:f.account.value,messages:f.messages.value,comments:f.comments.value},notifications:s.notifications,live:s.live};try{await saveSettings(v);}catch(err){CHL.toast(err.message||'Could not save settings.');}}}); f.appendChild(selectField('Account visibility','account',['public','followers','private'],s.privacy.account)); f.appendChild(selectField('Who can message you','messages',['everyone','followers','nobody'],s.privacy.messages)); f.appendChild(selectField('Who can comment','comments',['everyone','followers','nobody'],s.privacy.comments)); f.appendChild(el('button',{class:'btn primary',type:'submit'},'Save privacy settings')); card.appendChild(f);}catch(e){card.innerHTML='';card.appendChild(el('div',{class:'note',text:e.message||'Could not load settings.'}));}});

  CHL.route('/settings/notifications', async function(o){ if(head(o,'Notification settings','Choose what you get notified about.')) return; var card=el('div',{class:'card'},[ui.spinner()]); o.appendChild(card); try{var s=await loadSettings(); card.innerHTML=''; var f=el('form',{onsubmit:async function(e){e.preventDefault();var n={follows:f.follows.checked,gifts:f.gifts.checked,live:f.live.checked,mentions:f.mentions.checked,messages:f.messages.checked,likes:f.likes.checked,comments:f.comments.checked,battles:f.battles.checked};try{await saveSettings({privacy:s.privacy,notifications:n,live:s.live});}catch(err){CHL.toast(err.message||'Could not save settings.');}}}); f.appendChild(check('follows','New followers',s.notifications.follows)); f.appendChild(check('gifts','Gifts',s.notifications.gifts)); f.appendChild(check('live','LIVE alerts',s.notifications.live)); f.appendChild(check('mentions','Mentions',s.notifications.mentions)); f.appendChild(check('messages','Messages',s.notifications.messages)); f.appendChild(check('likes','Likes on your posts',s.notifications.likes)); f.appendChild(check('comments','Comments on your posts',s.notifications.comments)); f.appendChild(check('battles','Battle invitations and status updates',s.notifications.battles)); f.appendChild(el('button',{class:'btn primary',type:'submit'},'Save notification settings')); card.appendChild(f);}catch(e){card.innerHTML='';card.appendChild(el('div',{class:'note',text:e.message||'Could not load settings.'}));}});

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

  CHL.route('/settings/messaging', async function(o){
    if(head(o,'Messaging settings','Choose who may start a direct conversation with you.'))return;
    if(!CHL.user){o.appendChild(ui.empty('🔐','Sign in required','Sign in to change messaging preferences.',el('a',{href:'#/login',class:'btn primary'},'Log in')));return;}
    var card=el('div',{class:'card form-stack',style:'max-width:650px'},[ui.spinner()]);o.appendChild(card);
    try{var s=await loadSettings();card.innerHTML='';var f=el('form',{onsubmit:async function(e){e.preventDefault();var v={privacy:{account:s.privacy.account,messages:f.messages.value,comments:s.privacy.comments},notifications:s.notifications,live:s.live};var b=f.querySelector('button[type=submit]');b.disabled=true;try{await saveSettings(v);s.privacy.messages=f.messages.value;}catch(err){CHL.toast(err.message||'Could not save messaging settings.');}finally{b.disabled=false;}}});
      f.appendChild(selectField('Who can message you','messages',['everyone','followers','nobody'],s.privacy.messages));
      f.appendChild(el('div',{class:'note',text:'“Followers” follows the platform’s accepted-follow relationship. Account-level messaging restrictions are also checked by the database conversation function.'}));
      f.appendChild(el('button',{class:'btn primary',type:'submit'},'Save messaging settings'));card.appendChild(f);
    }catch(e){card.innerHTML='';card.appendChild(el('div',{class:'note',text:e.message||'Could not load messaging settings.'}));}
  });

  CHL.route('/settings/appearance', async function(o){
    if(head(o,'Appearance & layout','Choose how Creator Hub fits your screen. Changes preview immediately; Apply saves them to this device and, when available, your account.'))return;
    var defaults={layout:'balanced',theme:'system'};
    function normalize(raw){raw=raw&&typeof raw==='object'?raw:{};var density=raw.layout==='comfortable'?'balanced':raw.layout;return {layout:['compact','balanced','spacious'].indexOf(density)>=0?density:'balanced',theme:['dark','light','system'].indexOf(raw.theme)>=0?raw.theme:'system'};}
    function apply(v){var root=document.documentElement;root.classList.toggle('compact-ui',v.layout==='compact');root.classList.toggle('balanced-ui',v.layout==='balanced');root.classList.toggle('spacious-ui',v.layout==='spacious');root.dataset.chcnTheme=v.theme;root.style.colorScheme=v.theme==='system'?'light dark':v.theme;}
    var local=defaults;try{local=normalize(JSON.parse(localStorage.getItem('chcn_appearance')||'{}'));}catch(_){}
    apply(local);
    var userPreviewed=false;
    var card=el('section',{class:'card form-stack appearance-settings',style:'max-width:760px'});
    var layout=el('select',{class:'input',name:'appearanceLayout'},[
      el('option',{value:'compact'},'Compact — fit more on screen'),
      el('option',{value:'balanced'},'Balanced — professional default'),
      el('option',{value:'spacious'},'Spacious — more breathing room')
    ]);
    var theme=el('select',{class:'input',name:'appearanceTheme'},[
      el('option',{value:'dark'},'Premium Dark'),el('option',{value:'light'},'Clean Light'),el('option',{value:'system'},'Follow Device')
    ]);
    layout.value=local.layout;theme.value=local.theme;
    card.appendChild(el('label',{class:'field'},[el('span',{class:'field-label',text:'Layout density'}),layout]));
    card.appendChild(el('label',{class:'field'},[el('span',{class:'field-label',text:'Color theme'}),theme]));
    var preview=el('div',{class:'appearance-preview'});
    preview.appendChild(el('div',{class:'appearance-preview-head',text:'Live preview'}));
    var sample=el('div',{class:'appearance-preview-sample card'},[
      el('div',{class:'appearance-preview-brand',text:'CREATOR HUB CREATOR NETWORK'}),
      el('div',{class:'appearance-preview-title',text:'Your space. Your style.'}),
      el('p',{class:'u',text:'A readable, responsive creator experience across mobile, tablet and desktop.'}),
      el('div',{class:'row wrap appearance-preview-actions',style:'gap:8px'},[el('span',{class:'btn primary',text:'Primary action'}),el('span',{class:'chip',text:'Preview badge'})])
    ]);
    preview.appendChild(sample);card.appendChild(preview);
    var note=el('div',{class:'note',text:'Preview only — settings are not saved until you press Apply & Save.'});card.appendChild(note);
    var save=el('button',{class:'btn primary',type:'button',text:'Apply & Save'});card.appendChild(save);
    var reset=el('button',{class:'btn',type:'button',text:'Reset preview to Balanced + Follow Device',onclick:function(){layout.value='balanced';theme.value='system';apply(normalize({layout:layout.value,theme:theme.value}));note.textContent='Preview reset. Press Apply & Save to keep these choices.';}});card.appendChild(reset);
    o.appendChild(card);
    function previewChanges(){userPreviewed=true;var v=normalize({layout:layout.value,theme:theme.value});apply(v);note.textContent='Live preview active. Press Apply & Save to keep these choices.';}
    layout.addEventListener('change',previewChanges);theme.addEventListener('change',previewChanges);
    async function loadAccountPreference(){
      if(!CHL.user){note.textContent='Not signed in: appearance can be saved on this device. Sign in to synchronize it to your account.';return;}
      try{
        var result=await sb.from('user_settings').select('appearance').eq('user_id',CHL.user.id).maybeSingle();
        if(result.error)throw result.error;
        if(result.data&&result.data.appearance){var account=normalize(result.data.appearance);if(!userPreviewed){layout.value=account.layout;theme.value=account.theme;apply(account);try{localStorage.setItem('chcn_appearance',JSON.stringify(account));}catch(_){}note.textContent='Loaded your saved account appearance. You can preview another style before applying it.';}else{note.textContent='Account preference loaded; your live preview choice is preserved until you choose Apply & Save.';}}
        else note.textContent='No account appearance saved yet. Your current device preference remains in preview; Apply & Save will synchronize it.';
      }catch(e){note.textContent='Account synchronization is unavailable until the required settings migration is installed. Your local preview still works. ('+String((e&&e.message)||'settings unavailable').slice(0,180)+')';}
    }
    save.addEventListener('click',async function(){
      var v=normalize({layout:layout.value,theme:theme.value});apply(v);save.disabled=true;save.textContent='Saving…';var localSaved=false;
      try{localStorage.setItem('chcn_appearance',JSON.stringify(v));localSaved=true;}catch(_){}
      if(CHL.user){
        try{var stored=await sb.from('user_settings').upsert({user_id:CHL.user.id,appearance:v,updated_at:new Date().toISOString()},{onConflict:'user_id'});if(stored.error)throw stored.error;note.textContent='Applied and saved on this device and to your Creator Hub account.';CHL.toast('Appearance saved to your account and device.');}
        catch(e){note.textContent=(localSaved?'Applied and saved on this device. ':'Applied for this session. ')+'Account sync failed; it will work after the appearance/settings migration is installed. '+String((e&&e.message)||'').slice(0,150);CHL.toast('Appearance applied locally; account synchronization failed.');}
      }else{note.textContent=localSaved?'Applied and saved on this device. Sign in to synchronize appearance across devices.':'Applied for this session; browser storage is unavailable.';CHL.toast(localSaved?'Appearance saved on this device.':'Appearance applied for this session.');}
      save.disabled=false;save.textContent='Apply & Save';
    });
    await loadAccountPreference();
  });
  CHL.route('/settings/language',function(o){
    if(head(o,'Language & region','Account locale is saved to your profile. Speech language and speech rate are saved locally on this device.'))return;
    var p=CHL.profile||{};
    var card=el('div',{class:'card form-stack',style:'max-width:650px'});
    var country=el('input',{class:'input',name:'country',maxlength:'80',placeholder:'Country / region',value:p.country||''});
    var profileLang=el('select',{class:'input',name:'profileLanguage'},[['en','English'],['en-JM','English (Jamaica)'],['en-US','English (United States)'],['es','Spanish'],['fr','French'],['ht','Haitian Creole'],['pt','Portuguese']].map(function(x){return el('option',{value:x[0]},x[1]);}));profileLang.value=p.language||'en';
    var speechLang=el('select',{class:'input',name:'speechLanguage'},[['en-JM','English (Jamaica)'],['en-US','English (United States)'],['es','Spanish'],['fr','French'],['ht','Haitian Creole'],['pt','Portuguese']].map(function(x){return el('option',{value:x[0]},x[1]);}));
    var rate=el('input',{class:'input',type:'range',min:'0.6',max:'1.4',step:'0.1',value:'1'});
    var accountForm=el('form',{class:'form-stack',onsubmit:async function(e){e.preventDefault();if(!CHL.user){CHL.navigate('#/login');return;}var b=accountForm.querySelector('button[type=submit]');b.disabled=true;try{var result=await sb.from('profiles').update({country:country.value.trim()||null,language:profileLang.value,updated_at:new Date().toISOString()}).eq('id',CHL.user.id);if(result.error)throw result.error;await CHL.refreshAuth();CHL.toast('Account language and region saved.');}catch(err){CHL.toast(err.message||'Could not save account locale.');}finally{b.disabled=false;}}});
    accountForm.appendChild(el('label',{class:'field'},[el('span',{class:'field-label',text:'Country / region'}),country]));
    accountForm.appendChild(el('label',{class:'field'},[el('span',{class:'field-label',text:'Profile language'}),profileLang]));
    accountForm.appendChild(el('button',{class:'btn primary',type:'submit'},'Save account locale'));
    var speechCard=el('div',{class:'form-stack'});
    speechCard.appendChild(el('label',{class:'field'},[el('span',{class:'field-label',text:'Preferred speech language'}),speechLang]));
    speechCard.appendChild(el('label',{class:'field'},[el('span',{class:'field-label',text:'Speech rate'}),rate]));
    speechCard.appendChild(el('div',{class:'row wrap',style:'gap:8px'},[
      el('button',{
        class:'btn',
        type:'button',
        text:'Test voice',
        onclick:function(){
          if(!window.speechSynthesis||!window.SpeechSynthesisUtterance){CHL.toast('Speech synthesis is not available in this browser.');return;}
          var utterance=new SpeechSynthesisUtterance('Welcome to Creator Hub Creator Network.');
          utterance.lang=speechLang.value;
          utterance.rate=Number(rate.value);
          window.speechSynthesis.cancel();
          window.speechSynthesis.speak(utterance);
        }
      }),
      el('button',{
        class:'btn primary',
        type:'button',
        text:'Save speech preferences',
        onclick:function(){
          try {
            localStorage.setItem('chcn_language',JSON.stringify({language:speechLang.value,rate:Number(rate.value)}));
            CHL.toast('Speech preferences saved on this device.');
          } catch (_) {
            CHL.toast('Could not save speech preferences.');
          }
        }
      })
    ]));
    speechCard.appendChild(el('div',{class:'note',text:'Speech voices are supplied by the device/browser. This does not install or download extra language packs.'}));
    card.appendChild(el('h3',{class:'section-title',text:'Account language and region'}));card.appendChild(accountForm);
    card.appendChild(el('hr',{}));card.appendChild(el('h3',{class:'section-title',text:'Speech preferences'}));card.appendChild(speechCard);o.appendChild(card);
    try{var v=JSON.parse(localStorage.getItem('chcn_language')||'{}');speechLang.value=v.language||'en-JM';rate.value=String(v.rate||1);}catch(_){}
  });

  function selectField(label,name,values,current){var w=el('label',{class:'field'},[el('span',{text:label})]);var s=el('select',{class:'input',name:name});values.forEach(function(v){s.appendChild(el('option',{value:v,selected:v===current},v));});w.appendChild(s);return w;}
})();
