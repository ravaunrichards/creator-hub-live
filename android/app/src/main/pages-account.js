/* Creator Hub Creator Network — account controls backed by authenticated records. */
(function () {
  'use strict';
  var CHL = window.CHL, el = CHL.el, ui = CHL.ui, sb = CHL.sb;
  function needUser(outlet, title, sub) {
    outlet.appendChild(ui.pageHead(title, sub || ''));
    if (!CHL.configured) { var n = ui.setupNotice(); if (n) outlet.appendChild(n); return false; }
    if (!CHL.user) { outlet.appendChild(ui.empty('🔐', 'Sign in required', 'Sign in with the account that owns this information.', el('a', { href: '#/login', class: 'btn primary' }, 'Log in'))); return false; }
    return true;
  }
  function showError(parent, error, fallback) { parent.innerHTML = ''; parent.appendChild(el('div', { class: 'note', text: error && error.message || fallback || 'The request failed. Please try again.' })); }
  function safeEmail() { return CHL.user && CHL.user.email || 'Not available'; }
  function settingsLink(href, label) { return el('a', { href: href, class: 'chip' }, label); }

  CHL.route('/settings/account', function (o) {
    if (!needUser(o, 'Account information', 'Review the account identifier and authentication status used by Creator Hub.')) return;
    var p = CHL.profile || {}, identities = Array.isArray(CHL.user.identities) ? CHL.user.identities : [];
    var verified = !!(CHL.user.email_confirmed_at || CHL.user.confirmed_at);
    var card = el('section', { class: 'card form-stack', style: 'max-width:760px' });
    [[ 'Email', safeEmail() ], ['Username', p.username || 'Not set'], ['Display name', p.display_name || 'Not set'], ['Account ID', CHL.user.id], ['Email status', verified ? 'Verified' : 'Not confirmed'], ['Linked sign-in identities', String(identities.length || 0)], ['Account status', p.account_status || 'Active (legacy schema may not expose status)'], ['Member since', p.created_at ? new Date(p.created_at).toLocaleString() : 'Not available']].forEach(function (pair) {
      card.appendChild(el('div', { class: 'row wrap', style: 'justify-content:space-between;gap:8px' }, [el('span', { class: 'u', text: pair[0] }), el('strong', { style: 'overflow-wrap:anywhere', text: pair[1] })]));
    });
    card.appendChild(el('div', { class: 'row wrap', style: 'gap:8px' }, [settingsLink('#/settings/profile', 'Edit profile'), settingsLink('#/settings/security', 'Password & login'), settingsLink('#/settings/connected', 'Connected accounts')]));
    o.appendChild(card);
  });

  CHL.route('/settings/blocked', async function (o) {
    if (!needUser(o, 'Blocked accounts', 'Manage accounts you have blocked. Removing a block does not automatically follow or message the account.')) return;
    var list = el('div', { class: 'grid', style: 'grid-template-columns:minmax(0,1fr);gap:8px;max-width:760px' }); o.appendChild(list); list.appendChild(ui.spinner());
    try {
      var q = await sb.from('blocks').select('blocked_id,created_at').eq('blocker_id', CHL.user.id).order('created_at', { ascending: false });
      if (q.error) throw q.error; var rows = q.data || []; list.innerHTML = '';
      if (!rows.length) { list.appendChild(ui.empty('🛡️', 'No blocked accounts', 'Accounts you block will appear here.')); return; }
      var ids = rows.map(function (x) { return x.blocked_id; });
      var profiles = await sb.from('profiles').select('id,username,display_name,avatar_url').in('id', ids);
      if (profiles.error) throw profiles.error;
      var byId = {}; (profiles.data || []).forEach(function (p) { byId[p.id] = p; });
      rows.forEach(function (row) { var p = byId[row.blocked_id] || { id: row.blocked_id, username: 'Private or unavailable account', display_name: 'Blocked account' };
        var card = el('div', { class: 'card row wrap', style: 'justify-content:space-between;gap:10px' }, [el('div', { style: 'min-width:0' }, [el('strong', { text: p.display_name || p.username }), el('div', { class: 'u', text: '@' + p.username })])]);
        card.appendChild(el('button', { class: 'btn small', type: 'button', onclick: async function (event) { var button = event.currentTarget; button.disabled = true; try { var d = await sb.from('blocks').delete().eq('blocker_id', CHL.user.id).eq('blocked_id', row.blocked_id); if (d.error) throw d.error; card.remove(); if (!list.children.length) list.appendChild(ui.empty('🛡️', 'No blocked accounts', 'Your blocked list is empty.')); CHL.toast('Block removed.'); } catch (e) { CHL.toast(e.message || 'Could not remove block.'); button.disabled = false; } } }, 'Unblock'));
        list.appendChild(card);
      });
    } catch (e) { showError(list, e, 'Could not load blocked accounts.'); }
  });

  async function renderRelationshipList(o, kind) {
    o.innerHTML = '';
    var title = kind === 'followers' ? 'Your followers' : 'Accounts you follow';
    if (!needUser(o, title, 'Real relationship records from your account.')) return;
    var list = el('div', { class: 'grid', style: 'grid-template-columns:minmax(0,1fr);gap:8px;max-width:760px' }); o.appendChild(list); list.appendChild(ui.spinner());
    try {
      var col = kind === 'followers' ? 'followee_id' : 'follower_id';
      var selectCol = kind === 'followers' ? 'follower_id' : 'followee_id';
      var q = await sb.from('follows').select('follower_id,followee_id,status,created_at').eq(col, CHL.user.id).order('created_at', { ascending: false });
      if (q.error) throw q.error;
      var rows = (q.data || []).filter(function (x) { return x.status === 'accepted' || (kind === 'followers' && x.status === 'pending'); });
      list.innerHTML = '';
      if (!rows.length) { list.appendChild(ui.empty('👥', kind === 'followers' ? 'No followers yet' : 'Not following anyone yet', 'When this list changes, the real database records will appear here.')); return; }
      var ids = rows.map(function (x) { return x[selectCol]; });
      var pr = await sb.from('profiles').select('id,username,display_name,followers_count').in('id', ids);
      if (pr.error) throw pr.error; var map = {}; (pr.data || []).forEach(function (p) { map[p.id] = p; });
      rows.forEach(function (r) { var p = map[r[selectCol]]; if (!p) p = { username: 'Private or unavailable account', display_name: 'Creator account' };
        var card=el('div',{class:'card row wrap',style:'align-items:center;gap:10px'},[
          el('div', { class: 'ava', style: 'width:42px;height:42px;display:flex;align-items:center;justify-content:center;flex-shrink:0', text: CHL.initials(p.display_name || p.username).toUpperCase() }),
          el('div', { style: 'min-width:0;flex:1' }, [el('strong', { text: p.display_name || p.username }), el('div', { class: 'u', text: p.username==='Private or unavailable account'?'Profile details unavailable':'@' + p.username })]),
          el('span', { class: 'chip', text: r.status === 'pending' ? 'Follow request pending' : 'Following' })
        ]);
        if(kind==='followers' && r.status==='pending' && r.followee_id===CHL.user.id){
          var accept=el('button',{class:'btn small',type:'button',text:'Accept',onclick:async function(event){var b=event.currentTarget;b.disabled=true;try{var u=await sb.from('follows').update({status:'accepted'}).eq('follower_id',r.follower_id).eq('followee_id',r.followee_id).eq('status','pending');if(u.error)throw u.error;CHL.toast('Follow request accepted.');await renderRelationshipList(o,kind);}catch(e){CHL.toast(e.message||'Could not accept request.');b.disabled=false;}}});
          var reject=el('button',{class:'btn small',type:'button',text:'Reject',onclick:async function(event){var b=event.currentTarget;b.disabled=true;try{var d=await sb.from('follows').delete().eq('follower_id',r.follower_id).eq('followee_id',r.followee_id).eq('status','pending');if(d.error)throw d.error;CHL.toast('Follow request rejected.');await renderRelationshipList(o,kind);}catch(e){CHL.toast(e.message||'Could not reject request.');b.disabled=false;}}});
          card.appendChild(accept);card.appendChild(reject);
        } else if(p.username!=='Private or unavailable account') {
          card.style.cursor='pointer';card.tabIndex=0;card.setAttribute('role','link');card.addEventListener('click',function(){CHL.navigate('#/profile/'+encodeURIComponent(p.username));});
          card.addEventListener('keydown',function(event){if(event.key==='Enter'||event.key===' '){event.preventDefault();CHL.navigate('#/profile/'+encodeURIComponent(p.username));}});
        }
        list.appendChild(card);
      });
    } catch (e) { showError(list, e, 'Could not load relationship records.'); }
  }
  CHL.route('/profile/followers', function (o) { renderRelationshipList(o, 'followers'); });
  CHL.route('/profile/following', function (o) { renderRelationshipList(o, 'following'); });

  CHL.route('/settings/connectivity', function (o) {
    o.appendChild(ui.pageHead('Data & connectivity', 'Check the actual browser network state, configured Supabase client and backend health endpoint. A healthy status is not a substitute for testing each feature.'));
    var area=el('div',{class:'grid',style:'grid-template-columns:minmax(0,1fr);gap:10px;max-width:760px'});o.appendChild(area);
    function row(label,value){return el('div',{class:'row wrap',style:'justify-content:space-between;gap:8px'},[el('span',{class:'u',text:label}),el('strong',{style:'overflow-wrap:anywhere',text:value})]);}
    async function refresh(){area.innerHTML='';area.appendChild(ui.spinner());var lines=[];lines.push(['Browser network',navigator.onLine?'Online':'Offline']);var supabase='Not configured';if(CHL.configured&&sb){try{var sq=await sb.from('profiles').select('id').limit(1);if(sq.error)throw sq.error;supabase='Reachable';}catch(e){supabase=(e&&e.message)||'Supabase request failed';}}lines.push(['Supabase',supabase]);lines.push(['Current authentication',CHL.user?'Signed in':'Signed out']);var health='Not checked';try{var r=await CHL.apiRequest('/api/health',{timeoutMs:6000});health=(r&&r.ok===false?'Responded with an error':'Reachable')+(r&&r.backendRelease?' · release '+r.backendRelease:'');}catch(e){health=(e&&e.message)||'Backend request failed';}lines.push(['Backend health',health]);area.innerHTML='';var card=el('section',{class:'card form-stack'});lines.forEach(function(v){card.appendChild(row(v[0],v[1]));});var btn=el('button',{class:'btn primary',type:'button',text:'Refresh connection status',onclick:refresh});card.appendChild(btn);card.appendChild(el('div',{class:'note',text:'Network status only reports the browser connectivity signal. Backend reachability does not prove that Supabase policies, database migrations, PayPal, or LiveKit are fully operational.'}));area.appendChild(card);}
    refresh();
  });

  CHL.route('/settings/connected', function (o) {
    if (!needUser(o, 'Connected accounts', 'Review identities the authentication provider currently reports for this signed-in account.')) return;
    var list = el('div', { class: 'grid', style: 'grid-template-columns:minmax(0,1fr);gap:8px;max-width:760px' }); o.appendChild(list);
    var ids = Array.isArray(CHL.user.identities) ? CHL.user.identities : [];
    if (!ids.length) list.appendChild(ui.empty('🔗', 'No external identities listed', 'Your current session is connected through the configured authentication provider. This page does not claim that unconfigured social providers are linked.'));
    ids.forEach(function (identity) {
      var data = identity.identity_data || {};
      list.appendChild(el('div', { class: 'card' }, [el('strong', { text: identity.provider || 'Authentication provider' }), el('div', { class: 'u', text: data.email || data.preferred_username || data.user_name || 'Provider did not disclose a username' }), el('div', { class: 'note', text: 'Unlinking identities is not exposed here because removing the only sign-in method can lock you out.' })]));
    });
  });

  CHL.route('/settings/data', function (o) {
    if (!needUser(o, 'Download your data', 'Export available account-owned records to a local JSON file. This browser export does not include direct-message bodies or data held only by third-party providers.')) return;
    var card = el('div', { class: 'card form-stack', style: 'max-width:760px' });
    card.appendChild(el('p', { text: 'The export includes your profile, posts you authored, follow relationships, notification records, saved settings, and wallet transactions when the backend endpoint is reachable.' }));
    var status = el('div', { class: 'note', text: 'Nothing is downloaded until you press the export button.' });
    var button = el('button', { class: 'btn primary', type: 'button', onclick: exportData }, 'Prepare and download account export');
    card.appendChild(button); card.appendChild(status); o.appendChild(card);
    async function exportData() {
      button.disabled = true; button.textContent = 'Preparing export…'; status.textContent = 'Reading your account-owned records…';
      try {
        var user = CHL.user.id;
        var results = await Promise.all([
          sb.from('profiles').select('id,username,display_name,bio,avatar_url,cover_url,country,language,links,creator_category,is_creator,gifter_level,league,privacy,followers_count,following_count,posts_count,created_at,updated_at,account_status').eq('id', user).maybeSingle(),
          sb.from('posts').select('id,author_id,kind,caption,media,cover_url,hashtags,audience,allow_comments,allow_repost,created_at').eq('author_id', user).order('created_at', { ascending: false }).limit(5000),
          sb.from('follows').select('follower_id,followee_id,status,created_at').or('follower_id.eq.' + user + ',followee_id.eq.' + user).limit(10000),
          sb.from('user_settings').select('privacy,notifications,live,updated_at').eq('user_id', user).maybeSingle(),
          sb.from('notifications').select('id,type,actor_id,data,read,created_at').eq('user_id', user).order('created_at', { ascending: false }).limit(5000)
        ]);
        var labels = ['profile', 'posts', 'follows', 'settings', 'notifications'];
        var data = { export_format: 'creator-hub-account-export-v1', exported_at: new Date().toISOString(), account_id: user, records: {}, warnings: [] };
        results.forEach(function (r, i) { if (r.error) { data.warnings.push(labels[i] + ': ' + r.error.message); } else { data.records[labels[i]] = r.data; } });
        try { var wallet = await CHL.authenticatedApiRequest('/api/wallet/transactions?limit=100'); data.records.wallet_transactions = wallet.transactions || []; }
        catch (walletError) { data.warnings.push('wallet_transactions: ' + (walletError.message || 'Backend unavailable')); }
        if (!Object.keys(data.records).length) throw new Error('No records could be exported. ' + data.warnings.join('; '));
        var blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json;charset=utf-8' });
        var url = URL.createObjectURL(blob); var a = el('a', { href: url, download: 'creator-hub-account-export-' + new Date().toISOString().slice(0, 10) + '.json' });
        document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(url);
        status.textContent = data.warnings.length ? 'Export downloaded with partial-data warnings. Review the warnings inside the JSON file.' : 'Export downloaded. Review the JSON file and store it securely.';
      } catch (e) { status.textContent = e.message || 'Account export failed.'; }
      finally { button.disabled = false; button.textContent = 'Prepare and download account export'; }
    }
  });

  CHL.route('/settings/verification', async function (o) {
    if (!needUser(o, 'Creator verification', 'Submit an application for manual review. Approval is not automatic and is never fabricated.')) return;
    var area = el('div', { class: 'grid', style: 'grid-template-columns:minmax(0,1fr);gap:12px;max-width:760px' }); o.appendChild(area); area.appendChild(ui.spinner());
    try {
      var existing = await sb.from('creator_verification_requests').select('status,reason,evidence_url,reviewer_note,submitted_at,reviewed_at').eq('user_id', CHL.user.id).maybeSingle();
      if (existing.error) throw existing.error; var row = existing.data;
      area.innerHTML = '';
      if (row) area.appendChild(el('div', { class: 'card' }, [el('strong', { text: 'Application status: ' + row.status }), el('div', { class: 'u', text: 'Submitted ' + new Date(row.submitted_at).toLocaleString() }), row.reviewer_note ? el('p', { text: 'Reviewer note: ' + row.reviewer_note }) : null, row.status === 'verified' ? el('div', { class: 'chip', text: 'Verified Creator badge approved' }) : null]));
      if (row && row.status === 'verified') {
        area.appendChild(el('div', { class: 'note', text: 'Your creator verification is approved. The verification team must revoke or change the decision before another application can be submitted.' }));
        return;
      }
      var form = el('form', { class: 'card form-stack', onsubmit: async function (event) {
        event.preventDefault(); var reason = form.reason.value.trim(), url = form.evidence.value.trim();
        if (reason.length < 20) { CHL.toast('Explain your request in at least 20 characters.'); return; }
        if (url && !/^https:\/\//i.test(url)) { CHL.toast('Evidence links must begin with https://.'); return; }
        var btn = form.querySelector('button[type=submit]'); btn.disabled = true;
        try {
          var payload = { user_id: CHL.user.id, reason: reason, evidence_url: url, status: 'pending', reviewer_note: '', reviewed_by: null, submitted_at: new Date().toISOString(), reviewed_at: null };
          var save = await sb.from('creator_verification_requests').upsert(payload, { onConflict: 'user_id' });
          if (save.error) throw save.error; CHL.toast('Verification application submitted for review.'); CHL.render();
        } catch (e) { CHL.toast(e.message || 'Could not submit verification request. Check migration 0024 and database permissions.'); btn.disabled = false; }
      } });
      form.appendChild(el('label', { class: 'field' }, [el('span', { class: 'field-label', text: 'Why should this creator account be verified?' }), el('textarea', { class: 'input', name: 'reason', rows: '5', required: true, minlength: '20', maxlength: '2000', placeholder: 'Describe your creator identity, public presence, and why verification is appropriate.' })]));
      form.appendChild(el('label', { class: 'field' }, [el('span', { class: 'field-label', text: 'Evidence URL (optional)' }), el('input', { class: 'input', name: 'evidence', type: 'url', placeholder: 'https://…' })]));
      form.appendChild(el('div', { class: 'note', text: 'Never submit passwords, access tokens, payment secrets, or sensitive identity documents through a public URL. A submitted request does not mean the account is verified.' }));
      form.appendChild(el('button', { class: 'btn primary', type: 'submit' }, row && row.status === 'pending' ? 'Update pending application' : 'Submit verification application')); area.appendChild(form);
    } catch (e) { showError(area, e, 'Verification service is unavailable. Apply database migration 0024 if it has not been installed.'); }
  });

  CHL.route('/settings/deletion', function (o) {
    if (!needUser(o, 'Deactivate or delete account', 'These actions affect account access and data. Read the effect before submitting.')) return;
    var card = el('div', { class: 'card form-stack', style: 'max-width:760px' });
    card.appendChild(el('h3', { text: 'Deactivate account' }));
    card.appendChild(el('p', { text: 'Deactivation signs you out and blocks future authentication. Existing access tokens may remain usable until they expire; do not treat deactivation as a substitute for deleting data.' }));
    var deact = el('form', { class: 'form-stack', onsubmit: async function (event) { event.preventDefault(); if (deact.confirm.value.trim() !== 'DEACTIVATE') { CHL.toast('Type DEACTIVATE exactly to continue.'); return; } var b = deact.querySelector('button'); b.disabled = true; try { await CHL.authenticatedApiRequest('/api/account/deactivate', { method: 'POST', body: { confirm: 'DEACTIVATE' } }); CHL.toast('Account deactivated. Signing out.'); await sb.auth.signOut({ scope: 'local' }); CHL.user = null; CHL.profile = null; CHL.navigate('#/login'); } catch (e) { CHL.toast(e.message || 'Account deactivation failed.'); b.disabled = false; } } });
    deact.appendChild(el('label', { class: 'field' }, [el('span', { class: 'field-label', text: 'Type DEACTIVATE to confirm' }), el('input', { class: 'input', name: 'confirm', autocomplete: 'off', required: true })]));
    deact.appendChild(el('button', { class: 'btn', type: 'submit' }, 'Deactivate account')); card.appendChild(deact);
    card.appendChild(el('hr', {})); card.appendChild(el('h3', { text: 'Permanently delete account' }));
    card.appendChild(el('p', { text: 'This permanently deletes the Supabase authentication account and cascaded records where the database schema defines cascade deletion. Some payment, safety, or legal records may need separate retention review. This action cannot be undone.' }));
    var del = el('form', { class: 'form-stack', onsubmit: async function (event) { event.preventDefault(); if (del.confirm.value.trim() !== 'DELETE') { CHL.toast('Type DELETE exactly to continue.'); return; } if (!window.confirm('Permanently delete this account? This cannot be undone.')) return; var b = del.querySelector('button'); b.disabled = true; try { await CHL.authenticatedApiRequest('/api/account', { method: 'DELETE', body: { confirm: 'DELETE' } }); await sb.auth.signOut({ scope: 'local' }); CHL.user = null; CHL.profile = null; CHL.toast('Account deletion request completed by the backend.'); CHL.navigate('#/register'); } catch (e) { CHL.toast(e.message || 'Account deletion failed.'); b.disabled = false; } } });
    del.appendChild(el('label', { class: 'field' }, [el('span', { class: 'field-label', text: 'Type DELETE to confirm permanent deletion' }), el('input', { class: 'input', name: 'confirm', autocomplete: 'off', required: true })]));
    del.appendChild(el('button', { class: 'btn danger', type: 'submit' }, 'Permanently delete my account')); card.appendChild(del); o.appendChild(card);
  });

  CHL.route('/settings/legal', function (o) {
    o.appendChild(ui.pageHead('Terms & privacy', 'Read the current platform policy drafts before using account, content, messaging, LIVE, competitions or payments.'));
    var grid = el('div', { class: 'grid settings-grid' }, [
      el('a', { class: 'card settings-card', href: '#/terms' }, [el('strong', { text: 'Terms of Service' }), el('span', { class: 'u', text: 'Use of accounts, content, LIVE and payments.'})]),
      el('a', { class: 'card settings-card', href: '#/privacy' }, [el('strong', { text: 'Privacy Policy' }), el('span', { class: 'u', text: 'Data handling, privacy controls and third-party services.'})]),
      el('a', { class: 'card settings-card', href: '#/community-guidelines' }, [el('strong', { text: 'Community Guidelines' }), el('span', { class: 'u', text: 'Respect, safety, honest competition and content rights.'})])
    ]); o.appendChild(grid);
    o.appendChild(el('div', { class: 'note', text: 'Legal pages are operating drafts and must be reviewed against actual deployment practices and applicable law before public launch.' }));
  });
})();
