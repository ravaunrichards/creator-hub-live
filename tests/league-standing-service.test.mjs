import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { handleTeamsRoute } from '../backend/src/teams-routes.js';

function fakeDb({ memberships = [], season = null, standings = [], teams = [], errors = {} } = {}) {
  return {
    from(table) {
      const state = { table, filters: {}, columns: '' };
      const builder = {
        select(columns) { state.columns = columns; return builder; },
        eq(key, value) { state.filters[key] = value; return builder; },
        in(key, values) { state.filters[key] = values; return builder; },
        order() { return builder; },
        limit() { return builder; },
        ilike() { return builder; },
        then(resolve, reject) {
          if (errors[table]) return Promise.resolve({ data: null, error: errors[table] }).then(resolve, reject);
          let data = [];
          if (table === 'team_members') data = memberships.filter(m => !state.filters.user_id || m.user_id === state.filters.user_id);
          if (table === 'league_seasons') data = season && state.filters.status === 'active' ? [season] : [];
          if (table === 'league_standings') data = standings.filter(s => !state.filters.season_id || s.season_id === state.filters.season_id);
          if (table === 'teams') data = teams.filter(t => !state.filters.id || t.id === state.filters.id || (Array.isArray(state.filters.id) && state.filters.id.includes(t.id)) || (Array.isArray(state.filters.id) && state.filters.id.includes(t.id)));
          return Promise.resolve({ data, error: null }).then(resolve, reject);
        }
      };
      return builder;
    }
  };
}

async function call(ctx, path = '/api/leagues/my-standing') {
  const response = { status: 200, body: null };
  const context = {
    pathname: path, method: 'GET', req: {}, res: response,
    fail(status, code, message, details) { const e = new Error(message); Object.assign(e, { status, code, details }); return e; },
    ok(_res, body) { response.body = { ok: true, ...body }; return true; },
    send(_res, status, body) { response.status = status; response.body = body; return true; },
    db: () => ctx.db,
    requireSupabaseUser: async () => ({ id: 'user-1' }),
    readJson: async () => ({})
  };
  await handleTeamsRoute(context);
  return response;
}

const season = { id: 'season-1', name: 'Opening Season', status: 'active', starts_at: '2026-01-01T00:00:00Z', ends_at: '2027-01-01T00:00:00Z' };
const member = { team_id: 'team-1', user_id: 'user-1', role: 'owner' };
const row = { season_id: 'season-1', team_id: 'team-1', division_code: 'D5', position: 1, points: 0 };
const team = { id: 'team-1', name: 'Verified Team', division_code: 'D5' };

let result = await call({ db: fakeDb({ memberships: [member] }) });
assert.equal(result.body.season, null, 'missing active season must be a normal, explicit state');
assert.equal(result.body.memberships.length, 1);
assert.deepEqual(result.body.standings, []);

result = await call({ db: fakeDb({ memberships: [member], season, standings: [row], teams: [team] }) });
assert.equal(result.body.season.id, 'season-1');
assert.equal(result.body.standings.length, 1);
assert.equal(result.body.standings[0].teams.name, 'Verified Team');

result = await call({ db: fakeDb({ memberships: [], season, standings: [row], teams: [team] }) });
assert.deepEqual(result.body.standings, [], 'another account’s standings must not be returned as the caller’s');

await assert.rejects(
  () => call({ db: fakeDb({ errors: { team_members: { code: 'PGRST205', message: 'table missing from schema cache' } } }) }),
  error => error.code === 'TEAM_MEMBERSHIP_UNAVAILABLE' && error.status === 503
);

const page = await readFile(new URL('../frontend/src/chl-rank-achievements.js', import.meta.url), 'utf8');
assert.ok(page.includes("CHL.authenticatedApiRequest('/api/leagues/my-standing')"));
assert.ok(!page.includes("sb.from('team_members')"), 'standing page must not query team_members directly from the browser');
assert.ok(page.includes('No active league season'));
console.log('League standing service tests passed (4 route cases + frontend contract).');
