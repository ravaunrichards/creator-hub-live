/* Creator Hub Creator Network — complete Teams UI, backed by /api/teams. */
(function () {
  'use strict';
  var CHL = window.CHL;
  var el = CHL.el, ui = CHL.ui;
  if (!CHL || !el || !ui) return;

  function api(path, method, body, authenticated) {
    var options = { method: method || 'GET' };
    if (body !== undefined) options.body = body;
    return authenticated ? CHL.authenticatedApiRequest(path, options) : CHL.apiRequest(path, options);
  }
  function note(message, kind) {
    return el('div', { class: 'note', style: 'margin:10px 0;' + (kind === 'error' ? 'border-color:var(--warn);' : '') , text: message });
  }
  function button(label, click, primary) {
    return el('button', { type: 'button', class: 'btn' + (primary ? ' primary' : ''), onclick: click }, label);
  }
  function field(labelText, type, value, placeholder) {
    var input = el('input', { class: 'input', type: type || 'text', placeholder: placeholder || '', maxlength: type === 'url' ? '1000' : undefined });
    if (value != null) input.value = String(value);
    var label = el('label', { class: 'field', style: 'flex:1 1 220px;min-width:0;' }, [el('span', { text: labelText }), input]);
    return { wrap: label, input: input };
  }
  function textArea(labelText, value, placeholder) {
    var input = el('textarea', { class: 'input', rows: '3', maxlength: '1000', placeholder: placeholder || '', style: 'resize:vertical;min-height:84px;' });
    if (value != null) input.value = String(value);
    return { wrap: el('label', { class: 'field', style: 'flex:1 1 100%;min-width:0;' }, [el('span', { text: labelText }), input]), input: input };
  }
  function safeText(value, fallback) { return value == null || value === '' ? (fallback || '') : String(value); }
  function division(team) { return safeText(team.division_code, 'D5'); }
  function formatPoints(value) { return CHL.fmt(Number(value) || 0); }
  function showError(out, error) {
    out.innerHTML = '';
    out.appendChild(note((error && error.message) || 'The request failed. Please try again.', 'error'));
  }
  function pageHead(out, subtitle) {
    out.appendChild(ui.pageHead('Teams', subtitle || 'Create, manage and join creator teams. League placement is managed by the competition system.'));
  }
  function renderList(out) {
    pageHead(out, 'Create a team, manage membership and compete in the division assigned by the league system.');
    var controls = el('div', { class: 'row wrap', style: 'gap:8px;margin:12px 0;' });
    var search = field('Search teams', 'search', '', 'Enter a team name');
    search.wrap.style.flex = '1 1 240px';
    var searchBtn = button('Search', function () { loadTeams(search.input.value); }, true);
    var createBtn = button('＋ Create team', function () {
      if (!CHL.user) { CHL.navigate('#/login'); return; }
      renderCreateForm(out, function () { renderList(out); });
    }, true);
    controls.appendChild(search.wrap); controls.appendChild(searchBtn); controls.appendChild(createBtn); out.appendChild(controls);
    var list = el('div', { class: 'grid live', style: 'grid-template-columns:repeat(auto-fit,minmax(min(100%,260px),1fr));gap:12px;' });
    out.appendChild(list);
    function loadTeams(query) {
      list.innerHTML = ''; list.appendChild(ui.spinner());
      api('/api/teams' + (query ? '?q=' + encodeURIComponent(query) : ''), 'GET', undefined, false)
        .then(function (result) {
          list.innerHTML = '';
          var teams = result && result.teams || [];
          if (!teams.length) {
            list.appendChild(ui.empty('🛡️', query ? 'No matching teams' : 'No teams yet', query ? 'Try another team name.' : 'Create the first team when you are ready.'));
            return;
          }
          teams.forEach(function (team) {
            var title = el('div', { class: 't', text: team.name });
            var meta = el('div', { class: 'u', text: division(team) + ' division · ' + formatPoints(team.points) + ' points' });
            var extra = el('div', { class: 'u', text: (team.parish ? team.parish + ' · ' : '') + (Number(team.member_count) || 0) + '/' + (Number(team.max_members) || 20) + ' members' });
            var details = el('div', { class: 'meta', style: 'min-width:0;overflow-wrap:anywhere;' }, [title, meta, extra]);
            var badge = team.logo_url ? el('img', { src: team.logo_url, alt: team.name + ' logo', loading: 'lazy', style: 'width:54px;height:54px;object-fit:cover;border-radius:14px;' }) : el('div', { class: 'ava', style: 'width:54px;height:54px;flex:0 0 54px;', text: CHL.initials(team.name).toUpperCase() });
            var card = el('div', { class: 'tile', style: 'display:flex;gap:12px;align-items:center;min-width:0;cursor:pointer;' }, [badge, details, el('span', { class: 'pill', text: team.recruiting ? 'Open' : 'Closed' })]);
            card.addEventListener('click', function () { CHL.navigate('#/teams/' + team.id); });
            list.appendChild(card);
          });
        }).catch(function (error) {
          list.innerHTML = '';
          var detail=(error && error.message) || 'Backend request failed.';
          if (error && error.code) detail += ' ['+error.code+']';
          if (error && error.status) detail += ' (HTTP '+error.status+')';
          if (error && error.details && error.details.databaseCode) detail += ' [database: '+String(error.details.databaseCode)+']';
          list.appendChild(note('Teams could not be loaded: ' + detail, 'error'));
        });
    }
    loadTeams('');
  }
  function renderCreateForm(out, done) {
    out.innerHTML = ''; pageHead(out, 'Create a team with accurate details. The league system controls division placement.');
    var form = el('form', { class: 'card', style: 'display:flex;flex-wrap:wrap;gap:10px;align-items:flex-start;min-width:0;' });
    var name = field('Team name (required)', 'text', '', '3–48 characters');
    var parish = field('Parish (optional)', 'text', '', 'e.g. Portland');
    var logo = field('Logo image URL (optional)', 'url', '', 'HTTPS image URL');
    var badge = field('Badge image URL (optional)', 'url', '', 'HTTPS image URL');
    var desc = textArea('Description (optional)', '', 'Tell creators what this team is about');
    var max = field('Maximum members', 'number', '20', '2–500'); max.input.min = '2'; max.input.max = '500'; max.input.step = '1';
    [name.wrap, parish.wrap, logo.wrap, badge.wrap, desc.wrap, max.wrap].forEach(function (x) { form.appendChild(x); });
    form.appendChild(note('New teams start in division D5. Division changes, standings and promotion/relegation are controlled by the league system—not by a manually selected level.'));
    var actions = el('div', { class: 'row wrap', style: 'gap:8px;width:100%;' });
    var submit = button('Create team', function () { if (form.requestSubmit) form.requestSubmit(); }, true);
    var cancel = button('Cancel', done, false); actions.appendChild(submit); actions.appendChild(cancel); form.appendChild(actions);
    var feedback = el('div', { style: 'width:100%;' }); form.appendChild(feedback); out.appendChild(form);
    form.addEventListener('submit', function (event) {
      event.preventDefault(); feedback.innerHTML = '';
      if (!name.input.value.trim()) { feedback.appendChild(note('Enter a team name.', 'error')); name.input.focus(); return; }
      submit.disabled = true; submit.textContent = 'Creating…';
      api('/api/teams', 'POST', { name: name.input.value, parish: parish.input.value, logo_url: logo.input.value, badge_url: badge.input.value, description: desc.input.value, max_members: Number(max.input.value || 20) }, true)
        .then(function (result) { if (!result || !result.team || !result.team.id) throw new Error('The backend did not confirm team creation.'); CHL.navigate('#/teams/' + result.team.id); })
        .catch(function (error) { feedback.appendChild(note(error.message || 'Team creation failed.', 'error')); submit.disabled = false; submit.textContent = 'Create team'; });
    });
  }
  function renderEditForm(out, team, onSaved) {
    var form = el('form', { class: 'card', style: 'display:flex;flex-wrap:wrap;gap:10px;align-items:flex-start;min-width:0;margin-top:14px;' });
    var name = field('Team name', 'text', team.name, '3–48 characters');
    var parish = field('Parish', 'text', team.parish || '', 'e.g. Portland');
    var logo = field('Logo image URL', 'url', team.logo_url || '', 'HTTPS image URL');
    var badge = field('Badge image URL', 'url', team.badge_url || '', 'HTTPS image URL');
    var desc = textArea('Description', team.description || '', 'Team description');
    var max = field('Maximum members', 'number', String(team.max_members || 20), '2–500'); max.input.min = '2'; max.input.max = '500'; max.input.step = '1';
    var recruiting = el('input', { type: 'checkbox' }); recruiting.checked = team.recruiting !== false;
    var recruitWrap = el('label', { class: 'field', style: 'flex:1 1 100%;' }, [recruiting, el('span', { text: 'Accepting new members' })]);
    [name.wrap, parish.wrap, logo.wrap, badge.wrap, desc.wrap, max.wrap, recruitWrap].forEach(function (x) { form.appendChild(x); });
    form.appendChild(note('Division and competitive standings cannot be edited here. The league system controls those values.'));
    var actions = el('div', { class: 'row wrap', style: 'gap:8px;width:100%;' });
    var submit = button('Save changes', function () { if (form.requestSubmit) form.requestSubmit(); }, true);
    var cancel = button('Cancel editing', function () { onSaved(false); }, false);
    actions.appendChild(submit); actions.appendChild(cancel); form.appendChild(actions);
    var feedback = el('div', { style: 'width:100%;' }); form.appendChild(feedback); out.appendChild(form);
    form.addEventListener('submit', function (event) {
      event.preventDefault(); feedback.innerHTML = ''; submit.disabled = true; submit.textContent = 'Saving…';
      api('/api/teams/' + team.id, 'PATCH', { name: name.input.value, parish: parish.input.value, logo_url: logo.input.value, badge_url: badge.input.value, description: desc.input.value, max_members: Number(max.input.value || 20), recruiting: recruiting.checked }, true)
        .then(function () { onSaved(true); })
        .catch(function (error) { feedback.appendChild(note(error.message || 'Team update failed.', 'error')); submit.disabled = false; submit.textContent = 'Save changes'; });
    });
  }
  function renderDetail(out, id) {
    pageHead(out, 'Team profile, membership and owner controls.');
    out.appendChild(ui.spinner());
    api('/api/teams/' + encodeURIComponent(id), 'GET', undefined, !!CHL.user).then(function (result) {
      out.innerHTML = ''; pageHead(out, 'Team profile, membership and owner controls.');
      var team = result && result.team;
      if (!team) { out.appendChild(ui.empty('🛡️', 'Team not found', 'This team may no longer be available.', el('a', { href: '#/teams', class: 'btn', style: 'margin-top:8px' }, 'All teams'))); return; }
      var heading = el('div', { class: 'card', style: 'display:flex;gap:14px;align-items:center;flex-wrap:wrap;min-width:0;' });
      var mark = team.logo_url ? el('img', { src: team.logo_url, alt: team.name + ' logo', style: 'width:72px;height:72px;object-fit:cover;border-radius:16px;' }) : el('div', { class: 'ava', style: 'width:72px;height:72px;font-size:24px;flex:0 0 72px;', text: CHL.initials(team.name).toUpperCase() });
      heading.appendChild(mark);
      heading.appendChild(el('div', { style: 'flex:1 1 220px;min-width:0;overflow-wrap:anywhere;' }, [el('div', { style: 'font-size:21px;font-weight:800;', text: team.name }), el('div', { class: 'u', text: division(team) + ' division · ' + formatPoints(team.points) + ' points' }), el('div', { class: 'u', text: (team.parish ? team.parish + ' · ' : '') + (result.member_count || 0) + '/' + (team.max_members || 20) + ' members · ' + (team.recruiting ? 'Recruiting' : 'Not recruiting') })]));
      if (team.badge_url) heading.appendChild(el('img', { src: team.badge_url, alt: team.name + ' badge', style: 'width:48px;height:48px;object-fit:contain;' }));
      out.appendChild(heading);
      if (team.description) out.appendChild(el('div', { class: 'card', style: 'margin-top:12px;white-space:pre-wrap;overflow-wrap:anywhere;', text: team.description }));
      out.appendChild(note('League placement is based on division ' + division(team) + '. Numeric levels 1–50 are retained only for database compatibility; this page does not use them as league progression.'));
      var actions = el('div', { class: 'row wrap', style: 'gap:8px;margin:12px 0;' });
      if (!CHL.user) actions.appendChild(button('Sign in to join', function () { CHL.navigate('#/login'); }, true));
      else if (result.is_owner) actions.appendChild(button('Edit team', function () { renderEditForm(out, team, function (saved) { if (saved) renderDetail(out, id); else renderDetail(out, id); }); }, true));
      else if (result.is_member) actions.appendChild(button('Leave team', function () {
        if (!window.confirm('Leave this team?')) return;
        api('/api/teams/' + id + '/leave', 'POST', {}, true).then(function () { renderDetail(out, id); }).catch(function (error) { out.appendChild(note(error.message || 'Could not leave team.', 'error')); });
      }, false));
      else if (team.recruiting) actions.appendChild(button('Join team', function () {
        api('/api/teams/' + id + '/join', 'POST', {}, true).then(function () { renderDetail(out, id); }).catch(function (error) { out.appendChild(note(error.message || 'Could not join team.', 'error')); });
      }, true));
      else actions.appendChild(note('This team is not accepting new members.'));
      actions.appendChild(button('All teams', function () { CHL.navigate('#/teams'); }, false)); out.appendChild(actions);
      out.appendChild(el('div', { class: 'h1', style: 'font-size:18px;margin:16px 0 8px;', text: 'Team members' }));
      var roster = el('div', { class: 'grid live', style: 'grid-template-columns:repeat(auto-fit,minmax(min(100%,220px),1fr));gap:10px;' }); out.appendChild(roster);
      var members = result.members || [];
      if (!members.length) roster.appendChild(ui.empty('👥', 'No members listed', 'The team roster is currently empty.'));
      members.forEach(function (member) {
        var profile = member.profile || {};
        var display = profile.display_name || profile.username || 'Creator';
        var tile = el('div', { class: 'tile', style: 'display:flex;align-items:center;gap:10px;min-width:0;' }, [el('div', { class: 'ava', style: 'flex:0 0 40px;', text: CHL.initials(display).toUpperCase() }), el('div', { style: 'min-width:0;flex:1;overflow-wrap:anywhere;' }, [el('div', { class: 't', text: display }), el('div', { class: 'u', text: member.role === 'owner' ? 'Team owner' : 'Member' })])]);
        if (result.is_owner && member.role !== 'owner') tile.appendChild(button('Remove', function () {
          if (!window.confirm('Remove ' + display + ' from this team?')) return;
          api('/api/teams/' + id + '/members/' + member.user_id, 'DELETE', undefined, true).then(function () { renderDetail(out, id); }).catch(function (error) { out.appendChild(note(error.message || 'Could not remove member.', 'error')); });
        }, false));
        roster.appendChild(tile);
      });
    }).catch(function (error) { showError(out, error); });
  }

  // Replace the existing placeholder route without registering a duplicate route.
  CHL.routes['/teams'] = function (out, route) {
    if (!CHL.configured) { pageHead(out, 'Create and manage creator teams.'); out.appendChild(ui.setupNotice()); return; }
    if (route && route.params && route.params.length) renderDetail(out, route.params[0]);
    else renderList(out);
  };
})();
