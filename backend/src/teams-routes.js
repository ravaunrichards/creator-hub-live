// Creator Hub Live — authenticated team actions and server-authoritative league standings.
// This module is deliberately small: the HTTP server owns CORS, authentication,
// and error responses; this module owns route validation and database contracts.

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function routeError(fail, status, code, message) {
  throw fail(status, code, message);
}

function checkedId(value, fail, label = "Team") {
  const id = String(value || "").trim();
  if (!UUID_RE.test(id)) routeError(fail, 400, "INVALID_ID", `${label} ID is invalid.`);
  return id;
}

function limitOf(value) {
  const n = Number(value);
  return Number.isInteger(n) && n > 0 ? Math.min(n, 100) : 30;
}

function mapDbError(error, fail, operation) {
  const message = String(error?.message || "");
  if (/TEAM_NAME_TAKEN|duplicate key value/i.test(message)) {
    routeError(fail, 409, "TEAM_NAME_TAKEN", "That team name is already in use.");
  }
  if (/TEAM_NOT_FOUND|team not found/i.test(message)) {
    routeError(fail, 404, "TEAM_NOT_FOUND", "The team could not be found.");
  }
  if (/ALREADY_MEMBER/i.test(message)) {
    routeError(fail, 409, "ALREADY_TEAM_MEMBER", "You are already a member of this team.");
  }
  if (/TEAM_OWNER_CANNOT_LEAVE/i.test(message)) {
    routeError(fail, 409, "TEAM_OWNER_CANNOT_LEAVE", "Transfer team ownership before leaving this team.");
  }
  if (/TEAM_NAME_INVALID/i.test(message)) {
    routeError(fail, 400, "TEAM_NAME_INVALID", "Team names must contain 3–40 characters.");
  }
  if (/TEAM_OWNER_INVALID|TEAM_MEMBER_INVALID/i.test(message)) {
    routeError(fail, 403, "TEAM_ACCOUNT_NOT_READY", "Your Creator Hub profile is not ready for team actions. Refresh your profile or sign in again.");
  }
  if (/TEAM_MEMBERSHIP_NOT_FOUND/i.test(message)) {
    routeError(fail, 404, "TEAM_MEMBERSHIP_NOT_FOUND", "You are not a member of this team.");
  }
  const detail = error?.code ? ` (${error.code})` : "";
  routeError(fail, 503, `${operation.toUpperCase()}_UNAVAILABLE`, `The ${operation} service is temporarily unavailable${detail}.`);
}

async function loadTeam(client, teamId) {
  return client.from("teams")
    .select("id,name,logo_url,badge_url,level,points,owner_id,division_code,created_at")
    .eq("id", teamId).maybeSingle();
}

export async function handleTeamsRoute(context) {
  const {
    pathname, method, req, res, url, fail, ok, send, db,
    requireSupabaseUser, readJson,
  } = context;

  // League standings are read from the active season and computed by database
  // functions, never supplied by the client.
  if (pathname === "/api/leagues/standings" && method === "GET") {
    const client = db();
    const seasonResult = await client.from("league_seasons")
      .select("id,name,status,starts_at,ends_at")
      .eq("status", "active").order("starts_at", { ascending: false }).limit(1);
    if (seasonResult.error) mapDbError(seasonResult.error, fail, "league standings");
    const season = (seasonResult.data || [])[0] || null;
    if (!season) return ok(res, { season: null, standings: [] }) || true;

    const standingResult = await client.from("league_standings")
      .select("season_id,team_id,division_code,played,wins,draws,losses,goals_for,goals_against,points,form,position,promoted,relegated,updated_at")
      .eq("season_id", season.id)
      .order("division_code", { ascending: true })
      .order("position", { ascending: true, nullsFirst: false })
      .limit(1000);
    if (standingResult.error) mapDbError(standingResult.error, fail, "league standings");
    const rows = standingResult.data || [];
    const teamIds = [...new Set(rows.map((row) => row.team_id).filter(Boolean))];
    let teamsById = new Map();
    if (teamIds.length) {
      const teamResult = await client.from("teams")
        .select("id,name,logo_url,badge_url,level,points,division_code")
        .in("id", teamIds);
      if (teamResult.error) mapDbError(teamResult.error, fail, "league teams");
      teamsById = new Map((teamResult.data || []).map((team) => [String(team.id), team]));
    }
    const standings = rows.map((row) => ({ ...row, teams: teamsById.get(String(row.team_id)) || null }));
    return ok(res, { season, standings }) || true;
  }

  if (!(pathname === "/api/teams" || pathname.startsWith("/api/teams/"))) return false;

  if (pathname === "/api/teams" && method === "GET") {
    const client = db();
    const limit = limitOf(url.searchParams.get("limit"));
    let query = client.from("teams")
      .select("id,name,logo_url,badge_url,level,points,owner_id,division_code,created_at")
      .order("points", { ascending: false }).order("created_at", { ascending: false }).limit(limit);
    const search = String(url.searchParams.get("q") || "").trim().slice(0, 60);
    if (search) query = query.ilike("name", `%${search.replace(/[\\%_]/g, "\\$&")}%`);
    const { data, error } = await query;
    if (error) mapDbError(error, fail, "teams");
    return ok(res, { teams: data || [] }) || true;
  }

  if (pathname === "/api/teams" && method === "POST") {
    const user = await requireSupabaseUser(req);
    const body = await readJson(req);
    const name = String(body.name || "").normalize("NFC").trim().replace(/\s+/g, " ");
    if (name.length < 3 || name.length > 40) {
      routeError(fail, 400, "TEAM_NAME_INVALID", "Team names must contain 3–40 characters.");
    }
    const { data, error } = await db().rpc("create_team", { p_owner_id: user.id, p_name: name });
    if (error) mapDbError(error, fail, "team creation");
    return send(res, 201, { ok: true, team: data });
  }

  const membersMatch = pathname.match(/^\/api\/teams\/([^/]+)\/members$/);
  if (membersMatch && method === "GET") {
    const teamId = checkedId(membersMatch[1], fail);
    const client = db();
    const teamResult = await loadTeam(client, teamId);
    if (teamResult.error) mapDbError(teamResult.error, fail, "team members");
    if (!teamResult.data) routeError(fail, 404, "TEAM_NOT_FOUND", "The team could not be found.");
    const membershipResult = await client.from("team_members")
      .select("team_id,user_id,role").eq("team_id", teamId).order("role", { ascending: true });
    if (membershipResult.error) mapDbError(membershipResult.error, fail, "team members");
    const memberships = membershipResult.data || [];
    const userIds = [...new Set(memberships.map((row) => row.user_id).filter(Boolean))];
    let profilesById = new Map();
    if (userIds.length) {
      const profileResult = await client.from("profiles")
        .select("id,username,display_name,avatar_url").in("id", userIds);
      if (profileResult.error) mapDbError(profileResult.error, fail, "team profiles");
      profilesById = new Map((profileResult.data || []).map((profile) => [String(profile.id), profile]));
    }
    const members = memberships.map((membership) => ({
      ...membership,
      profile: profilesById.get(String(membership.user_id)) || null,
    }));
    return ok(res, { team: teamResult.data, members, memberCount: members.length }) || true;
  }

  const teamMatch = pathname.match(/^\/api\/teams\/([^/]+)$/);
  if (teamMatch && method === "GET") {
    const teamId = checkedId(teamMatch[1], fail);
    const { data, error } = await loadTeam(db(), teamId);
    if (error) mapDbError(error, fail, "team");
    if (!data) routeError(fail, 404, "TEAM_NOT_FOUND", "The team could not be found.");
    return ok(res, { team: data }) || true;
  }

  const joinMatch = pathname.match(/^\/api\/teams\/([^/]+)\/join$/);
  if (joinMatch && method === "POST") {
    const user = await requireSupabaseUser(req);
    const teamId = checkedId(joinMatch[1], fail);
    const { data, error } = await db().rpc("join_team", { p_user_id: user.id, p_team_id: teamId });
    if (error) mapDbError(error, fail, "team membership");
    return send(res, 201, { ok: true, membership: data });
  }

  const leaveMatch = pathname.match(/^\/api\/teams\/([^/]+)\/leave$/);
  if (leaveMatch && method === "DELETE") {
    const user = await requireSupabaseUser(req);
    const teamId = checkedId(leaveMatch[1], fail);
    const { error } = await db().rpc("leave_team", { p_user_id: user.id, p_team_id: teamId });
    if (error) mapDbError(error, fail, "team membership");
    return ok(res, { left: true }) || true;
  }

  // Do not let unsupported team paths silently return a general NOT_FOUND.
  routeError(fail, 404, "TEAM_ROUTE_NOT_FOUND", "This team action is not available.");
}
