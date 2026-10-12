/* Creator Hub Live \u2014 login / register (real Supabase email auth). */
(function(){
  'use strict';
  var CHL = window.CHL; var el = CHL.el, ui = CHL.ui, sb = CHL.sb;

  function authShell(title, sub, formNode, footer){
    return el('div',{class:'auth-wrap'},[ el('div',{class:'auth-box'},[
      el('div',{style:'text-align:center;margin-bottom:22px'},[ el('img',{src:'assets/logo.svg',height:'44',alt:CHL.brand}) ]),
      el('div',{class:'card'},[
        el('div',{class:'h1',style:'font-size:22px',text:title}),
        el('p',{class:'sub',text:sub}),
        formNode
      ]),
      footer
    ]) ]);
  }

  CHL.route('/login', function(outlet){
    if (!CHL.configured){
      outlet.appendChild(authShell('Connect your backend','Supabase is not configured yet.',
        ui.setupNotice(), el('div',{style:'text-align:center;margin-top:14px'},[ el('a',{href:'#/',style:'color:var(--mut)'},'\u2190 Browse anyway') ])));
      return;
    }
    var f = el('form',{onsubmit:function(e){ e.preventDefault(); doLogin(f); }});
    f.appendChild(CHL._field('Email','email','you@example.com','email'));
    f.appendChild(CHL._field('Password','password','\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022','password'));
    f.appendChild(el('button',{class:'btn primary block',type:'submit'},'Log in'));
    outlet.appendChild(authShell('Welcome back','Log in to go live and send gifts.', f,
      el('div',{style:'text-align:center;margin-top:14px;color:var(--mut)'},[ 'New here? ', el('a',{href:'#/register',style:'color:var(--brand2);font-weight:700'},'Create an account') ])));
  });

  function doLogin(f){
    var btn=f.querySelector('button'); btn.disabled=true; btn.textContent='Logging in\u2026';
    sb.auth.signInWithPassword({email:f.email.value.trim(),password:f.password.value}).then(function(r){
      if (r.error){ btn.disabled=false; btn.textContent='Log in'; CHL.toast(r.error.message); return; }
      CHL.refreshAuth().then(function(){ CHL.navigate('#/'); });
    });
  }

  CHL.route('/register', function(outlet){
    if (!CHL.configured){ CHL.navigate('#/login'); return; }
    var f = el('form',{onsubmit:function(e){ e.preventDefault(); doRegister(f); }});
    f.appendChild(CHL._field('Username','username','your_handle'));
    f.appendChild(CHL._field('Email','email','you@example.com','email'));
    f.appendChild(CHL._field('Password','password','At least 6 characters','password'));
    f.appendChild(el('button',{class:'btn primary block',type:'submit'},'Create account'));
    outlet.appendChild(authShell('Join Creator Hub Live','Create. Connect. Go LIVE.', f,
      el('div',{style:'text-align:center;margin-top:14px;color:var(--mut)'},[ 'Already have an account? ', el('a',{href:'#/login',style:'color:var(--brand2);font-weight:700'},'Log in') ])));
  });

  function doRegister(f){
    var username=f.username.value.trim(), email=f.email.value.trim(), pw=f.password.value;
    if (!username || !/^[a-z0-9_]{3,20}$/i.test(username)){ CHL.toast('Username: 3-20 letters/numbers/_'); return; }
    if (pw.length<6){ CHL.toast('Password too short'); return; }
    var btn=f.querySelector('button'); btn.disabled=true; btn.textContent='Creating\u2026';
    sb.auth.signUp({email:email,password:pw,options:{data:{username:username,display_name:username}}}).then(function(r){
      if (r.error){ btn.disabled=false; btn.textContent='Create account'; CHL.toast(r.error.message); return; }
      CHL.toast('Account created! Check email if confirmation is required.');
      CHL.refreshAuth().then(function(){ CHL.navigate('#/'); });
    });
  }

  CHL.route('/404', function(outlet){
    var box = el('div',{style:'text-align:center;max-width:460px;margin:48px auto'},[
      el('img',{src:'assets/logo.svg',height:'46',alt:CHL.brand,style:'margin-bottom:18px'}),
      el('div',{style:'font-size:64px;font-weight:800;line-height:1'},[ el('span',{class:'grad',text:'404'}) ]),
      el('h2',{style:'margin:10px 0 6px',text:"We couldn't find that page."}),
      el('p',{class:'sub',text:'The link may be broken or the page may have moved.'}),
      el('div',{class:'row wrap',style:'gap:10px;justify-content:center;margin-top:8px'},[
        el('a',{href:'#/',class:'btn primary'},'\uD83C\uDFE0 Go Home'),
        el('a',{href:'#/discover',class:'btn'},'\uD83D\uDD0D Discover'),
        el('a',{href:'#/create',class:'btn'},'\u25B6 Go LIVE'),
        el('a',{href:'#/search',class:'btn'},'\uD83D\uDD0E Search'),
        el('a',{href:'#/login',class:'btn ghost'},'Sign In')
      ])
    ]);
    outlet.appendChild(box);
  });

  CHL.route('/admin-denied', function(outlet){
    outlet.appendChild(ui.empty('\uD83D\uDD12','Admin access only','You do not have permission to view the Admin Center.', el('a',{href:'#/',class:'btn',style:'margin-top:8px'},'Go home')));
  });
})();
