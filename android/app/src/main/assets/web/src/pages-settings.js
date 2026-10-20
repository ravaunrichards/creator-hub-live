/* Creator Hub Live — persistent account settings. */
(function(){
  'use strict';
  var CHL = window.CHL; var el = CHL.el, ui = CHL.ui, sb = CHL.sb;
  var lastLoadedSettings = null;
  var SETTING_DEFAULTS = { privacy:{account:'public',messages:'everyone',comments:'everyone'}, notifications:{follows:true,gifts:true,live:true,mentions:true,messages:true,likes:true,comments:true}, live:{audience:'public',guest_permissions:'allowed',max_guests:8}, appearance:{mode:'individual',theme:'night',typography:'system',surfaces:'standard',density:'comfortable',motion:'standard',contrast:'standard'} };
  var SNAV=[
    {h:'#/settings/profile',label:'Profile'},{h:'#/settings/appearance',label:'Appearance'},{h:'#/settings/security',label:'Security'},
    {h:'#/settings/privacy',label:'Privacy'},{h:'#/settings/blocked',label:'Blocked accounts'},{h:'#/settings/notifications',label:'Notifications'},
    {h:'#/settings/payments',label:'Payments'},{h:'#/settings/live',label:'LIVE'}
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
    var currentAppearance = CHL.StyleSwitcher && typeof CHL.StyleSwitcher.getPreference === 'function'
      ? CHL.StyleSwitcher.getPreference()
      : base.appearance;
    var payload = {user_id:CHL.user.id,privacy:value.privacy||base.privacy,notifications:value.notifications||base.notifications,live:value.live||base.live,appearance:value.appearance||currentAppearance||base.appearance,updated_at:new Date().toISOString()};
    var r=await sb.from('user_settings').upsert(payload,{onConflict:'user_id'});
    if(r.error) throw r.error;
    if(value.privacy){var profilePrivacy=await sb.from('profiles').update({privacy:payload.privacy}).eq('id',CHL.user.id);if(profilePrivacy.error)throw profilePrivacy.error;}
    lastLoadedSettings = {privacy:payload.privacy,notifications:payload.notifications,live:payload.live,appearance:payload.appearance};
    CHL.toast('Settings saved');
  }
  function check(name,label,checked){ return el('label',{class:'row',style:'gap:8px;margin:10px 0'},[el('input',{type:'checkbox',name:name,checked:!!checked}),el('span',{text:label})]); }

  CHL.route('/settings/appearance', function(o){
    o.appendChild(ui.pageHead('Appearance','Choose an individual style or build and test a compatible style-family combination.'));
    o.appendChild(snav());
    var mount=el('div',{class:'chl-style-switcher-mount'});
    o.appendChild(mount);
    if(CHL.StyleSwitcher) CHL.StyleSwitcher.render(mount);
    else mount.appendChild(el('div',{class:'note',text:'The Style Switcher did not load. Reload the app and check the browser console.'}));
  });

  CHL.route('/settings', function(o){ if(head(o,'Settings','Manage your account.')) return; o.appendChild(el('div',{class:'card',text:'Choose a settings category above. Account settings are stored with your profile and restored after reopening.'})); });

  CHL.route('/settings/profile', function(o){ if(head(o,'Profile settings','Customize the public identity people see when they visit your account.')) return; var p=CHL.profile||{}; var f=el('form',{style:'max-width:620px',onsubmit:function(e){e.preventDefault();saveProfile(f);}}); f.appendChild(CHL._field('Display name','display_name','Your public display name')); f.appendChild(CHL._field('Username','username','unique_username')); f.appendChild(labelArea('Bio','bio')); var avatarField=CHL._field('Profile photo HTTPS URL','avatar_url','https://…');var coverField=CHL._field('Profile cover HTTPS URL','cover_url','https://…');f.appendChild(avatarField);f.appendChild(makeCropEditor('profile photo','avatar_url',600,600));f.appendChild(coverField);f.appendChild(makeCropEditor('profile cover','cover_url',1600,500)); f.appendChild(el('p',{class:'sub',text:'Choose a photo, zoom and reposition it, then upload the cropped result. Cropped images are stored in your Creator Hub Live media bucket. You can also keep using direct HTTPS image URLs.'})); f.appendChild(el('button',{class:'btn primary',type:'submit'},'Save profile')); f.display_name.value=p.display_name||''; f.username.value=p.username||''; if(f.bio) f.bio.value=p.bio||''; f.avatar_url.value=p.avatar_url||''; f.cover_url.value=p.cover_url||''; o.appendChild(f); });
  function makeCropEditor(label,fieldName,outWidth,outHeight){var panel=el('section',{class:'chl-photo-crop-editor card',style:'margin:10px 0;padding:12px'});panel.appendChild(el('strong',{text:'Crop and zoom '+label}));var pick=el('input',{type:'file',accept:'image/jpeg,image/png,image/webp',class:'input','aria-label':'Choose '+label+' image',style:'margin-top:8px'});panel.appendChild(pick);var canvas=el('canvas',{width:String(outWidth),height:String(outHeight),class:'chl-photo-crop-canvas',style:'display:block;width:100%;max-width:520px;max-height:300px;object-fit:contain;background:#10131b;border-radius:10px;margin:10px 0'});panel.appendChild(canvas);var ctx=canvas.getContext('2d');var image=null;var zoom=el('input',{type:'range',min:'1',max:'3',step:'0.05',value:'1',class:'input','aria-label':'Photo zoom'});var x=el('input',{type:'range',min:'-100',max:'100',step:'1',value:'0',class:'input','aria-label':'Move photo left or right'});var y=el('input',{type:'range',min:'-100',max:'100',step:'1',value:'0',class:'input','aria-label':'Move photo up or down'});function slider(labelText,input){panel.appendChild(el('label',{class:'field'},[el('span',{text:labelText}),input]));}slider('Zoom in / out',zoom);slider('Move left / right',x);slider('Move up / down',y);var upload=el('button',{class:'btn',type:'button',text:'Upload cropped image'});var status=el('p',{class:'sub','aria-live':'polite',text:'Select an image to preview the crop.'});panel.appendChild(upload);panel.appendChild(status);function draw(){if(!image)return;ctx.clearRect(0,0,outWidth,outHeight);var scale=Math.max(outWidth/image.naturalWidth,outHeight/image.naturalHeight)*Number(zoom.value||1);var w=image.naturalWidth*scale,h=image.naturalHeight*scale;var maxX=Math.max(0,(w-outWidth)/2),maxY=Math.max(0,(h-outHeight)/2);var dx=(outWidth-w)/2+(Number(x.value)/100)*maxX;var dy=(outHeight-h)/2+(Number(y.value)/100)*maxY;ctx.drawImage(image,dx,dy,w,h);}pick.addEventListener('change',function(){var file=pick.files&&pick.files[0];if(!file)return;if(!/^image\/(jpeg|png|webp)$/.test(file.type)||file.size>12*1024*1024){status.textContent='Choose a JPG, PNG or WebP image under 12 MB.';pick.value='';return;}var local=URL.createObjectURL(file);var img=new Image();img.onload=function(){if(image&&image.src&&image.src.indexOf('blob:')===0)URL.revokeObjectURL(image.src);image=img;zoom.value='1';x.value='0';y.value='0';draw();status.textContent='Preview ready. Adjust zoom and position, then upload.';};img.onerror=function(){status.textContent='This image could not be opened.';URL.revokeObjectURL(local);};img.src=local;});[zoom,x,y].forEach(function(input){input.addEventListener('input',draw);});upload.addEventListener('click',async function(){if(!image){status.textContent='Choose a photo first.';return;}if(!sb||!sb.storage){status.textContent='Image storage is not configured. Use the HTTPS URL field instead.';return;}upload.disabled=true;status.textContent='Uploading cropped image…';try{var blob=await new Promise(function(resolve,reject){canvas.toBlob(function(b){if(b)resolve(b);else reject(new Error('Could not prepare the cropped image.'));},'image/jpeg',0.9);});var path=CHL.user.id+'/profile-'+fieldName+'-'+Date.now()+'.jpg';var result=await sb.storage.from('creator-media').upload(path,blob,{contentType:'image/jpeg',upsert:false});if(result.error)throw result.error;var urlResult=sb.storage.from('creator-media').getPublicUrl(path);var url=urlResult&&urlResult.data&&urlResult.data.publicUrl;if(!url)throw new Error('Upload completed but no public media URL was returned.');f[fieldName].value=url;status.textContent='Cropped image uploaded. Press Save profile to apply it.';CHL.toast('Cropped image uploaded. Save your profile to apply it.');}catch(error){status.textContent=error.message||'Could not upload the cropped image.';}finally{upload.disabled=false;}});return panel;}
  function labelArea(label,name){ var w=el('label',{class:'field'},[el('span',{text:label})]); w.appendChild(el('textarea',{class:'input',name:name,rows:'3'})); return w; }
  function saveProfile(f){ var u=CHL.user; if(!u) return; var patch={display_name:f.display_name.value.trim(),username:f.username.value.trim(),bio:f.bio?f.bio.value.trim():'',avatar_url:String(f.avatar_url.value||'').trim()||null,cover_url:String(f.cover_url.value||'').trim()||null}; if(!/^[a-z0-9_.]{3,30}$/i.test(patch.username)){CHL.toast('Username: 3-30 letters, numbers, underscores or periods.');return;} for(var key of ['avatar_url','cover_url']){if(patch[key]){try{var parsed=new URL(patch[key]);if(parsed.protocol!=='https:')throw new Error();}catch(_){CHL.toast('Profile photo and cover URLs must be valid HTTPS URLs.');return;}}} sb.from('profiles').update(patch).eq('id',u.id).then(function(r){if(r&&r.error){CHL.toast(r.error.code==='23505'?'That username is already taken. Choose another one.':r.error.message);return;} CHL.refreshAuth().then(function(){CHL.toast('Profile saved');CHL.navigate('#/profile');});}); }

  CHL.route('/settings/security', function(o){ if(head(o,'Security','Password, sessions and 2FA.')) return; o.appendChild(el('div',{class:'card'},[el('div',{style:'font-weight:700;margin-bottom:8px',text:'Password'}),el('button',{class:'btn',onclick:function(){if(CHL.user&&CHL.user.email){sb.auth.resetPasswordForEmail(CHL.user.email).then(function(r){CHL.toast(r.error?r.error.message:'Reset email sent');});}}},'Send password reset email'),el('div',{style:'font-weight:700;margin:16px 0 8px',text:'Sessions'}),el('button',{class:'btn',onclick:function(){sb.auth.signOut().then(function(){CHL.navigate('#/login');});}},'Log out') ])); });

  CHL.route('/settings/privacy', async function(o){ if(head(o,'Privacy','Who can see and contact you.')) return; var card=el('div',{class:'card'},[ui.spinner()]); o.appendChild(card); try{var s=await loadSettings(); card.innerHTML=''; var f=el('form',{onsubmit:async function(e){e.preventDefault();var v={privacy:{account:f.account.value,messages:f.messages.value,comments:f.comments.value},notifications:s.notifications,live:s.live};try{await saveSettings(v);}catch(err){CHL.toast(err.message||'Could not save settings.');}}}); f.appendChild(selectField('Account visibility','account',['public','followers','private'],s.privacy.account)); f.appendChild(selectField('Who can message you','messages',['everyone','followers','nobody'],s.privacy.messages)); f.appendChild(selectField('Who can comment','comments',['everyone','followers','nobody'],s.privacy.comments)); f.appendChild(el('button',{class:'btn primary',type:'submit'},'Save privacy settings')); card.appendChild(f);}catch(e){card.innerHTML='';card.appendChild(el('div',{class:'note',text:e.message||'Could not load settings.'}));}});

  CHL.route('/settings/blocked', async function(o){
    if(head(o,'Blocked accounts','Review accounts you have blocked and unblock them when you choose.'))return;
    if(!CHL.user){CHL.navigate('#/login');return;}var panel=el('section',{class:'card'});panel.appendChild(ui.spinner());o.appendChild(panel);
    try{var result=await sb.from('blocks').select('blocked_id,created_at').eq('blocker_id',CHL.user.id).order('created_at',{ascending:false}).range(0,199);if(result.error)throw result.error;var edges=result.data||[];panel.innerHTML='';if(!edges.length){panel.appendChild(ui.empty('🛡️','No blocked accounts','Accounts you block will appear here.'));return;}var ids=edges.map(function(x){return x.blocked_id;});var profiles=await sb.from('profiles').select('id,username,display_name,avatar_url').in('id',ids);if(profiles.error)throw profiles.error;var map={};(profiles.data||[]).forEach(function(p){map[String(p.id)]=p;});edges.forEach(function(edge){var p=map[String(edge.blocked_id)]||{};var name=p.display_name||p.username||'Creator';var row=el('div',{class:'chl-profile-person'});row.appendChild(p.avatar_url?el('img',{src:p.avatar_url,alt:'',class:'chl-profile-person-avatar'}):el('div',{class:'ava chl-profile-person-avatar',text:CHL.initials(name).toUpperCase()}));row.appendChild(el('div',{style:'flex:1;min-width:0'},[el('strong',{text:name}),el('div',{class:'sub',text:p.username?'@'+p.username:'Account'} )]));if(p.username)row.appendChild(el('a',{class:'btn',href:'#/profile/'+encodeURIComponent(p.username),text:'View'}));var unblock=el('button',{class:'btn primary',type:'button',text:'Unblock'});unblock.addEventListener('click',async function(){unblock.disabled=true;try{await CHL.authenticatedApiRequest('/api/social/blocks',{method:'DELETE',body:{userId:edge.blocked_id}});row.remove();CHL.toast('Account unblocked.');if(!panel.querySelector('.chl-profile-person')){panel.innerHTML='';panel.appendChild(ui.empty('🛡️','No blocked accounts','Accounts you block will appear here.'));}}catch(error){CHL.toast(error.message||'Could not unblock account.');unblock.disabled=false;}});row.appendChild(unblock);panel.appendChild(row);});}catch(error){panel.innerHTML='';panel.appendChild(el('div',{class:'note',text:error.message||'Blocked accounts could not be loaded.'}));}
  });

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
      f.appendChild(selectField('Maximum accepted guests','max_guests',[0,1,2,3,4,5,6,7,8].map(function(n){return {value:String(n),label:n===0?'0 guests — host only':String(n)+' guest'+(n===1?'':'s')};}),String(Number.isInteger(Number(s.live.max_guests))?Number(s.live.max_guests):8)));
      f.appendChild(el('p',{class:'sub',text:'The host can review requests, accept or reject viewers, invite a creator by username, mute their published audio, stop video, and remove a guest. The host remains on stage separately from the guest limit.'}));
      f.appendChild(el('button',{class:'btn primary',type:'submit'},'Save LIVE settings')); card.appendChild(f);
    }catch(e){card.innerHTML='';card.appendChild(el('div',{class:'note',text:e.message||'Could not load settings.'}));}
  });

  function selectField(label,name,values,current){
    var w=el('label',{class:'field'},[el('span',{text:label})]);var s=el('select',{class:'input',name:name});
    values.forEach(function(v){var value=(v&&typeof v==='object')?v.value:String(v);var text=(v&&typeof v==='object')?v.label:String(v);s.appendChild(el('option',{value:value,selected:value===String(current)},text));});
    s.value=String(current);w.appendChild(s);return w;
  }
})();
