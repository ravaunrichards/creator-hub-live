/* Creator Hub Creator Network — Teams API route module.
 * Called by backend/src/server.js before the existing route branches.
 * All writes are authenticated and performed server-side with the service role.
 */
export async function handleTeamsRoute(ctx) {
  const { pathname, method, req, res, url, fail, ok, db, requireSupabaseUser, readJson, normalizeExternalError } = ctx;
  const root = pathname === "/api/teams";
  const match = pathname.match(/^\/api\/teams\/([0-9a-f-]{36})(?:\/(join|leave|members\/([0-9a-f-]{36})))?$/i);
  if (!root && !match) return false;

  const client = db();
  const normalizeDbFailure = (error, code, message, tableName) => {
    const n = normalizeExternalError(error);
    if (["PGRST205", "PGRST204", "42P01"].includes(String(n.code)) && tableName) {
      throw fail(503, code, `Teams data table public.${tableName} is missing or not visible in the Supabase schema cache. Check database/diagnostics/league_schema_preflight.sql and review the existing Teams migrations 0004_live_social_systems.sql and 0015_teams_backend_complete.sql before applying anything. Then run NOTIFY pgrst, 'reload schema'.`, { databaseCode: n.code, table: `public.${tableName}` });
    }
    if (["PGRST202", "42883"].includes(String(n.code)) && code === "TEAM_CREATE_FAILED") {
      throw fail(503, code, "The team-creation database function is missing or not visible. Review database/migrations/0015_teams_backend_complete.sql and confirm its prerequisites before applying it.", { databaseCode: n.code, function: "public.create_team_for_user" });
    }
    if (n.code === "23505") throw fail(409, "TEAM_CONFLICT", "That team name or membership already exists.");
    if (n.code === "P0001" || n.code === "23514") {
      const text = String(n.message || "").toLowerCase();
      if (text.includes("not found")) throw fail(404, "TEAM_NOT_FOUND", "Team not found.");
      if (text.includes("full")) throw fail(409, "TEAM_FULL", "This team has reached its member limit.");
      if (text.includes("recruit")) throw fail(409, "TEAM_NOT_RECRUITING", "This team is not accepting members.");
      if (text.includes("already a member")) throw fail(409, "ALREADY_TEAM_MEMBER", "You are already a member of this team.");
      throw fail(400, code, n.message || message, { databaseCode: n.code });
    }
    throw fail(500, code, message, { databaseCode: n.code, details: n.details });
  };
  const validName = value => {
    const name = String(value || "").trim().replace(/\s+/g, " ");
    if (name.length < 3 || name.length > 48) throw fail(400, "INVALID_TEAM_NAME", "Team name must be 3–48 characters.");
    if (!/^[\p{L}\p{N} ._'&-]+$/u.test(name)) throw fail(400, "INVALID_TEAM_NAME", "Team name contains unsupported characters.");
    return name;
  };
  const optionalText = (value, max, label) => {
    const v = String(value == null ? "" : value).trim();
    if (v.length > max) throw fail(400, "INVALID_INPUT", `${label} must be ${max} characters or fewer.`);
    return v || null;
  };
  const validImageUrl = (value, label) => {
    const v = optionalText(value, 1000, label);
    if (!v) return null;
    let parsed;
    try { parsed = new URL(v); } catch { throw fail(400, "INVALID_IMAGE_URL", `${label} must be a valid HTTPS URL.`); }
    if (parsed.protocol !== "https:") throw fail(400, "INVALID_IMAGE_URL", `${label} must use HTTPS.`);
    return parsed.toString();
  };
  const readTeam = async id => {
    const { data, error } = await client.from("teams")
      .select("id,name,description,parish,logo_url,badge_url,level,points,division_code,owner_id,max_members,recruiting,created_at,updated_at")
      .eq("id", id).maybeSingle();
    if (error) normalizeDbFailure(error, "TEAM_LOOKUP_FAILED", "Could not load team.", "teams");
    if (!data) throw fail(404, "TEAM_NOT_FOUND", "Team not found.");
    return data;
  };

  if (root && method === "GET") {
    const limitRaw = Number(url.searchParams.get("limit"));
    const limit = Number.isFinite(limitRaw) && limitRaw > 0 ? Math.min(Math.floor(limitRaw), 50) : 30;
    let query = client.from("teams")
      .select("id,name,description,parish,logo_url,badge_url,level,points,division_code,owner_id,max_members,recruiting,created_at,updated_at")
      .order("points", { ascending: false }).order("created_at", { ascending: false }).limit(limit);
    const search = String(url.searchParams.get("q") || "").trim().slice(0, 48);
    if (search) query = query.ilike("name", `%${search.replace(/[%_,]/g, " ")}%`);
    const { data, error } = await query;
    if (error) normalizeDbFailure(error, "TEAMS_LOOKUP_FAILED", "Could not load teams.", "teams");
    const teams = data || [];
    const ids = teams.map(t => t.id);
    const counts = Object.create(null);
    if (ids.length) {
      const { data: members, error: membersError } = await client.from("team_members").select("team_id").in("team_id", ids);
      if (membersError) normalizeDbFailure(membersError, "TEAM_MEMBERS_LOOKUP_FAILED", "Could not load team member counts.", "team_members");
      for (const m of members || []) counts[m.team_id] = (counts[m.team_id] || 0) + 1;
    }
    return ok(res, { teams: teams.map(t => ({ ...t, member_count: counts[t.id] || 0 })) });
  }

  if (root && method === "POST") {
    const user = await requireSupabaseUser(req);
    const body = await readJson(req);
    const name = validName(body.name);
    const description = optionalText(body.description, 1000, "Description") || "";
    const parish = optionalText(body.parish, 60, "Parish");
    const logoUrl = validImageUrl(body.logo_url, "Logo URL");
    const badgeUrl = validImageUrl(body.badge_url, "Badge URL");
    const maxMembers = body.max_members == null || body.max_members === "" ? 20 : Number(body.max_members);
    if (!Number.isInteger(maxMembers) || maxMembers < 2 || maxMembers > 500) throw fail(400, "INVALID_MEMBER_LIMIT", "Maximum members must be a whole number from 2 to 500.");
    const { data, error } = await client.rpc("create_team_for_user", {
      p_user_id: user.id, p_name: name, p_description: description,
      p_parish: parish, p_logo_url: logoUrl, p_badge_url: badgeUrl, p_max_members: maxMembers
    });
    if (error) normalizeDbFailure(error, "TEAM_CREATE_FAILED", "Could not create team.");
    const team = Array.isArray(data) ? data[0] : data;
    if (!team?.id) throw fail(500, "TEAM_CREATE_FAILED", "The database did not return the created team.");
    return ok(res, { team });
  }

  const id = match?.[1];
  const action = match?.[2] || "";
  const memberId = match?.[3] || "";
  if (id && !action && method === "GET") {
    const team = await readTeam(id);
    const { data: memberRows, error: memberError } = await client.from("team_members")
      .select("team_id,user_id,role,joined_at").eq("team_id", id).order("joined_at", { ascending: true });
    if (memberError) normalizeDbFailure(memberError, "TEAM_MEMBERS_LOOKUP_FAILED", "Could not load team members.", "team_members");
    const rows = memberRows || [];
    const userIds = [...new Set(rows.map(m => m.user_id).filter(Boolean))];
    let profiles = [];
    if (userIds.length) {
      const { data, error } = await client.from("profiles").select("id,username,display_name").in("id", userIds);
      if (error) normalizeDbFailure(error, "TEAM_PROFILES_LOOKUP_FAILED", "Could not load team member profiles.");
      profiles = data || [];
    }
    const byId = new Map(profiles.map(p => [String(p.id), p]));
    let currentUserId = null;
    if (String(req.headers.authorization || "").startsWith("Bearer ")) currentUserId = (await requireSupabaseUser(req)).id;
    return ok(res, {
      team,
      members: rows.map(m => ({ ...m, profile: byId.get(String(m.user_id)) || null })),
      member_count: rows.length,
      is_member: currentUserId ? rows.some(m => String(m.user_id) === String(currentUserId)) : false,
      is_owner: currentUserId ? String(team.owner_id) === String(currentUserId) : false
    });
  }

  if (id && action === "join" && method === "POST") {
    const user = await requireSupabaseUser(req);
    const { data, error } = await client.rpc("join_team_for_user", { p_team_id: id, p_user_id: user.id });
    if (error) normalizeDbFailure(error, "TEAM_JOIN_FAILED", "Could not join team.");
    return ok(res, { joined: true, team_id: id, result: data || "joined" });
  }

  if (id && action === "leave" && method === "POST") {
    const user = await requireSupabaseUser(req);
    const team = await readTeam(id);
    if (String(team.owner_id) === String(user.id)) throw fail(409, "OWNER_CANNOT_LEAVE", "The team owner cannot leave without transferring ownership first.");
    const { data, error } = await client.from("team_members").delete().eq("team_id", id).eq("user_id", user.id).select("team_id").maybeSingle();
    if (error) normalizeDbFailure(error, "TEAM_LEAVE_FAILED", "Could not leave team.");
    if (!data) throw fail(409, "NOT_TEAM_MEMBER", "You are not a member of this team.");
    return ok(res, { left: true, team_id: id });
  }

  if (id && action.startsWith("members/") && method === "DELETE") {
    const user = await requireSupabaseUser(req);
    const team = await readTeam(id);
    if (String(team.owner_id) !== String(user.id)) throw fail(403, "TEAM_OWNER_REQUIRED", "Only the team owner can remove members.");
    if (String(memberId) === String(team.owner_id)) throw fail(409, "CANNOT_REMOVE_OWNER", "The team owner cannot be removed.");
    const { data, error } = await client.from("team_members").delete().eq("team_id", id).eq("user_id", memberId).select("team_id").maybeSingle();
    if (error) normalizeDbFailure(error, "TEAM_MEMBER_REMOVE_FAILED", "Could not remove team member.");
    if (!data) throw fail(404, "TEAM_MEMBER_NOT_FOUND", "That user is not a member of this team.");
    return ok(res, { removed: true, team_id: id, user_id: memberId });
  }

  if (id && !action && method === "PATCH") {
    const user = await requireSupabaseUser(req);
    const team = await readTeam(id);
    if (String(team.owner_id) !== String(user.id)) throw fail(403, "TEAM_OWNER_REQUIRED", "Only the team owner can edit this team.");
    const body = await readJson(req);
    const updates = {};
    if (Object.prototype.hasOwnProperty.call(body, "name")) updates.name = validName(body.name);
    if (Object.prototype.hasOwnProperty.call(body, "description")) updates.description = optionalText(body.description, 1000, "Description") || "";
    if (Object.prototype.hasOwnProperty.call(body, "parish")) updates.parish = optionalText(body.parish, 60, "Parish");
    if (Object.prototype.hasOwnProperty.call(body, "logo_url")) updates.logo_url = validImageUrl(body.logo_url, "Logo URL");
    if (Object.prototype.hasOwnProperty.call(body, "badge_url")) updates.badge_url = validImageUrl(body.badge_url, "Badge URL");
    if (Object.prototype.hasOwnProperty.call(body, "recruiting")) {
      if (typeof body.recruiting !== "boolean") throw fail(400, "INVALID_RECRUITING", "Recruiting must be true or false.");
      updates.recruiting = body.recruiting;
    }
    if (Object.prototype.hasOwnProperty.call(body, "max_members")) {
      const max = Number(body.max_members);
      if (!Number.isInteger(max) || max < 2 || max > 500) throw fail(400, "INVALID_MEMBER_LIMIT", "Maximum members must be a whole number from 2 to 500.");
      const { count, error } = await client.from("team_members").select("user_id", { count: "exact", head: true }).eq("team_id", id);
      if (error) normalizeDbFailure(error, "TEAM_MEMBERS_LOOKUP_FAILED", "Could not validate member limit.", "team_members");
      if (max < (count || 0)) throw fail(409, "MEMBER_LIMIT_BELOW_CURRENT", "Maximum members cannot be lower than the current membership count.");
      updates.max_members = max;
    }
    if (!Object.keys(updates).length) throw fail(400, "NO_TEAM_CHANGES", "No editable team fields were provided.");
    updates.updated_at = new Date().toISOString();
    const { data, error } = await client.rpc("update_team_for_user", {
      p_team_id: id,
      p_user_id: user.id,
      p_name: updates.name === undefined ? team.name : updates.name,
      p_description: updates.description === undefined ? (team.description || "") : updates.description,
      p_parish: updates.parish === undefined ? team.parish : updates.parish,
      p_logo_url: updates.logo_url === undefined ? team.logo_url : updates.logo_url,
      p_badge_url: updates.badge_url === undefined ? team.badge_url : updates.badge_url,
      p_max_members: updates.max_members === undefined ? Number(team.max_members || 20) : updates.max_members,
      p_recruiting: updates.recruiting === undefined ? team.recruiting !== false : updates.recruiting
    });
    if (error) {
      if (normalizeExternalError(error).code === "42501") throw fail(403, "TEAM_OWNER_REQUIRED", "Only the team owner can edit this team.");
      normalizeDbFailure(error, "TEAM_UPDATE_FAILED", "Could not update team.");
    }
    const updatedTeam = Array.isArray(data) ? data[0] : data;
    return ok(res, { team: updatedTeam });
  }

  return false;
}
