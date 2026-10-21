/* Creator Hub Live — persistent account settings. */
(function(){
  'use strict';
  var CHL = window.CHL; var el = CHL.el, ui = CHL.ui, sb = CHL.sb;
  var lastLoadedSettings = null;
  var SETTING_DEFAULTS = { privacy:{account:'public',messages:'everyone',comments:'everyone'}, notifications:{follows:true,gifts:true,live:true,mentions:true,messages:true,likes:true,comments:true}, live:{audience:'public',guest_permissions:'allowed',max_guests:8}, appearance:{theme:'dark',layout:'classic',font:'system',scale:'1',accent:'violet'} };
  var SNAV=[
    {h:'#/settings/profile',label:'Profile'},{h:'#/settings/security',label:'Security'},
    {h:'#/settings/privacy',label:'Privacy'},{h:'#/settings/blocked',label:'Blocked accounts'},{h:'#/settings/notifications',label:'Notifications'},
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
    var currentAppearance = (CHL.StyleSwitcher && typeof CHL.StyleSwitcher.getPreference === 'function')
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

  CHL.route('/settings', function(o){ if(head(o,'Settings','Manage your account.')) return; o.appendChild(el('div',{class:'card',text:'Choose a settings category above. Account settings are stored with your profile and restored after reopening.'})); });

  CHL.route('/settings/profile', function(o){ if(head(o,'Profile settings','Customize the public identity people see when they visit your account.')) return; var p=CHL.profile||{}; var f=el('form',{style:'max-width:620px',onsubmit:function(e){e.preventDefault();saveProfile(f);}}); f.appendChild(CHL._field('Display name','display_name','Your public display name')); f.appendChild(CHL._field('Username','username','unique_username')); f.appendChild(labelArea('Bio','bio')); f.appendChild(CHL._field('Profile photo HTTPS URL','avatar_url','https://…')); f.appendChild(CHL._field('Profile cover HTTPS URL','cover_url','https://…')); f.appendChild(el('div',{class:'row wrap',style:'gap:8px;margin:4px 0 2px'},[el('button',{class:'btn',type:'button',onclick:function(){openCropUpload('avatar');}},'Crop & upload photo'),el('button',{class:'btn',type:'button',onclick:function(){openCropUpload('cover');}},'Crop & upload cover')])); f.appendChild(el('p',{class:'sub',text:'Use direct HTTPS image URLs you own or are authorized to use, or crop and upload an image — the framed result is stored in your creator media and linked automatically. Your username is unique and case-insensitive; unavailable names are rejected by the database.'})); f.appendChild(el('button',{class:'btn primary',type:'submit'},'Save profile')); f.display_name.value=p.display_name||''; f.username.value=p.username||''; if(f.bio) f.bio.value=p.bio||''; f.avatar_url.value=p.avatar_url||''; f.cover_url.value=p.cover_url||''; o.appendChild(f); });
  function labelArea(label,name){ var w=el('label',{class:'field'},[el('span',{text:label})]); w.appendChild(el('textarea',{class:'input',name:name,rows:'3'})); return w; }

  /*
   * Real client-side crop/zoom editor. The creator picks an image, frames it
   * with pan + zoom over a fixed-aspect viewport, and we rasterize exactly the
   * framed region to an output canvas. getBlob() returns the cropped JPEG so
   * the caller can upload the framed result (not the raw file) to storage.
   * No server-side image processing and no fake preview — what is framed is
   * what is exported and uploaded.
   */
  function makeCropEditor(opts){
    opts = opts || {};
    var aspect = opts.aspect || 1;              // width / height of the crop
    var outW = opts.outWidth || 512;
    var outH = opts.outHeight || Math.round(outW / aspect);
    var viewW = 320, viewH = Math.round(viewW / aspect);
    var wrap = el('div',{style:'display:grid;gap:10px'});
    var fileInput = el('input',{type:'file',accept:'image/jpeg,image/png,image/webp',style:'font-size:13px'});
    var stage = el('div',{style:'position:relative;width:'+viewW+'px;max-width:100%;height:'+viewH+'px;margin:0 auto;border-radius:12px;overflow:hidden;background:#0b0b12;touch-action:none;cursor:grab'});
    var canvas = el('canvas',{width:String(viewW),height:String(viewH),style:'display:block;width:100%;height:100%'});
    stage.appendChild(canvas);
    var zoom = el('input',{type:'range',min:'1',max:'4',step:'0.01',value:'1',style:'width:100%'});
    var zoomRow = el('label',{class:'field'},[el('span',{text:'Zoom'}),zoom]);
    var hint = el('p',{class:'sub',text:'Choose an image, then drag to reposition and use the slider to zoom. The framed area is exactly what gets uploaded.'});
    wrap.appendChild(fileInput); wrap.appendChild(stage); wrap.appendChild(zoomRow); wrap.appendChild(hint);
    var ctx = canvas.getContext('2d');
    var img = null, scale = 1, minScale = 1, offX = 0, offY = 0, dragging = false, lastX = 0, lastY = 0;
    function clamp(){
      var dw = img.width * scale, dh = img.height * scale;
      var minX = viewW - dw, minY = viewH - dh;
      if (dw <= viewW) offX = (viewW - dw) / 2; else offX = Math.min(0, Math.max(minX, offX));
      if (dh <= viewH) offY = (viewH - dh) / 2; else offY = Math.min(0, Math.max(minY, offY));
    }
    function draw(){
      ctx.clearRect(0,0,viewW,viewH);
      if(!img){ ctx.fillStyle='#14141f'; ctx.fillRect(0,0,viewW,viewH); return; }
      clamp();
      ctx.fillStyle='#000'; ctx.fillRect(0,0,viewW,viewH);
      ctx.drawImage(img, offX, offY, img.width*scale, img.height*scale);
    }
    function reset(){
      minScale = Math.max(viewW / img.width, viewH / img.height);
      scale = minScale; zoom.min = String(minScale); zoom.max = String(minScale*4); zoom.step = String(minScale/100); zoom.value = String(minScale);
      offX = (viewW - img.width*scale)/2; offY = (viewH - img.height*scale)/2; draw();
    }
    fileInput.addEventListener('change', function(){
      var file = fileInput.files && fileInput.files[0];
      if(!file) return;
      if(!/^image\/(jpeg|png|webp)$/.test(file.type)){ CHL.toast('Choose a JPG, PNG or WEBP image.'); fileInput.value=''; return; }
      if(file.size > 12*1024*1024){ CHL.toast('Image must be 12 MB or smaller.'); fileInput.value=''; return; }
      var url = URL.createObjectURL(file);
      var next = new Image();
      next.onload = function(){ img = next; reset(); URL.revokeObjectURL(url); };
      next.onerror = function(){ URL.revokeObjectURL(url); CHL.toast('That image could not be read.'); };
      next.src = url;
    });
    zoom.addEventListener('input', function(){ if(!img) return; var cx=viewW/2, cy=viewH/2; var ns=Number(zoom.value)||minScale; var k=ns/scale; offX = cx - (cx-offX)*k; offY = cy - (cy-offY)*k; scale = ns; draw(); });
    function down(e){ if(!img) return; dragging=true; stage.style.cursor='grabbing'; var pt=point(e); lastX=pt.x; lastY=pt.y; }
    function move(e){ if(!dragging||!img) return; var pt=point(e); offX += pt.x-lastX; offY += pt.y-lastY; lastX=pt.x; lastY=pt.y; draw(); e.preventDefault(); }
    function up(){ dragging=false; stage.style.cursor='grab'; }
    function point(e){ var r=stage.getBoundingClientRect(); var t=(e.touches&&e.touches[0])||e; return { x:(t.clientX-r.left)*(viewW/r.width), y:(t.clientY-r.top)*(viewH/r.height) }; }
    stage.addEventListener('mousedown',down); window.addEventListener('mousemove',move); window.addEventListener('mouseup',up);
    stage.addEventListener('touchstart',down,{passive:false}); stage.addEventListener('touchmove',move,{passive:false}); stage.addEventListener('touchend',up);
    draw();
    return {
      node: wrap,
      hasImage: function(){ return !!img; },
      getBlob: function(){
        return new Promise(function(resolve,reject){
          if(!img){ reject(new Error('Choose an image to crop first.')); return; }
          var out = document.createElement('canvas'); out.width = outW; out.height = outH;
          var octx = out.getContext('2d');
          var ratio = outW / viewW;
          octx.fillStyle = '#000'; octx.fillRect(0,0,outW,outH);
          octx.drawImage(img, offX*ratio, offY*ratio, img.width*scale*ratio, img.height*scale*ratio);
          out.toBlob(function(blob){ if(blob) resolve(blob); else reject(new Error('The cropped image could not be generated.')); }, 'image/jpeg', 0.9);
        });
      }
    };
  }

  // Open the crop editor in a modal and upload the framed result to the
  // owner-scoped creator-media bucket, then persist the public URL.
  function openCropUpload(kind){
    var u = CHL.user; if(!u){ CHL.navigate('#/login'); return; }
    var isAvatar = kind === 'avatar';
    var editor = makeCropEditor(isAvatar ? { aspect:1, outWidth:512, outHeight:512 } : { aspect:16/9, outWidth:1280, outHeight:720 });
    var overlay = el('div',{role:'dialog','aria-modal':'true',style:'position:fixed;inset:0;z-index:10000;background:#000b;display:flex;align-items:center;justify-content:center;padding:12px'});
    var panel = el('div',{style:'width:min(460px,100%);max-height:92vh;overflow:auto;background:var(--card,#191926);border:1px solid var(--line,#262636);border-radius:16px;padding:16px;color:var(--txt,#f4f4f8)'});
    panel.appendChild(el('h2',{style:'margin:0 0 12px;font-size:19px',text:isAvatar?'Crop profile photo':'Crop cover photo'}));
    panel.appendChild(editor.node);
    var save = el('button',{class:'btn primary',type:'button'},'Upload cropped image');
    var cancel = el('button',{class:'btn',type:'button'},'Cancel');
    function close(){ overlay.remove(); }
    cancel.addEventListener('click', close);
    overlay.addEventListener('click', function(e){ if(e.target===overlay) close(); });
    save.addEventListener('click', async function(){
      save.disabled = true; save.textContent = 'Uploading…';
      try{
        if(!sb.storage) throw new Error('Media storage is not available in this app configuration.');
        var blob = await editor.getBlob();
        var path = u.id + '/' + kind + '-' + Date.now() + '.jpg';
        var uploaded = await sb.storage.from('creator-media').upload(path, blob, { cacheControl:'3600', upsert:false, contentType:'image/jpeg' });
        if(uploaded.error) throw uploaded.error;
        var pub = sb.storage.from('creator-media').getPublicUrl(path);
        var publicUrl = pub && pub.data && pub.data.publicUrl;
        if(!publicUrl) throw new Error('Storage uploaded the image but did not return a public URL.');
        var patch = {}; patch[isAvatar?'avatar_url':'cover_url'] = publicUrl; patch.updated_at = new Date().toISOString();
        var savedRow = await sb.from('profiles').update(patch).eq('id', u.id).select('id').maybeSingle();
        if(savedRow.error) throw savedRow.error;
        if(!savedRow.data) throw new Error('The profile image was uploaded but the profile could not be updated.');
        close();
        CHL.refreshAuth().then(function(){ CHL.toast((isAvatar?'Profile photo':'Cover photo')+' updated.'); });
      }catch(err){
        save.disabled = false; save.textContent = 'Upload cropped image';
        CHL.toast('Upload failed: ' + ((err && err.message) || 'Apply the creator-media storage migration (0039) first.'));
      }
    });
    panel.appendChild(el('div',{class:'row wrap',style:'gap:8px;margin-top:14px'},[save,cancel]));
    overlay.appendChild(panel); document.body.appendChild(overlay);
  }
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

  CHL.route('/settings/appearance', function(o){
    if(head(o,'Appearance','Choose an individual style or combine compatible style families. Preview and run the style relay before saving.')) return;
    if(!CHL.StyleSwitcher || typeof CHL.StyleSwitcher.render!=='function'){
      o.appendChild(el('div',{class:'note',text:'Appearance controls are unavailable. Reload Creator Hub Live and try again.'}));
      return;
    }
    var mount=el('div',{class:'chl-style-switcher-mount'});
    o.appendChild(mount);
    CHL.StyleSwitcher.render(mount);
  });

  function selectField(label,name,values,current){
    var w=el('label',{class:'field'},[el('span',{text:label})]);var s=el('select',{class:'input',name:name});
    values.forEach(function(v){var value=(v&&typeof v==='object')?v.value:String(v);var text=(v&&typeof v==='object')?v.label:String(v);s.appendChild(el('option',{value:value,selected:value===String(current)},text));});
    s.value=String(current);w.appendChild(s);return w;
  }
})();
