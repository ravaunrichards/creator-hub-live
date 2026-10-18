/* Creator Hub Live — Free Fire-inspired competitive rank ladder and verified league achievements. */
(function () {
  'use strict';

  var CHL = window.CHL;
  if (!CHL || !CHL.routes || !CHL.el || !CHL.ui) return;
  var el = CHL.el;
  var ui = CHL.ui;
  var sb = CHL.sb;

  var TIERS = [
    { key: 'bronze', name: 'Bronze', icon: '🥉', divisions: ['I', 'II', 'III'], description: 'Entry tier for new competitors to learn the fundamentals.' },
    { key: 'silver', name: 'Silver', icon: '🥈', divisions: ['I', 'II', 'III'], description: 'Build consistent coordination and sound rotation decisions.' },
    { key: 'gold', name: 'Gold', icon: '🥇', divisions: ['I', 'II', 'III', 'IV'], description: 'Show reliable mechanics, execution and match awareness.' },
    { key: 'platinum', name: 'Platinum', icon: '💎', divisions: ['I', 'II', 'III', 'IV'], description: 'Apply strategy, character skills and loadout decisions effectively.' },
    { key: 'diamond', name: 'Diamond', icon: '👑', divisions: ['I', 'II', 'III', 'IV'], description: 'Demonstrate high-level communication, utility and fast decisions.' },
    { key: 'heroic', name: 'Heroic', icon: '🎖️', divisions: [], description: 'Professional tier for highly skilled competitive squads.' },
    { key: 'master', name: 'Master', icon: '🔮', divisions: [], description: 'Exceptional game sense, execution and team synergy.' },
    { key: 'grandmaster', name: 'Grandmaster', icon: '🌌', divisions: [], description: 'The regional peak, reserved for top-ranked competitors.', note: 'Top 100–1,000' }
  ];

  var DIVISION_BANDS = [
    { label: 'A Division', codes: ['A1', 'A2', 'A3'], detail: 'Highest league division' },
    { label: 'B Division', codes: ['B1', 'B2', 'B3', 'B4', 'B5'], detail: 'Upper competitive division' },
    { label: 'C Division', codes: ['C1', 'C2', 'C3', 'C4', 'C5'], detail: 'Developing competitive division' },
    { label: 'D Division', codes: ['D1', 'D2', 'D3', 'D4', 'D5'], detail: 'Entry league division · D5 is the lowest' }
  ];

  var SEASONS = [
    { number: 1, name: 'Opening Season' },
    { number: 2, name: 'Rising Stars' },
    { number: 3, name: 'Champions League' },
    { number: 4, name: 'All-Star Season' }
  ];

  var CREATOR_NAV = [
    { href: '#/creator', label: 'Overview' },
    { href: '#/creator/achievements', label: 'Ranks & Achievements' },
    { href: '#/creator/analytics', label: 'Analytics' },
    { href: '#/creator/live', label: 'LIVE' },
    { href: '#/creator/live/history', label: 'Recordings' },
    { href: '#/creator/live/schedule', label: 'Schedule' },
    { href: '#/creator/earnings', label: 'Earnings' },
    { href: '#/creator/subscriptions', label: 'Subscribers' },
    { href: '#/creator/gifts', label: 'Gifts' }
  ];

  function makeSubnav() {
    var bar = el('div', { class: 'row wrap chl-rank-subnav' });
    CREATOR_NAV.forEach(function (item) {
      var active = CHL.current && CHL.current.path === item.href.replace('#', '');
      bar.appendChild(el('a', { href: item.href, class: 'chip' + (active ? ' on' : '') }, item.label));
    });
    return bar;
  }

  function sectionHeading(title, subtitle) {
    return el('div', { class: 'chl-rank-section-heading' }, [
      el('h2', { text: title }),
      el('p', { class: 'sub', text: subtitle })
    ]);
  }

  function renderTierLadder(parent) {
    parent.appendChild(sectionHeading('Competitive Rank Ladder', 'Lowest to highest · Free Fire-inspired structure for CHL ranked competition.'));
    var grid = el('div', { class: 'chl-rank-tier-grid', role: 'list', 'aria-label': 'Competitive ranks from Bronze to Grandmaster' });
    TIERS.forEach(function (tier, index) {
      var card = el('article', { class: 'chl-rank-tier-card chl-rank-tier-' + tier.key, role: 'listitem' });
      card.appendChild(el('div', { class: 'chl-rank-tier-top' }, [
        el('span', { class: 'chl-rank-tier-icon', 'aria-hidden': 'true', text: tier.icon }),
        el('div', { class: 'chl-rank-tier-title-wrap' }, [
          el('span', { class: 'chl-rank-tier-order', text: 'TIER ' + String(index + 1).padStart(2, '0') }),
          el('h3', { text: tier.name })
        ])
      ]));
      if (tier.divisions.length) {
        card.appendChild(el('div', { class: 'chl-rank-sublevels', 'aria-label': tier.name + ' divisions' }, tier.divisions.map(function (level) {
          return el('span', { class: 'chl-rank-sublevel', text: level });
        })));
      } else {
        card.appendChild(el('div', { class: 'chl-rank-sublevels chl-rank-single-tier' }, [
          el('span', { class: 'chl-rank-sublevel', text: tier.note || tier.name })
        ]));
      }
      card.appendChild(el('p', { class: 'chl-rank-tier-description', text: tier.description }));
      if (tier.note) card.appendChild(el('p', { class: 'chl-rank-tier-note', text: tier.note }));
      grid.appendChild(card);
    });
    parent.appendChild(grid);
    parent.appendChild(el('div', { class: 'chl-rank-honesty-note', role: 'note' }, [
      el('strong', { text: 'Rank assignment policy' }),
      el('span', { text: 'A tier is only official when CHL has a verified ranked result and an assigned rank. Viewing this ladder or completing a creator task does not grant rank, points, a badge, or a prize.' })
    ]));
  }

  function renderDivisionLadder(parent) {
    parent.appendChild(sectionHeading('Team League Divisions', 'This A1–D5 structure is separate from the Bronze–Grandmaster competitive rank ladder.'));
    var bands = el('div', { class: 'chl-rank-division-bands' });
    DIVISION_BANDS.forEach(function (band, index) {
      var card = el('section', { class: 'chl-rank-division-card chl-rank-division-' + band.label.charAt(0).toLowerCase() });
      card.appendChild(el('div', { class: 'chl-rank-division-heading' }, [
        el('h3', { text: band.label }),
        el('span', { class: 'sub', text: band.detail })
      ]));
      var codes = el('div', { class: 'chl-rank-division-codes' });
      band.codes.forEach(function (code) {
        codes.appendChild(el('span', { class: 'chl-rank-division-code', text: code, 'aria-label': 'League division ' + code }));
      });
      card.appendChild(codes);
      bands.appendChild(card);
    });
    parent.appendChild(bands);
    parent.appendChild(el('p', { class: 'chl-rank-order-note', text: 'Division hierarchy: A1 is highest; D5 is lowest. Promotion, relegation and position must come from official season standings.' }));
  }

  function renderSeasons(parent) {
    parent.appendChild(sectionHeading('CHL Creator League Seasons', 'Official season names are preserved exactly; this page does not assume a season is active.'));
    var grid = el('div', { class: 'chl-rank-season-grid' });
    SEASONS.forEach(function (season) {
      grid.appendChild(el('article', { class: 'chl-rank-season-card' }, [
        el('span', { class: 'chl-rank-season-number', text: 'SEASON ' + season.number }),
        el('h3', { text: season.name })
      ]));
    });
    parent.appendChild(grid);
  }

  function renderTeamStanding(parent) {
    var card = el('section', { class: 'card chl-rank-current-standing' });
    card.appendChild(sectionHeading('Your Verified Team Standing', 'Live standing from the existing CHL league API. Your A1–D5 division is not automatically converted into a Bronze–Grandmaster rank.'));
    var body = el('div', { class: 'chl-rank-standing-body' });
    body.appendChild(ui.spinner());
    card.appendChild(body);
    parent.appendChild(card);

    if (!CHL.user) {
      body.innerHTML = '';
      body.appendChild(ui.empty('🔒', 'Sign in to view your standing', 'Your team position is shown here when you are signed in and official season standings are available.', el('a', { href: '#/login', class: 'btn primary' }, 'Sign in')));
      return;
    }

    CHL.authenticatedApiRequest('/api/leagues/my-standing').then(function (data) {
      var memberships = Array.isArray(data && data.memberships) ? data.memberships : [];
      var ownRows = Array.isArray(data && data.standings) ? data.standings : [];
      body.innerHTML = '';
      if (!memberships.length) {
        body.appendChild(ui.empty('🛡️', 'No team standing yet', 'Your account is not listed as a member of a CHL team. Join a team to see its official division, position and points here.'));
        return;
      }
      if (!data.season) {
        body.appendChild(ui.empty('🗓️', 'No active league season', 'Your team membership was verified, but CHL has no active league season configured. Your rank and division have not been changed.'));
        return;
      }
      if (!ownRows.length) {
        body.appendChild(ui.empty('🏆', 'No active-season position available', 'Your team membership and active season were verified, but no official standing exists for your team yet.'));
        return;
      }
      ownRows.forEach(function (row) {
        var team = row.teams || {};
        var division = String(row.division_code || '—');
        var meta = [division, row.position == null ? 'Position pending' : 'Position #' + row.position, CHL.fmt(Number(row.points || 0)) + ' points'];
        body.appendChild(el('div', { class: 'chl-rank-standing-row' }, [
          el('span', { class: 'chl-rank-standing-emblem', text: '🏆', 'aria-hidden': 'true' }),
          el('div', { class: 'chl-rank-standing-main' }, [
            el('strong', { text: team.name || 'Your team' }),
            el('span', { class: 'sub', text: meta.join(' · ') })
          ]),
          el('span', { class: 'chl-rank-division-code', text: division })
        ]));
      });
    }).catch(function (error) {
      body.innerHTML = '';
      var detail = error && error.code ? ' Error code: ' + String(error.code) + '.' : '';
      body.appendChild(ui.empty('⚠️', 'Standing could not be verified', 'CHL could not verify your team membership and official league standing. Your rank and division have not been changed.' + detail + ' Refresh after the service is reachable.'));
    });
  }

  function renderCreatorMissions(parent) {
    var card = el('section', { class: 'card chl-rank-missions' });
    card.appendChild(sectionHeading('Creator Activity Missions', 'A separate creator-growth track. Mission completion does not determine competitive league rank.'));
    var content = el('div', { class: 'chl-rank-mission-content' });
    content.appendChild(ui.spinner());
    card.appendChild(content);
    parent.appendChild(card);

    var refresh = el('button', { class: 'btn', type: 'button', text: 'Refresh missions', style: 'margin-top:12px' });
    card.appendChild(refresh);

    function load() {
      if (!CHL.user) {
        content.innerHTML = '';
        content.appendChild(ui.empty('🔒', 'Sign in to view missions', 'Only your authenticated account can load its creator mission progress.', el('a', { href: '#/login', class: 'btn primary' }, 'Sign in')));
        return;
      }
      refresh.disabled = true;
      content.innerHTML = '';
      content.appendChild(ui.spinner());
      CHL.authenticatedApiRequest('/api/creator/tasks').then(function (data) {
        content.innerHTML = '';
        var task = data && data.activeTask;
        if (!task) {
          content.appendChild(ui.empty('🎯', 'No active mission returned', 'The server did not return an active creator mission. No mission has been invented locally.'));
          return;
        }
        if (data.completedTask) {
          content.appendChild(el('div', { class: 'note chl-rank-completed-note', text: 'Mission completed: ' + data.completedTask.title + '. The server has assigned the next mission.' }));
        }
        var progress = Math.max(0, Number(task.progress || 0));
        var target = Math.max(1, Number(task.target || 1));
        var percent = Math.max(0, Math.min(100, Math.round(progress / target * 100)));
        var current = el('div', { class: 'chl-rank-active-mission' }, [
          el('div', { class: 'chl-rank-active-mission-copy' }, [
            el('span', { class: 'chl-rank-kicker', text: 'CURRENT MISSION · CYCLE ' + Number(task.cycleNo || 1) }),
            el('h3', { text: task.title || 'Creator mission' }),
            el('p', { class: 'sub', text: task.description || 'Complete the action recorded by the CHL server.' })
          ]),
          el('span', { class: 'chl-rank-progress-label', text: CHL.fmt(Math.min(progress, target)) + ' / ' + CHL.fmt(target) })
        ]);
        content.appendChild(current);
        var track = el('div', { class: 'chl-rank-progress-track', role: 'progressbar', 'aria-valuemin': '0', 'aria-valuemax': String(target), 'aria-valuenow': String(Math.min(progress, target)), 'aria-label': 'Creator mission progress' });
        track.appendChild(el('div', { class: 'chl-rank-progress-fill', style: 'width:' + percent + '%' }));
        content.appendChild(track);
        content.appendChild(el('p', { class: 'sub chl-rank-progress-caption', text: percent + '% complete · Assigned ' + (task.assignedAt ? CHL.ago(task.assignedAt) : 'by the server') }));

        var history = Array.isArray(data.history) ? data.history : [];
        content.appendChild(el('h3', { class: 'chl-rank-history-title', text: 'Completed Creator Missions' }));
        if (!history.length) {
          content.appendChild(el('p', { class: 'sub', text: 'Completed missions will appear here after the server records completion.' }));
        } else {
          var list = el('div', { class: 'chl-rank-history-list' });
          history.forEach(function (item) {
            list.appendChild(el('div', { class: 'chl-rank-history-row' }, [
              el('span', { class: 'chl-rank-history-check', text: '✓', 'aria-hidden': 'true' }),
              el('div', { class: 'chl-rank-history-main' }, [
                el('strong', { text: item.title || 'Completed creator mission' }),
                el('span', { class: 'sub', text: 'Cycle ' + Number(item.cycleNo || 0) + (item.completedAt ? ' · ' + CHL.ago(item.completedAt) : '') })
              ]),
              el('span', { class: 'chl-rank-progress-label', text: CHL.fmt(Number(item.progress || item.target || 0)) + ' / ' + CHL.fmt(Number(item.target || 0)) })
            ]));
          });
          content.appendChild(list);
        }
      }).catch(function () {
        content.innerHTML = '';
        content.appendChild(ui.empty('⚠️', 'Creator missions unavailable', 'The existing creator-mission API could not return progress. Competitive rank definitions remain visible; no mission progress has been fabricated.'));
      }).finally(function () { refresh.disabled = false; });
    }

    refresh.addEventListener('click', load);
    load();
  }

  function renderAchievements(outlet) {
    outlet.appendChild(ui.pageHead('Competitive Ranks & Achievements', 'A clear competitive ladder, official team divisions, and separate creator activity missions.'));
    if (!CHL.configured) {
      outlet.appendChild(ui.setupNotice());
      return;
    }
    outlet.appendChild(makeSubnav());
    var page = el('div', { class: 'chl-rank-page' });
    outlet.appendChild(page);

    var intro = el('section', { class: 'chl-rank-intro' }, [
      el('div', { class: 'chl-rank-intro-icon', text: '🏆', 'aria-hidden': 'true' }),
      el('div', {}, [
        el('h2', { text: 'Earn rank through verified competition' }),
        el('p', { text: 'Rank tiers, team league divisions, seasons and creator missions are different systems. CHL must use recorded results—not page views, labels or fabricated progress—to award competitive rank.' })
      ])
    ]);
    page.appendChild(intro);
    renderTierLadder(page);
    renderTeamStanding(page);
    renderDivisionLadder(page);
    renderSeasons(page);
    renderCreatorMissions(page);
  }

  // Replace existing achievement route handlers without registering duplicate paths.
  CHL.routes['/creator/achievements'] = renderAchievements;
  CHL.routes['/achievements'] = renderAchievements;
})();
