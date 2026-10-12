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
      notifications:Object.assign({follows:true,gifts:true,live:true,mentions:true,messages:true,likes:true,comments:true},stored.notifications||{}),
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
      ['Account & security',[['Profile','Edit your display name, username, bio and profile details.','#/settings/profile'],['Security','Password reset and sign-out controls.','#/settings/security'],['Privacy','Account visibility, who can message you and comments.','#/settings/privacy']]],
      ['Notifications & LIVE',[['Notifications','Choose which activity categories you want to receive.','#/settings/notifications'],['LIVE defaults','Set audience and guest permissions defaults.','#/settings/live']]],
      ['Payments & earnings',[['Payments','Save the PayPal destination for creator payout requests. Never enter API secrets here.','#/settings/payments'],['Wallet','Coin balance, payment methods and transaction history.','#/wallet'],['Creator earnings','View actual payout requests and earnings records.','#/creator/earnings']]],
      ['Experience & accessibility',[['Appearance','Compact or comfortable spacing, theme and interface preferences.','#/settings/appearance'],['Accessibility','Text scale, reduced motion and contrast preferences.','#/settings/accessibility'],['Language & voice','Choose display, speech and preferred language locally.','#/settings/language'],['Maps & location','Open navigation tools and request location only when needed.','#/maps'],['Offline content','Review which bundled tools work without internet.','#/settings/offline']]],
      ['Creator tools & support',[['Creator Academy','Lessons, quiz scores, bookmarks and learning notes.','#/academy'],['Games & utilities','Offline games, dictionary, phrasebook and currency tools.','#/tools'],['Help & safety','Help topics, community rules and moderation reporting.','#/help']]]
    ];
    groups.forEach(function(g){var section=el('section',{class:'settings-group'});section.appendChild(el('h2',{class:'section-title',text:g[0]}));var grid=el('div',{class:'grid settings-grid'});g[1].forEach(function(x){grid.appendChild(el('a',{class:'card settings-card',href:x[2]},[el('div',{style:'font-weight:750',text:x[0]}),el('div',{class:'u',text:x[1]}),el('span',{class:'u',text:'Open settings →',style:'margin-top:7px'} )]));});section.appendChild(grid);o.appendChild(section);});
  });

  CHL.route('/settings/profile', function(o){ if(head(o,'Profile settings','Edit your public profile.')) return; var p=CHL.profile||{}; var f=el('form',{style:'max-width:520px',onsubmit:function(e){e.preventDefault();saveProfile(f);}}); f.appendChild(CHL._field('Display name','display_name','')); f.appendChild(CHL._field('Username','username','')); f.appendChild(labelArea('Bio','bio')); f.appendChild(el('button',{class:'btn primary',type:'submit'},'Save changes')); f.display_name.value=p.display_name||''; f.username.value=p.username||''; if(f.bio) f.bio.value=p.bio||''; o.appendChild(f); });
  function labelArea(label,name){ var w=el('label',{class:'field'},[el('span',{text:label})]); w.appendChild(el('textarea',{class:'input',name:name,rows:'3'})); return w; }
  function saveProfile(f){ var u=CHL.user; if(!u) return; var patch={display_name:f.display_name.value.trim(),username:f.username.value.trim(),bio:f.bio?f.bio.value.trim():''}; if(!/^[a-z0-9_]{3,20}$/i.test(patch.username)){CHL.toast('Username: 3-20 letters/numbers/_');return;} sb.from('profiles').update(patch).eq('id',u.id).then(function(r){if(r&&r.error){CHL.toast(r.error.message);return;} CHL.refreshAuth().then(function(){CHL.toast('Profile saved');});}); }

  CHL.route('/settings/security', function(o){ if(head(o,'Security','Password, sessions and 2FA.')) return; o.appendChild(el('div',{class:'card'},[el('div',{style:'font-weight:700;margin-bottom:8px',text:'Password'}),el('button',{class:'btn',onclick:function(){if(CHL.user&&CHL.user.email){sb.auth.resetPasswordForEmail(CHL.user.email).then(function(r){CHL.toast(r.error?r.error.message:'Reset email sent');});}}},'Send password reset email'),el('div',{style:'font-weight:700;margin:16px 0 8px',text:'Sessions'}),el('button',{class:'btn',onclick:function(){sb.auth.signOut().then(function(){CHL.navigate('#/login');});}},'Log out') ])); });

  CHL.route('/settings/privacy', async function(o){ if(head(o,'Privacy','Who can see and contact you.')) return; var card=el('div',{class:'card'},[ui.spinner()]); o.appendChild(card); try{var s=await loadSettings(); card.innerHTML=''; var f=el('form',{onsubmit:async function(e){e.preventDefault();var v={privacy:{account:f.account.value,messages:f.messages.value,comments:f.comments.value},notifications:s.notifications,live:s.live};try{await saveSettings(v);}catch(err){CHL.toast(err.message||'Could not save settings.');}}}); f.appendChild(selectField('Account visibility','account',['public','followers','private'],s.privacy.account)); f.appendChild(selectField('Who can message you','messages',['everyone','followers','nobody'],s.privacy.messages)); f.appendChild(selectField('Who can comment','comments',['everyone','followers','nobody'],s.privacy.comments)); f.appendChild(el('button',{class:'btn primary',type:'submit'},'Save privacy settings')); card.appendChild(f);}catch(e){card.innerHTML='';card.appendChild(el('div',{class:'note',text:e.message||'Could not load settings.'}));}});

  CHL.route('/settings/notifications', async function(o){ if(head(o,'Notification settings','Choose what you get notified about.')) return; var card=el('div',{class:'card'},[ui.spinner()]); o.appendChild(card); try{var s=await loadSettings(); card.innerHTML=''; var f=el('form',{onsubmit:async function(e){e.preventDefault();var n={follows:f.follows.checked,gifts:f.gifts.checked,live:f.live.checked,mentions:f.mentions.checked,messages:f.messages.checked,likes:f.likes.checked,comments:f.comments.checked};try{await saveSettings({privacy:s.privacy,notifications:n,live:s.live});}catch(err){CHL.toast(err.message||'Could not save settings.');}}}); f.appendChild(check('follows','New followers',s.notifications.follows)); f.appendChild(check('gifts','Gifts',s.notifications.gifts)); f.appendChild(check('live','LIVE alerts',s.notifications.live)); f.appendChild(check('mentions','Mentions',s.notifications.mentions)); f.appendChild(check('messages','Messages',s.notifications.messages)); f.appendChild(check('likes','Likes on your posts',s.notifications.likes)); f.appendChild(check('comments','Comments on your posts',s.notifications.comments)); f.appendChild(el('button',{class:'btn primary',type:'submit'},'Save notification settings')); card.appendChild(f);}catch(e){card.innerHTML='';card.appendChild(el('div',{class:'note',text:e.message||'Could not load settings.'}));}});

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

  CHL.route('/settings/appearance',function(o){if(head(o,'Appearance','Compact controls designed to fit phones, tablets and desktop screens.'))return;var card=el('div',{class:'card form-stack',style:'max-width:650px'});var layout=el('select',{class:'input'},[el('option',{value:'compact'},'Compact spacing'),el('option',{value:'comfortable'},'Comfortable spacing')]);var theme=el('select',{class:'input'},[el('option',{value:'system'},'Follow browser/device'),el('option',{value:'dark'},'Dark'),el('option',{value:'light'},'Light')]);var save=el('button',{class:'btn primary',type:'button',text:'Save appearance',onclick:function(){var v={layout:layout.value,theme:theme.value};try{localStorage.setItem('chcn_appearance',JSON.stringify(v));apply(v);CHL.toast('Appearance saved on this device.');}catch(_){CHL.toast('Could not save appearance.');}}});card.appendChild(el('label',{class:'field'},[el('span',{class:'field-label',text:'Density'}),layout]));card.appendChild(el('label',{class:'field'},[el('span',{class:'field-label',text:'Theme'}),theme]));card.appendChild(el('div',{class:'note',text:'The preference is local to this browser and does not alter other users’ settings.'}));card.appendChild(save);o.appendChild(card);function apply(v){document.documentElement.classList.toggle('compact-ui',v.layout==='compact');document.documentElement.dataset.chcnTheme=v.theme;document.documentElement.style.colorScheme=v.theme==='system'?'normal':v.theme;}try{var v=JSON.parse(localStorage.getItem('chcn_appearance')||'{}');layout.value=v.layout||'compact';theme.value=v.theme||'system';apply(v);}catch(_){apply({layout:'compact',theme:'system'});}});
  CHL.route('/settings/language',function(o){if(head(o,'Language & voice','Controls for browser speech and local language preferences.'))return;var card=el('div',{class:'card form-stack',style:'max-width:650px'});var lang=el('select',{class:'input'},[['en-JM','English (Jamaica)'],['en-US','English (United States)'],['es','Spanish'],['fr','French'],['ht','Haitian Creole'],['pt','Portuguese']].map(function(x){return el('option',{value:x[0]},x[1]);}));var rate=el('input',{class:'input',type:'range',min:'0.6',max:'1.4',step:'0.1',value:'1'});var sample=el('button',{class:'btn',type:'button',text:'Test voice',onclick:function(){if(!window.speechSynthesis){CHL.toast('Speech synthesis is not available in this browser.');return;}var u=new SpeechSynthesisUtterance('Welcome to Creator Hub Creator Network.');u.lang=lang.value;u.rate=Number(rate.value);speechSynthesis.cancel();speechSynthesis.speak(u);}});var save=el('button',{class:'btn primary',type:'button',text:'Save language settings',onclick:function(){try{localStorage.setItem('chcn_language',JSON.stringify({language:lang.value,rate:Number(rate.value)}));document.documentElement.lang=lang.value;CHL.toast('Language preference saved on this device.');}catch(_){CHL.toast('Could not save language preference.');}}});card.appendChild(el('label',{class:'field'},[el('span',{class:'field-label',text:'Preferred speech language'}),lang]));card.appendChild(el('label',{class:'field'},[el('span',{class:'field-label',text:'Speech rate'}),rate]));card.appendChild(el('div',{class:'row wrap',style:'gap:8px'},[sample,save]));card.appendChild(el('div',{class:'note',text:'Speech voices are supplied by the device/browser. This choice does not download an offline language pack.'}));o.appendChild(card);try{var v=JSON.parse(localStorage.getItem('chcn_language')||'{}');lang.value=v.language||'en-JM';rate.value=String(v.rate||1);}catch(_){}});
  CHL.route('/settings/offline',function(o){o.appendChild(ui.pageHead('Offline availability','Bundled tools remain usable without a network; services that require fresh or private data show an error rather than fabricating a result.'));var rows=[['Phrasebook','Bundled phrases with browser speech when an installed voice is available.','Available offline'],['Games','Memory Match, Minesweeper, 2048, Klondike Solitaire and Pattern Bakery.','Available offline'],['Creator Academy','Lesson content and device-local progress. Account sync requires the course_progress migration.','Partly available offline'],['Dictionary','Queries the external Dictionary API.','Internet required'],['Translator','Uses an external translation service.','Internet required'],['Currency conversion','Loads current exchange rates from an external rate provider.','Internet required'],['Maps and directions','Geolocation needs device permission; map tiles/routes use external map services.','Internet required for maps'],['Social feed/messages/wallet','Requires connection, authentication, working backend and database policies.','Online required']];var grid=el('div',{class:'grid settings-grid'});rows.forEach(function(x){grid.appendChild(el('div',{class:'card'},[el('div',{style:'font-weight:750',text:x[0]}),el('div',{class:'u',text:x[1]}),el('span',{class:'chip',text:x[2]})]));});o.appendChild(grid);});

  function selectField(label,name,values,current){var w=el('label',{class:'field'},[el('span',{text:label})]);var s=el('select',{class:'input',name:name});values.forEach(function(v){s.appendChild(el('option',{value:v,selected:v===current},v));});w.appendChild(s);return w;}
})();
