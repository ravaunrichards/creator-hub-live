/* Creator Hub Creator Network — read-only team league standings API.
 * This is separate from creator-leagues.js, which manages creator-created leagues.
 */
export async function handleTeamLeagueRoute(ctx) {
  const { pathname, method, req, res, fail, ok, db, requireSupabaseUser, normalizeExternalError } = ctx;
  if (pathname !== '/api/leagues/standings' || method !== 'GET') return false;

  // The browser route is authenticated; the service-role client keeps standings
  // reads consistent with the server-authoritative competition tables.
  await requireSupabaseUser(req);
  const client = db();

  function lookupFailure(error, code, message, tableName) {
    const normalized = normalizeExternalError(error);
    const databaseCode = normalized.code || null;
    const missingSchema = ['PGRST205', 'PGRST204', '42P01'].includes(String(databaseCode));
    if (missingSchema) {
      throw fail(
        503,
        code,
        `The league table public.${tableName} is missing or not visible in the Supabase schema cache. Check database/diagnostics/league_schema_preflight.sql; apply the existing migration 0008_server_authoritative_leagues.sql if needed, then run NOTIFY pgrst, 'reload schema'.`,
        { databaseCode, table: `public.${tableName}`, hint: normalized.hint || undefined }
      );
    }
    throw fail(500, code, normalized.message || message, {
      databaseCode,
      details: normalized.details || undefined,
      hint: normalized.hint || undefined,
    });
  }

  const { data: season, error: seasonError } = await client
    .from('league_seasons')
    .select('id,name,status,starts_at,ends_at')
    .eq('status', 'active')
    .maybeSingle();
  if (seasonError) lookupFailure(seasonError, 'LEAGUE_SEASON_LOOKUP_FAILED', 'Could not load the active league season.', 'league_seasons');

  // An empty competition is a valid state. Never fabricate an active season or standings.
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
