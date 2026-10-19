import assert from 'node:assert/strict';
import { handleTeamLeagueRoute } from '../src/team-leagues.js';

const id1 = '123e4567-e89b-12d3-a456-426614174000';
const id2 = '123e4567-e89b-12d3-a456-426614174001';
const id3 = '123e4567-e89b-12d3-a456-426614174002';
const official = ['A1','A2','A3','B1','B2','B3','B4','B5','C1','C2','C3','C4','C5','D1','D2','D3','D4','D5'];

function makeContext({ pathname, method, admin = true, body = {}, seasons = [], teams = [], standings = [] } = {}) {
  const store = {
    seasons: seasons.map(x => ({ created_at: new Date().toISOString(), ...x })),
    teams: teams.map(x => ({ ...x })),
    leagues: [...official.map(code => ({ code })), { code: 'A' }],
    standings: standings.map(x => ({ ...x })),
  };
  const sent = { result: null };
  const calls = [];
  let serial = 100;
  function matches(row, filters) {
    return filters.every(f => f.op === 'eq' ? String(row[f.key]) === String(f.value) : f.op === 'neq' ? String(row[f.key]) !== String(f.value) : true);
  }
  function tableRows(table) { return table === 'league_seasons' ? store.seasons : table === 'league_standings' ? store.standings : store[table] || []; }
  function query(table) {
    const q = { table, op: 'select', payload: null, filters: [], orders: [], max: Infinity };
    q.select = function () { return this; };
    q.eq = function (key, value) { this.filters.push({ op: 'eq', key, value }); return this; };
    q.neq = function (key, value) { this.filters.push({ op: 'neq', key, value }); return this; };
    q.order = function (key, options) { this.orders.push({ key, ascending: !options || options.ascending !== false }); return this; };
    q.limit = function (limit) { this.max = limit; return this; };
    q.insert = function (value) { this.op = 'insert'; this.payload = value; return this; };
    q.upsert = function (value) { this.op = 'upsert'; this.payload = value; return this; };
    q.update = function (value) { this.op = 'update'; this.payload = value; return this; };
    q.delete = function () { this.op = 'delete'; return this; };
    q.single = async function () { const r = await this.run(); const d = Array.isArray(r.data) ? r.data[0] : r.data; return { data: d || null, error: r.error }; };
    q.maybeSingle = async function () { const r = await this.run(); const d = Array.isArray(r.data) ? (r.data[0] || null) : (r.data || null); return { data: d, error: r.error }; };
    q.run = async function () {
      calls.push({ table, op: this.op });
      if (this.op === 'insert') {
        const value = { id: `123e4567-e89b-12d3-a456-426614174${String(serial++).padStart(3,'0')}`, created_at: new Date().toISOString(), ...this.payload };
        if (table === 'league_seasons') store.seasons.push(value);
        return { data: [value], error: null };
      }
      if (this.op === 'delete') {
        const rows = tableRows(table);
        const removed = rows.filter(row => matches(row, this.filters));
        if (table === 'league_seasons') store.seasons = rows.filter(row => !matches(row, this.filters));
        else if (table === 'league_standings') store.standings = rows.filter(row => !matches(row, this.filters));
        if (table === 'league_seasons') {
          const ids = new Set(removed.map(row => row.id));
          store.standings = store.standings.filter(row => !ids.has(row.season_id));
        }
        return { data: removed, error: null };
      }
      if (this.op === 'update') {
        const rows = tableRows(table);
        const changed = [];
        for (const row of rows) if (matches(row, this.filters)) { Object.assign(row, this.payload); changed.push({ ...row }); }
        return { data: changed, error: null };
      }
      if (this.op === 'upsert') {
        for (const incoming of (Array.isArray(this.payload) ? this.payload : [this.payload])) {
          const rows = tableRows(table);
          const existing = rows.find(row => row.season_id === incoming.season_id && row.team_id === incoming.team_id);
          if (existing) Object.assign(existing, incoming); else rows.push({ ...incoming, played: 0, wins: 0, draws: 0, losses: 0, goals_for: 0, goals_against: 0, points: 0, form: [], position: null, promoted: false, relegated: false });
        }
        return { data: [], error: null };
      }
      let rows = tableRows(table).filter(row => matches(row, this.filters)).map(row => ({ ...row }));
      for (const ord of [...this.orders].reverse()) rows.sort((a,b) => String(a[ord.key]||'').localeCompare(String(b[ord.key]||'')) * (ord.ascending ? 1 : -1));
      if (Number.isFinite(this.max)) rows = rows.slice(0, this.max);
      return { data: rows, error: null };
    };
    q.then = function (resolve, reject) { return this.run().then(resolve, reject); };
    return q;
  }
  const ctx = {
    pathname: pathname || '/api/admin/leagues/seasons', method: method || 'GET',
    req: { headers: { authorization: 'Bearer test' }, body }, res: {},
    requireSupabaseUser: async () => ({ id: 'admin-user' }),
    profileFor: async () => ({ id: 'admin-user', is_admin: admin }),
    readJson: async () => body,
    db: () => ({ from: query }),
    normalizeExternalError: error => ({ message: error.message, code: error.code, details: error.details, hint: error.hint }),
    fail(status, code, message, details) { const error = new Error(message); error.status = status; error.code = code; error.details = details; throw error; },
    ok(_res, payload) { sent.result = { status: 200, body: { ok: true, ...payload } }; return sent.result; },
  };
  return { ctx, store, sent, calls };
}

{
  const starts = new Date(Date.now() - 60_000).toISOString();
  const ends = new Date(Date.now() + 7 * 86400_000).toISOString();
  const built = makeContext({ method: 'POST', body: { name: 'Opening Season', starts_at: starts, ends_at: ends, activate: true }, teams: [
    { id: 'team-d5', division_code: 'D5' }, { id: 'team-b2', division_code: 'B2' }, { id: 'team-old', division_code: 'A' }
  ] });
  const handled = await handleTeamLeagueRoute(built.ctx);
  assert.ok(handled);
  assert.equal(built.sent.result.body.season.status, 'active');
  assert.equal(built.sent.result.body.seededTeams, 3);
  assert.equal(built.store.standings.length, 3);
  assert.equal(built.store.standings.find(x => x.team_id === 'team-old').division_code, 'D5');
  assert.equal(built.store.standings.find(x => x.team_id === 'team-b2').division_code, 'B2');
}

{
  const built = makeContext({ method: 'GET', admin: false });
  await assert.rejects(() => handleTeamLeagueRoute(built.ctx), error => error.status === 403 && error.code === 'ADMIN_REQUIRED');
}

{
  const starts = new Date(Date.now() - 60_000).toISOString();
  const ends = new Date(Date.now() + 7 * 86400_000).toISOString();
  const built = makeContext({ method: 'POST', body: { name: 'Second Season', starts_at: starts, ends_at: ends, activate: true }, seasons: [
    { id: id2, name: 'Existing Active Season', status: 'active', starts_at: starts, ends_at: ends }
  ] });
  await assert.rejects(() => handleTeamLeagueRoute(built.ctx), error => error.status === 409 && error.code === 'ACTIVE_SEASON_EXISTS');
  assert.equal(built.store.seasons.length, 1, 'must not create a second active season');
}

{
  const starts = new Date(Date.now() - 60_000).toISOString();
  const ends = new Date(Date.now() + 7 * 86400_000).toISOString();
  const built = makeContext({ pathname: `/api/admin/leagues/seasons/${id1}/activate`, method: 'POST', seasons: [
    { id: id1, name: 'Scheduled Season', status: 'scheduled', starts_at: starts, ends_at: ends }
  ], teams: [{ id: 'team-1', division_code: 'D5' }] });
  const handled = await handleTeamLeagueRoute(built.ctx);
  assert.ok(handled);
  assert.equal(built.sent.result.body.season.status, 'active');
  assert.equal(built.store.standings.length, 1);
}

console.log('PASS — authenticated admin season setup, activation window, duplicate-active protection, and standings initialization');
