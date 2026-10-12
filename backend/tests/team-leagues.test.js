import assert from 'node:assert/strict';
import { handleTeamLeagueRoute } from '../src/team-leagues.js';

function buildQuery(result) {
  const query = {
    select() { return this; },
    eq() { return this; },
    order() { return this; },
    maybeSingle() { return Promise.resolve(result); },
    then(resolve, reject) { return Promise.resolve(result).then(resolve, reject); },
  };
  return query;
}

function context(tableResults) {
  const calls = [];
  const sent = { result: null };
  return {
    calls, sent,
    ctx: {
      pathname: '/api/leagues/standings', method: 'GET', req: { headers: { authorization: 'Bearer test' } }, res: {},
      requireSupabaseUser: async () => ({ id: 'test-user' }),
      db: () => ({ from(table) { calls.push(table); return buildQuery(tableResults[table] || { data: [], error: null }); } }),
      normalizeExternalError: error => ({ message: error.message, code: error.code, details: error.details, hint: error.hint }),
      fail(status, code, message, details) { const e = new Error(message); e.status = status; e.code = code; e.details = details; throw e; },
      ok(_res, body) { sent.result = { status: 200, body: { ok: true, ...body } }; return sent.result; },
    },
  };
}

const activeSeason = { id: 'season-1', name: 'Opening Season', status: 'active' };
const actualStandings = [{ season_id: 'season-1', team_id: 'team-1', division_code: 'D5', points: 3, teams: { id: 'team-1', name: 'Existing Team' } }];

{
  const built = context({
    league_seasons: { data: activeSeason, error: null },
    league_standings: { data: actualStandings, error: null },
  });
  const handled = await handleTeamLeagueRoute(built.ctx);
  const result = built.sent.result;
  assert.equal(handled, true);
  assert.equal(result.body.season.id, 'season-1');
  assert.deepEqual(result.body.standings, actualStandings);
  assert.deepEqual(built.calls, ['league_seasons', 'league_standings']);
}

{
  const built = context({ league_seasons: { data: null, error: null } });
  const handled = await handleTeamLeagueRoute(built.ctx);
  const result = built.sent.result;
  assert.equal(handled, true);
  assert.deepEqual(result.body.standings, []);
  assert.equal(result.body.season, null);
  assert.deepEqual(built.calls, ['league_seasons']);
}

{
  const built = context({ league_seasons: { data: null, error: { code: 'PGRST205', message: "Could not find the table 'public.league_seasons' in the schema cache" } } });
  await assert.rejects(() => handleTeamLeagueRoute(built.ctx), error => {
    assert.equal(error.code, 'LEAGUE_SEASON_LOOKUP_FAILED');
    assert.equal(error.status, 503);
    assert.match(error.message, /0008_server_authoritative_leagues\.sql/);
    assert.match(error.message, /reload schema/);
    return true;
  });
}

{
  const built = context({ league_seasons: { data: activeSeason, error: null }, league_standings: { data: null, error: { code: 'PGRST205', message: 'missing table' } } });
  await assert.rejects(() => handleTeamLeagueRoute(built.ctx), error => {
    assert.equal(error.code, 'LEAGUE_STANDINGS_LOOKUP_FAILED');
    assert.equal(error.status, 503);
    return true;
  });
}

console.log('PASS — team league API active season, honest empty state, and missing-schema diagnostics');
