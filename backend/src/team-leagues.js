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

export async function handleTeamLeagueRoute(ctx) {
  const { pathname, method, req, res, fail, ok, db, requireSupabaseUser, normalizeExternalError } = ctx;
  const activateMatch = pathname.match(/^\/api\/admin\/leagues\/seasons\/([0-9a-f-]{36})\/activate$/i);
  if (pathname === '/api/admin/leagues/seasons') {
    const routeKind = method === 'GET' ? 'list' : method === 'POST' ? 'create' : null;
    if (!routeKind) return false;
    return handleAdminSeasonRoute(ctx, routeKind, null);
  }
  if (activateMatch) return handleAdminSeasonRoute(ctx, 'activate', activateMatch[1]);
  if (pathname !== '/api/leagues/standings' || method !== 'GET') return false;

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
  if (!season) { ok(res, { season: null, standings: [] }); return true; }

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
