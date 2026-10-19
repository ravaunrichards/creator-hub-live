import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { handleTeamLeagueRoute } from '../src/team-leagues.js';

const routeSource = readFileSync(new URL('../src/team-leagues.js', import.meta.url), 'utf8');
const serverSource = readFileSync(new URL('../src/server.js', import.meta.url), 'utf8');
const pageSource = readFileSync(new URL('../../frontend/src/chl-rank-achievements.js', import.meta.url), 'utf8');

function makeContext(fixtures = {}) {
  const calls = [];
  const client = {
    from(table) {
      const query = {
        select() { return query; },
        eq() { return query; },
        in() { return query; },
        order() { return query; },
        limit() { return query; },
        maybeSingle() {
          calls.push(table);
          const rows = fixtures[table] || [];
          return Promise.resolve({ data: Array.isArray(rows) ? (rows[0] || null) : rows, error: null });
        },
        then(resolve, reject) {
          calls.push(table);
          const rows = fixtures[table] || [];
          return Promise.resolve({ data: Array.isArray(rows) ? rows : [rows], error: null }).then(resolve, reject);
        }
      };
      return query;
    }
  };
  let response = null;
  return {
    calls,
    get response() { return response; },
    ctx: {
      pathname: '/api/leagues/my-standing',
      method: 'GET',
      req: { headers: {} },
      url: new URL('https://chl.invalid/api/leagues/my-standing'),
      res: {},
      fail: (status, code, message) => Object.assign(new Error(message), { status, code }),
      ok: (_res, body) => { response = body; return body; },
      db: () => client,
      requireSupabaseUser: async () => ({ id: '123e4567-e89b-42d3-a456-426614174001' })
    }
  };
}

test('frontend uses the authenticated server-owned standing endpoint', () => {
  assert.match(serverSource, /handleTeamLeagueRoute/);
  assert.match(routeSource, /pathname === '\/api\/leagues\/my-standing'/);
  assert.match(routeSource, /await requireSupabaseUser\(req\)/);
  assert.match(routeSource, /\.from\('team_members'\)/);
  assert.match(routeSource, /\.from\('league_seasons'\)/);
  assert.match(routeSource, /\.from\('league_standings'\)/);
  assert.match(routeSource, /memberships: verifiedMemberships, season, standings/);
  assert.match(pageSource, /authenticatedApiRequest\('\/api\/leagues\/my-standing'\)/);
  assert.match(pageSource, /standingsData\.memberships/);
  assert.doesNotMatch(pageSource, /sb\.from\('team_members'\)/);
});

test('no membership returns a real empty state without attempting a season lookup', async () => {
  const mock = makeContext({ team_members: [] });
  await handleTeamLeagueRoute(mock.ctx);
  assert.deepEqual(mock.response, { memberships: [], season: null, standings: [] });
  assert.deepEqual(mock.calls, ['team_members']);
});

test('verified membership with no active season is returned without inventing standings', async () => {
  const mock = makeContext({
    team_members: [{ team_id: 'team-1', role: 'member', joined_at: '2026-10-01T00:00:00Z' }],
    teams: [{ id: 'team-1', name: 'Real Team', division_code: 'D5', owner_id: 'user-1' }],
    league_seasons: []
  });
  await handleTeamLeagueRoute(mock.ctx);
  assert.equal(mock.response.memberships.length, 1);
  assert.equal(mock.response.memberships[0].team.name, 'Real Team');
  assert.equal(mock.response.season, null);
  assert.deepEqual(mock.response.standings, []);
  assert.ok(mock.calls.includes('league_seasons'));
  assert.ok(!mock.calls.includes('league_standings'));
});

test('active season returns only the signed-in member team’s official standing rows', async () => {
  const mock = makeContext({
    team_members: [{ team_id: 'team-1', role: 'member', joined_at: '2026-10-01T00:00:00Z' }],
    teams: [{ id: 'team-1', name: 'Real Team', division_code: 'D5', owner_id: 'user-1' }],
    league_seasons: [{ id: 'season-1', name: 'Opening Season', status: 'active', starts_at: '2026-10-01T00:00:00Z', ends_at: '2026-10-31T23:59:59Z' }],
    league_standings: [{ season_id: 'season-1', team_id: 'team-1', division_code: 'D5', played: 0, wins: 0, draws: 0, losses: 0, goals_for: 0, goals_against: 0, points: 0, position: 1 }]
  });
  await handleTeamLeagueRoute(mock.ctx);
  assert.equal(mock.response.season.id, 'season-1');
  assert.equal(mock.response.standings.length, 1);
  assert.equal(mock.response.standings[0].team_id, 'team-1');
  assert.equal(mock.response.standings[0].teams.name, 'Real Team');
});
