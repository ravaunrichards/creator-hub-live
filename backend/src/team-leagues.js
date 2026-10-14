/* Creator Hub Creator Network — team standings and admin season setup API. */
const OFFICIAL_DIVISIONS = new Set([
  'A1', 'A2', 'A3', 'B1', 'B2', 'B3', 'B4', 'B5',
  'C1', 'C2', 'C3', 'C4', 'C5', 'D1', 'D2', 'D3', 'D4', 'D5'
]);

function normalizeSeasonTimestamp(value, label, fail) {
  const raw = String(value == null ? '' : value).trim();
  const parsed = Date.parse(raw);
  if (!raw || !Number.isFinite(parsed)) {
    throw fail(400, 'INVALID_SEASON_DATES', `Enter a valid ${label} date and time.`);
  }
  return new Date(parsed).toISOString();
}

function databaseFailure(ctx, error, code, message, tableName) {
  const normalized = ctx.normalizeExternalError(error);
  const databaseCode = normalized.code || null;
  const details = {
    databaseCode,
    databaseMessage: normalized.message || undefined,
    details: normalized.details || undefined,
    hint: normalized.hint || undefined,
    table: tableName ? `public.${tableName}` : undefined,
  };
  if (['PGRST205', 'PGRST204', '42P01', '42703'].includes(String(databaseCode))) {
    const schemaHint = databaseCode === '42703' || databaseCode === 'PGRST204'
      ? 'A required database column is missing. Review the Teams/league compatibility migration and the read-only schema preflight, then reload the PostgREST schema cache.'
      : `The required table public.${tableName || 'league schema'} is missing or not visible. Review the existing league migration prerequisites, then reload the PostgREST schema cache.`;
    throw ctx.fail(503, code, `${message} ${schemaHint}`, details);
  }
  throw ctx.fail(500, code, normalized.message || message, details);
}

async function requireAdmin(ctx) {
  const user = await ctx.requireSupabaseUser(ctx.req);
  const profile = await ctx.profileFor(user);
  if (!profile || profile.is_admin !== true) {
    throw ctx.fail(403, 'ADMIN_REQUIRED', 'Only a verified Creator Hub administrator can manage league seasons.');
  }
  return user;
}

async function activeSeasonExists(ctx, client, exceptId) {
  let query = client.from('league_seasons').select('id,name').eq('status', 'active').limit(1);
  if (exceptId) query = query.neq('id', exceptId);
  const { data, error } = await query.maybeSingle();
  if (error) databaseFailure(ctx, error, 'LEAGUE_SEASON_LOOKUP_FAILED', 'Could not check for an active league season.', 'league_seasons');
  return data || null;
}

async function initializeSeasonStandings(ctx, client, seasonId) {
  const { data: teams, error: teamsError } = await client
    .from('teams').select('id,division_code');
  if (teamsError) databaseFailure(ctx, teamsError, 'LEAGUE_SEASON_INITIALIZE_FAILED', 'Could not load teams for season initialization.', 'teams');
  const { error: standingsCheckError } = await client
    .from('league_standings').select('season_id').limit(1);
  if (standingsCheckError) databaseFailure(ctx, standingsCheckError, 'LEAGUE_SEASON_INITIALIZE_FAILED', 'The league standings table is not ready.', 'league_standings');
  const { data: divisions, error: divisionsError } = await client
    .from('leagues').select('code');
  if (divisionsError) databaseFailure(ctx, divisionsError, 'LEAGUE_SEASON_INITIALIZE_FAILED', 'Could not validate the official league divisions.', 'leagues');
  const knownCodes = new Set((divisions || []).map(row => String(row.code)));
  if (!knownCodes.has('D5')) {
    throw ctx.fail(503, 'LEAGUE_DIVISIONS_NOT_CONFIGURED', 'The official D5 division is missing. Review the existing league catalog migrations before activating a season.');
  }
  const rows = (teams || []).map(team => {
    const requested = String(team.division_code || '').toUpperCase();
    const division = OFFICIAL_DIVISIONS.has(requested) && knownCodes.has(requested) ? requested : 'D5';
    return { season_id: seasonId, team_id: team.id, division_code: division };
  });
  for (let offset = 0; offset < rows.length; offset += 500) {
    const { error } = await client.from('league_standings')
      .upsert(rows.slice(offset, offset + 500), { onConflict: 'season_id,team_id' });
    if (error) databaseFailure(ctx, error, 'LEAGUE_SEASON_INITIALIZE_FAILED', 'Could not initialize team standings for this season.', 'league_standings');
  }
  return rows.length;
}

async function handleAdminSeasonRoute(ctx, routeKind, seasonId) {
  const { method, req, res, fail, ok, db, requireSupabaseUser, profileFor, readJson, normalizeExternalError } = ctx;
  await requireAdmin(ctx);
  const client = db();

  if (routeKind === 'list' && method === 'GET') {
    const { data, error } = await client.from('league_seasons')
      .select('id,name,status,starts_at,ends_at,created_at')
      .order('created_at', { ascending: false }).limit(50);
    if (error) databaseFailure(ctx, error, 'LEAGUE_SEASONS_ADMIN_LOOKUP_FAILED', 'Could not load league seasons.', 'league_seasons');
    return ok(res, { seasons: data || [] });
  }

  if (routeKind === 'create' && method === 'POST') {
    const body = await readJson(req);
    const name = String(body.name == null ? '' : body.name).trim().replace(/\s+/g, ' ');
    if (name.length < 3 || name.length > 100) {
      throw fail(400, 'INVALID_SEASON_NAME', 'Season name must be between 3 and 100 characters.');
    }
    const startsAt = normalizeSeasonTimestamp(body.starts_at, 'start', fail);
    const endsAt = normalizeSeasonTimestamp(body.ends_at, 'end', fail);
    const startMs = Date.parse(startsAt);
    const endMs = Date.parse(endsAt);
    const now = Date.now();
    if (endMs <= startMs) throw fail(400, 'INVALID_SEASON_DATES', 'The season end must be after the season start.');
    const activate = body.activate === true;
    if (activate && !(startMs <= now && now < endMs)) {
      throw fail(400, 'SEASON_OUTSIDE_ACTIVE_WINDOW', 'To activate now, the current time must be on or after the season start and before the season end. You can create it as scheduled instead.');
    }
    if (activate) {
      const active = await activeSeasonExists(ctx, client);
      if (active) throw fail(409, 'ACTIVE_SEASON_EXISTS', `Season “${active.name}” is already active. Complete or otherwise resolve that season before activating another.`);
    }
    const { data: created, error } = await client.from('league_seasons').insert({
      name, starts_at: startsAt, ends_at: endsAt, status: 'scheduled'
    }).select('id,name,status,starts_at,ends_at,created_at').single();
    if (error) databaseFailure(ctx, error, 'LEAGUE_SEASON_CREATE_FAILED', 'Could not create the league season.', 'league_seasons');

    let seededTeams = 0;
    try {
      seededTeams = await initializeSeasonStandings(ctx, client, created.id);
    } catch (errorDuringSeed) {
      // Remove only the just-created scheduled season so a failed initialisation does not leave a misleading record.
      try { await client.from('league_seasons').delete().eq('id', created.id); } catch (_) {}
      throw errorDuringSeed;
    }
    let season = created;
    if (activate) {
      const { data: activated, error: activateError } = await client.from('league_seasons')
        .update({ status: 'active' }).eq('id', created.id).eq('status', 'scheduled')
        .select('id,name,status,starts_at,ends_at,created_at').maybeSingle();
      if (activateError) {
        const normalized = normalizeExternalError(activateError);
        if (String(normalized.code) === '23505') {
          throw fail(409, 'ACTIVE_SEASON_EXISTS', 'Another season became active during this request. The new season remains scheduled.');
        }
        databaseFailure(ctx, activateError, 'LEAGUE_SEASON_ACTIVATE_FAILED', 'The season was created and initialized, but could not be activated.', 'league_seasons');
      }
      if (!activated) throw fail(409, 'LEAGUE_SEASON_STATE_CHANGED', 'The season is no longer scheduled. Refresh the season list and try again.');
      season = activated;
    }
    return ok(res, { season, seededTeams, activated: season.status === 'active' });
  }

  if (routeKind === 'activate' && method === 'POST') {
    const { data: season, error: seasonError } = await client.from('league_seasons')
      .select('id,name,status,starts_at,ends_at,created_at').eq('id', seasonId).maybeSingle();
    if (seasonError) databaseFailure(ctx, seasonError, 'LEAGUE_SEASON_LOOKUP_FAILED', 'Could not load the selected season.', 'league_seasons');
    if (!season) throw fail(404, 'LEAGUE_SEASON_NOT_FOUND', 'The selected season does not exist.');
    if (season.status === 'active') return ok(res, { season, activated: true, alreadyActive: true });
    if (season.status !== 'scheduled') throw fail(409, 'LEAGUE_SEASON_NOT_SCHEDULED', 'Only a scheduled season can be activated.');
    const starts = Date.parse(season.starts_at);
    const ends = Date.parse(season.ends_at);
    const now = Date.now();
    if (!(Number.isFinite(starts) && Number.isFinite(ends) && starts <= now && now < ends)) {
      throw fail(400, 'SEASON_OUTSIDE_ACTIVE_WINDOW', 'The current time must be on or after the season start and before its end to activate it.');
    }
    const active = await activeSeasonExists(ctx, client, seasonId);
    if (active) throw fail(409, 'ACTIVE_SEASON_EXISTS', `Season “${active.name}” is already active.`);
    const seededTeams = await initializeSeasonStandings(ctx, client, seasonId);
    const { data: activated, error: activateError } = await client.from('league_seasons')
      .update({ status: 'active' }).eq('id', seasonId).eq('status', 'scheduled')
      .select('id,name,status,starts_at,ends_at,created_at').maybeSingle();
    if (activateError) {
      const normalized = normalizeExternalError(activateError);
      if (String(normalized.code) === '23505') throw fail(409, 'ACTIVE_SEASON_EXISTS', 'Another season became active during this request.');
      databaseFailure(ctx, activateError, 'LEAGUE_SEASON_ACTIVATE_FAILED', 'Could not activate the selected season.', 'league_seasons');
    }
    if (!activated) throw fail(409, 'LEAGUE_SEASON_STATE_CHANGED', 'The selected season changed state. Refresh the list.');
    return ok(res, { season: activated, seededTeams, activated: true });
  }

  return false;
}

function roundRobinFixtures(teamIds, seasonId, divisionCode) {
  const rotation = [...teamIds].sort();
  if (rotation.length % 2 === 1) rotation.push(null);
  const rounds = [];
  const roundCount = Math.max(0, rotation.length - 1);
  for (let round = 0; round < roundCount; round += 1) {
    for (let pair = 0; pair < rotation.length / 2; pair += 1) {
      const left = rotation[pair];
      const right = rotation[rotation.length - 1 - pair];
      if (!left || !right) continue;
      const swap = (round + pair) % 2 === 1;
      rounds.push({
        season_id: seasonId,
        division_code: divisionCode,
        round_number: round + 1,
        home_team_id: swap ? right : left,
        away_team_id: swap ? left : right,
        status: 'scheduled',
      });
    }
    const fixed = rotation[0];
    const tail = rotation.slice(1);
    tail.unshift(tail.pop());
    rotation.splice(0, rotation.length, fixed, ...tail);
  }
  return rounds;
}

async function handleAdminSeasonMatches(ctx, seasonId) {
  const { res, ok, fail, db } = ctx;
  await requireAdmin(ctx);
  const client = db();
  const { data: season, error: seasonError } = await client.from('league_seasons')
    .select('id,name,status,starts_at,ends_at').eq('id', seasonId).maybeSingle();
  if (seasonError) databaseFailure(ctx, seasonError, 'LEAGUE_SEASON_LOOKUP_FAILED', 'Could not load the selected season.', 'league_seasons');
  if (!season) throw fail(404, 'LEAGUE_SEASON_NOT_FOUND', 'The selected season does not exist.');
  const { data: matches, error } = await client.from('league_matches')
    .select('id,season_id,division_code,round_number,home_team_id,away_team_id,status,home_score,away_score,played_at,created_at,home_team:teams!league_matches_home_team_id_fkey(name),away_team:teams!league_matches_away_team_id_fkey(name)')
    .eq('season_id', seasonId).order('division_code', { ascending: true })
    .order('round_number', { ascending: true }).order('created_at', { ascending: true }).limit(2000);
  if (error) databaseFailure(ctx, error, 'LEAGUE_MATCHES_LOOKUP_FAILED', 'Could not load fixtures and results for this season.', 'league_matches');
  return ok(res, { season, matches: matches || [] });
}

async function handleGenerateFixtures(ctx, seasonId) {
  const { res, ok, fail, db } = ctx;
  await requireAdmin(ctx);
  const client = db();
  const { data: season, error: seasonError } = await client.from('league_seasons')
    .select('id,name,status,starts_at,ends_at').eq('id', seasonId).maybeSingle();
  if (seasonError) databaseFailure(ctx, seasonError, 'LEAGUE_SEASON_LOOKUP_FAILED', 'Could not load the selected season.', 'league_seasons');
  if (!season) throw fail(404, 'LEAGUE_SEASON_NOT_FOUND', 'The selected season does not exist.');
  if (!['scheduled', 'active'].includes(season.status)) throw fail(409, 'LEAGUE_SEASON_CLOSED', 'Fixtures can only be generated for a scheduled or active season.');

  const { data: standings, error: standingsError } = await client.from('league_standings')
    .select('team_id,division_code').eq('season_id', seasonId).order('division_code', { ascending: true });
  if (standingsError) databaseFailure(ctx, standingsError, 'LEAGUE_STANDINGS_LOOKUP_FAILED', 'Could not load teams enrolled in the selected season.', 'league_standings');
  const { data: existing, error: existingError } = await client.from('league_matches')
    .select('division_code,round_number,home_team_id,away_team_id,status').eq('season_id', seasonId);
  if (existingError) databaseFailure(ctx, existingError, 'LEAGUE_MATCHES_LOOKUP_FAILED', 'Could not check existing fixtures before generation.', 'league_matches');

  const teamsByDivision = new Map();
  for (const row of standings || []) {
    if (!teamsByDivision.has(row.division_code)) teamsByDivision.set(row.division_code, []);
    if (!teamsByDivision.get(row.division_code).includes(row.team_id)) teamsByDivision.get(row.division_code).push(row.team_id);
  }
  const existingPairs = new Set((existing || []).map(match => {
    const teams = [String(match.home_team_id), String(match.away_team_id)].sort();
    return `${match.division_code}:${teams[0]}:${teams[1]}`;
  }));
  const planned = [];
  let skippedDivisions = 0;
  for (const [divisionCode, teamIds] of teamsByDivision.entries()) {
    if (teamIds.length < 2) { skippedDivisions += 1; continue; }
    for (const fixture of roundRobinFixtures(teamIds, seasonId, divisionCode)) {
      const teams = [fixture.home_team_id, fixture.away_team_id].sort();
      const key = `${divisionCode}:${teams[0]}:${teams[1]}`;
      if (!existingPairs.has(key)) {
        planned.push(fixture);
        existingPairs.add(key);
      }
    }
  }
  let inserted = 0;
  for (let offset = 0; offset < planned.length; offset += 300) {
    const { data, error } = await client.from('league_matches')
      .upsert(planned.slice(offset, offset + 300), {
        onConflict: 'season_id,division_code,round_number,home_team_id,away_team_id',
        ignoreDuplicates: true,
      }).select('id');
    if (error) databaseFailure(ctx, error, 'LEAGUE_FIXTURE_GENERATION_FAILED', 'Could not generate round-robin fixtures. No fictitious results were created.', 'league_matches');
    inserted += Array.isArray(data) ? data.length : 0;
  }
  return ok(res, {
    season: { id: season.id, name: season.name, status: season.status },
    fixturesCreated: inserted,
    fixturePairsPlanned: planned.length,
    divisionsWithFewerThanTwoTeams: skippedDivisions,
    idempotent: true,
  });
}

async function handleMatchResult(ctx, matchId, correction) {
  const { req, res, readJson, fail, ok, db } = ctx;
  const actor = await requireAdmin(ctx);
  const body = await readJson(req);
  const homeScore = Number(body.home_score);
  const awayScore = Number(body.away_score);
  if (!Number.isSafeInteger(homeScore) || !Number.isSafeInteger(awayScore)
      || homeScore < 0 || awayScore < 0 || homeScore > 100 || awayScore > 100) {
    throw fail(400, 'INVALID_MATCH_SCORE', 'Enter whole-number scores from 0 to 100 for both teams.');
  }
  const rpcName = correction ? 'correct_league_match_result' : 'record_league_match_result';
  const { data, error } = await db().rpc(rpcName, {
    p_match: matchId,
    p_home_score: homeScore,
    p_away_score: awayScore,
    p_actor: actor.id,
  });
  if (error) {
    const normalized = ctx.normalizeExternalError(error);
    const message = String(normalized.message || 'Could not record match result.');
    if (message.includes('INVALID_SCORE')) throw fail(400, 'INVALID_MATCH_SCORE', 'Scores must be non-negative whole numbers.');
    if (message.includes('RESULT_ALREADY_FINAL')) throw fail(409, 'RESULT_ALREADY_FINAL', 'This fixture already has a final result. Use the correction action to change it.');
    if (message.includes('INVALID_MATCH')) throw fail(404, 'LEAGUE_MATCH_NOT_FOUND', 'The fixture was not found or its teams are not enrolled.');
    databaseFailure(ctx, error, correction ? 'LEAGUE_RESULT_CORRECTION_FAILED' : 'LEAGUE_RESULT_RECORD_FAILED', 'Could not record the match result.', 'league_matches');
  }
  const match = Array.isArray(data) ? data[0] : data;
  if (!match || !match.id) throw fail(500, 'LEAGUE_RESULT_UNCONFIRMED', 'The database did not confirm the saved result.');
  return ok(res, { match, corrected: !!correction });
}

async function handleCancelMatch(ctx, matchId) {
  const { req, res, fail, ok, db } = ctx;
  const actor = await requireAdmin(ctx);
  const { data, error } = await db().rpc('cancel_league_match', { p_match: matchId, p_actor: actor.id });
  if (error) {
    const normalized = ctx.normalizeExternalError(error);
    const message = String(normalized.message || 'Could not cancel fixture.');
    if (message.includes('INVALID_MATCH')) throw fail(404, 'LEAGUE_MATCH_NOT_FOUND', 'The fixture was not found.');
    if (message.includes('MATCH_NOT_CANCELLABLE')) throw fail(409, 'MATCH_NOT_CANCELLABLE', 'Only a scheduled fixture can be cancelled.');
    databaseFailure(ctx, error, 'LEAGUE_MATCH_CANCEL_FAILED', 'Could not cancel the fixture.', 'league_matches');
  }
  const match = Array.isArray(data) ? data[0] : data;
  if (!match || !match.id) throw fail(500, 'LEAGUE_MATCH_CANCEL_UNCONFIRMED', 'The database did not confirm fixture cancellation.');
  return ok(res, { match, cancelled: true });
}

async function handleFinalizeSeason(ctx, seasonId) {
  const { res, fail, ok, db } = ctx;
  await requireAdmin(ctx);
  const client = db();
  const { data: season, error: seasonError } = await client.from('league_seasons')
    .select('id,name,status,starts_at,ends_at').eq('id', seasonId).maybeSingle();
  if (seasonError) databaseFailure(ctx, seasonError, 'LEAGUE_SEASON_LOOKUP_FAILED', 'Could not load the selected season.', 'league_seasons');
  if (!season) throw fail(404, 'LEAGUE_SEASON_NOT_FOUND', 'The selected season does not exist.');
  if (season.status !== 'active') throw fail(409, 'LEAGUE_SEASON_NOT_ACTIVE', 'Only the active season can be finalized.');
  if (Date.parse(season.ends_at) > Date.now()) throw fail(409, 'SEASON_NOT_ENDED', 'The configured season end date/time has not passed.');

  const { data: standings, error: standingsError } = await client.from('league_standings')
    .select('team_id,division_code,played').eq('season_id', seasonId);
  if (standingsError) databaseFailure(ctx, standingsError, 'LEAGUE_STANDINGS_LOOKUP_FAILED', 'Could not validate season standings before finalization.', 'league_standings');
  const groups = new Map();
  for (const row of standings || []) {
    if (!groups.has(row.division_code)) groups.set(row.division_code, []);
    groups.get(row.division_code).push(row);
  }
  const teamsNeedingResults = [...groups.entries()].filter(([, rows]) => rows.length >= 2)
    .flatMap(([division, rows]) => rows.filter(row => Number(row.played || 0) < 1).map(row => ({ team_id: row.team_id, division_code: division })));
  if (teamsNeedingResults.length) {
    throw fail(409, 'LEAGUE_RESULTS_REQUIRED', 'Every team in a division with at least two teams must have at least one completed match before finalization.', { teamsWithoutResults: teamsNeedingResults.length });
  }
  const { data: matches, error: matchesError } = await client.from('league_matches')
    .select('id,status').eq('season_id', seasonId);
  if (matchesError) databaseFailure(ctx, matchesError, 'LEAGUE_MATCHES_LOOKUP_FAILED', 'Could not validate fixtures before finalization.', 'league_matches');
  const unfinished = (matches || []).filter(match => ['scheduled', 'live'].includes(String(match.status)));
  if (unfinished.length) throw fail(409, 'LEAGUE_FIXTURES_UNFINISHED', 'Complete or cancel all scheduled/live fixtures before finalizing the season.', { unfinishedFixtures: unfinished.length });

  const { error } = await client.rpc('finalize_league_season', { p_season: seasonId });
  if (error) {
    const normalized = ctx.normalizeExternalError(error);
    const message = String(normalized.message || 'Could not finalize the season.');
    if (message.includes('SEASON_NOT_ENDED')) throw fail(409, 'SEASON_NOT_ENDED', 'The configured season end date/time has not passed.');
    if (message.includes('SEASON_NOT_ACTIVE')) throw fail(409, 'LEAGUE_SEASON_NOT_ACTIVE', 'Only the active season can be finalized.');
    databaseFailure(ctx, error, 'LEAGUE_SEASON_FINALIZE_FAILED', 'Could not finalize the season or apply its official promotion/relegation results.', 'league_seasons');
  }
  return ok(res, { finalized: true, seasonId, promotionRelegationApplied: true });
}

export async function handleTeamLeagueRoute(ctx) {
  const { pathname, method, req, res, fail, ok, db, requireSupabaseUser, normalizeExternalError, url } = ctx;
  const activateMatch = pathname.match(/^\/api\/admin\/leagues\/seasons\/([0-9a-f-]{36})\/activate$/i);
  if (pathname === '/api/admin/leagues/seasons') {
    const routeKind = method === 'GET' ? 'list' : method === 'POST' ? 'create' : null;
    if (!routeKind) return false;
    return handleAdminSeasonRoute(ctx, routeKind, null);
  }
  if (activateMatch) return handleAdminSeasonRoute(ctx, 'activate', activateMatch[1]);

  const seasonMatches = pathname.match(/^\/api\/admin\/leagues\/seasons\/([0-9a-f-]{36})\/matches$/i);
  if (seasonMatches && method === 'GET') return handleAdminSeasonMatches(ctx, seasonMatches[1]);
  const generateFixtures = pathname.match(/^\/api\/admin\/leagues\/seasons\/([0-9a-f-]{36})\/fixtures\/generate$/i);
  if (generateFixtures && method === 'POST') return handleGenerateFixtures(ctx, generateFixtures[1]);
  const finalizeSeason = pathname.match(/^\/api\/admin\/leagues\/seasons\/([0-9a-f-]{36})\/finalize$/i);
  if (finalizeSeason && method === 'POST') return handleFinalizeSeason(ctx, finalizeSeason[1]);
  const matchResult = pathname.match(/^\/api\/admin\/leagues\/matches\/([0-9a-f-]{36})\/(result|correct)$/i);
  if (matchResult && method === 'POST') return handleMatchResult(ctx, matchResult[1], matchResult[2] === 'correct');
  const matchCancel = pathname.match(/^\/api\/admin\/leagues\/matches\/([0-9a-f-]{36})\/cancel$/i);
  if (matchCancel && method === 'POST') return handleCancelMatch(ctx, matchCancel[1]);

  if (!['/api/leagues/standings','/api/leagues/matches'].includes(pathname) || method !== 'GET') return false;

  // The browser route is authenticated; the service-role client keeps standings
  // reads consistent with the server-authoritative competition tables.
  await requireSupabaseUser(req);
  const client = db();

  function lookupFailure(error, code, message, tableName) {
    const normalized = normalizeExternalError(error);
    const databaseCode = normalized.code || null;
    const missingSchema = ['PGRST205', 'PGRST204', '42P01', '42703'].includes(String(databaseCode));
    if (missingSchema) {
      const cause = databaseCode === '42703' || databaseCode === 'PGRST204'
        ? 'A required column is missing. Review the league migration and schema preflight before applying further changes.'
        : `The league table public.${tableName} is missing or not visible in the Supabase schema cache. Check database/diagnostics/league_schema_preflight.sql; review the existing migration 0008_server_authoritative_leagues.sql if needed, then run NOTIFY pgrst, 'reload schema'.`;
      throw fail(503, code, `${cause} ${normalized.message || ''}`.trim(), {
        databaseCode, databaseMessage: normalized.message || undefined,
        table: `public.${tableName}`, details: normalized.details || undefined,
        hint: normalized.hint || undefined,
      });
    }
    throw fail(500, code, normalized.message || message, {
      databaseCode, databaseMessage: normalized.message || undefined,
      details: normalized.details || undefined, hint: normalized.hint || undefined,
    });
  }

  const { data: season, error: seasonError } = await client
    .from('league_seasons')
    .select('id,name,status,starts_at,ends_at')
    .eq('status', 'active')
    .maybeSingle();
  if (seasonError) lookupFailure(seasonError, 'LEAGUE_SEASON_LOOKUP_FAILED', 'Could not load the active league season.', 'league_seasons');

  // A missing season is reported honestly; the authenticated admin UI now provides season creation/activation.
  if (!season) {
    if (pathname === '/api/leagues/matches') ok(res, { season: null, matches: [] });
    else ok(res, { season: null, standings: [] });
    return true;
  }

  if (pathname === '/api/leagues/matches') {
    const requestedDivision = String(url && url.searchParams && url.searchParams.get('division') || '').trim().toUpperCase();
    if (requestedDivision && !OFFICIAL_DIVISIONS.has(requestedDivision)) throw fail(400, 'INVALID_DIVISION', 'Choose one of the official divisions A1–A3, B1–B5, C1–C5 or D1–D5.');
    let matchQuery = client.from('league_matches')
      .select('id,season_id,division_code,round_number,home_team_id,away_team_id,status,home_score,away_score,played_at,created_at,home_team:teams!league_matches_home_team_id_fkey(name),away_team:teams!league_matches_away_team_id_fkey(name)')
      .eq('season_id', season.id).order('division_code', { ascending: true })
      .order('round_number', { ascending: true }).order('created_at', { ascending: true }).limit(2000);
    if (requestedDivision) matchQuery = matchQuery.eq('division_code', requestedDivision);
    const { data: matches, error: matchesError } = await matchQuery;
    if (matchesError) lookupFailure(matchesError, 'LEAGUE_MATCHES_LOOKUP_FAILED', 'Could not load league fixtures and results.', 'league_matches');
    ok(res, { season, matches: matches || [] });
    return true;
  }

  const { data: standings, error: standingsError } = await client
    .from('league_standings')
    .select('season_id,team_id,division_code,played,wins,draws,losses,goals_for,goals_against,points,form,position,promoted,relegated,teams(id,name,logo_url,badge_url)')
    .eq('season_id', season.id)
    .order('position', { ascending: true, nullsFirst: false })
    .order('points', { ascending: false })
    .order('team_id', { ascending: true });
  if (standingsError) lookupFailure(standingsError, 'LEAGUE_STANDINGS_LOOKUP_FAILED', 'Could not load league standings.', 'league_standings');

  ok(res, { season, standings: standings || [] });
  return true;
}
