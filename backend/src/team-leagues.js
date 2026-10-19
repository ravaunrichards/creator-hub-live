/* Creator Hub Live — server-authoritative league reads. Results are never client-written. */
export async function handleTeamLeagueRoute(ctx) {
  const { pathname, method, req, url, fail, ok, db, requireSupabaseUser } = ctx;
  if (!pathname.startsWith('/api/leagues/')) return false;
  if (method !== 'GET') throw fail(405, 'METHOD_NOT_ALLOWED', 'League results are read-only through this endpoint.');

  // The rank/achievement page calls this endpoint to verify membership and the
  // official standing together. Without this explicit route the request fell
  // through to the generic NOT_FOUND handler.
  if (pathname === '/api/leagues/my-standing') {
    const user = await requireSupabaseUser(req);
    const client = db();
    const { data: memberRows, error: membershipError } = await client
      .from('team_members')
      .select('team_id,role,joined_at')
      .eq('user_id', user.id)
      .order('joined_at', { ascending: true });
    if (membershipError) throw fail(503, 'TEAM_MEMBERSHIP_LOOKUP_FAILED', 'CHL could not verify your team membership.', { cause: membershipError.code || null });

    const memberships = memberRows || [];
    const teamIds = [...new Set(memberships.map((row) => row.team_id).filter(Boolean))];
    if (!teamIds.length) return ok(ctx.res, { memberships: [], season: null, standings: [] });

    const { data: teams, error: teamsError } = await client
      .from('teams')
      .select('id,name,logo_url,level,points,division_code,owner_id')
      .in('id', teamIds);
    if (teamsError) throw fail(503, 'TEAM_MEMBERSHIP_LOOKUP_FAILED', 'CHL could not verify your team membership.', { cause: teamsError.code || null });
    const teamsById = new Map((teams || []).map((team) => [String(team.id), team]));
    const verifiedMemberships = memberships
      .filter((row) => teamsById.has(String(row.team_id)))
      .map((row) => ({ ...row, team: teamsById.get(String(row.team_id)) }));
    if (!verifiedMemberships.length) return ok(ctx.res, { memberships: [], season: null, standings: [] });

    const { data: season, error: seasonError } = await client
      .from('league_seasons')
      .select('id,name,status,starts_at,ends_at')
      .eq('status', 'active')
      .order('starts_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (seasonError) throw fail(503, 'LEAGUE_SEASON_LOOKUP_FAILED', 'CHL could not verify the active league season.', { cause: seasonError.code || null });
    if (!season) return ok(ctx.res, { memberships: verifiedMemberships, season: null, standings: [] });

    const { data: standingRows, error: standingsError } = await client
      .from('league_standings')
      .select('season_id,team_id,division_code,played,wins,draws,losses,goals_for,goals_against,points,form,position,promoted,relegated,updated_at')
      .eq('season_id', season.id)
      .in('team_id', verifiedMemberships.map((row) => row.team_id))
      .order('division_code', { ascending: true })
      .order('position', { ascending: true, nullsFirst: false });
    if (standingsError) throw fail(503, 'LEAGUE_STANDINGS_LOOKUP_FAILED', 'CHL could not verify the official league standing.', { cause: standingsError.code || null });
    const standings = (standingRows || []).map((row) => ({ ...row, teams: teamsById.get(String(row.team_id)) || null }));
    return ok(ctx.res, { memberships: verifiedMemberships, season, standings });
  }

  const client = db();
  if (pathname === '/api/leagues/seasons') {
    const { data, error } = await client.from('league_seasons').select('id,name,status,starts_at,ends_at').order('starts_at', { ascending: false }).limit(24);
    if (error) throw error;
    return ok(ctx.res, { seasons: data || [] });
  }
  if (pathname === '/api/leagues/standings') {
    const requestedSeason = String(url.searchParams.get('seasonId') || '').trim();
    let seasonQuery = client.from('league_seasons').select('id,name,status,starts_at,ends_at');
    if (requestedSeason) seasonQuery = seasonQuery.eq('id', requestedSeason);
    else seasonQuery = seasonQuery.eq('status', 'active');
    const { data: season, error: seasonError } = await seasonQuery.order('starts_at', { ascending: false }).limit(1).maybeSingle();
    if (seasonError) throw seasonError;
    if (!season) return ok(ctx.res, { season: null, standings: [] });
    const division = String(url.searchParams.get('division') || '').trim().toUpperCase();
    let query = client.from('league_standings').select('season_id,team_id,division_code,played,wins,draws,losses,goals_for,goals_against,points,form,position,promoted,relegated,updated_at').eq('season_id', season.id);
    if (division) query = query.eq('division_code', division);
    const { data: rows, error } = await query.order('division_code', { ascending: true }).order('position', { ascending: true, nullsFirst: false }).order('points', { ascending: false }).limit(500);
    if (error) throw error;
    const ids = (rows || []).map((row) => row.team_id);
    const { data: teams, error: teamError } = ids.length ? await client.from('teams').select('id,name,logo_url,level,points,division_code').in('id', ids) : { data: [], error: null };
    if (teamError) throw teamError;
    const map = new Map((teams || []).map((team) => [String(team.id), team]));
    const standings = (rows || []).map((row) => ({ ...row, teams: map.get(String(row.team_id)) || null }));
    return ok(ctx.res, { season, standings });
  }
  if (pathname === '/api/leagues/matches') {
    const seasonId = String(url.searchParams.get('seasonId') || '').trim();
    let query = client.from('league_matches').select('id,season_id,division_code,home_team_id,away_team_id,status,home_score,away_score,played_at,created_at').order('created_at', { ascending: false }).limit(100);
    if (seasonId) query = query.eq('season_id', seasonId);
    const { data: matches, error } = await query;
    if (error) throw error;
    const ids = Array.from(new Set((matches || []).flatMap((match) => [match.home_team_id, match.away_team_id])));
    const { data: teams, error: teamError } = ids.length ? await client.from('teams').select('id,name,logo_url,division_code').in('id', ids) : { data: [], error: null };
    if (teamError) throw teamError;
    const map = new Map((teams || []).map((team) => [String(team.id), team]));
    return ok(ctx.res, { matches: (matches || []).map((match) => ({ ...match, home_team: map.get(String(match.home_team_id)) || null, away_team: map.get(String(match.away_team_id)) || null })) });
  }
  return false;
}
