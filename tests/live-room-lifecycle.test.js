import assert from 'node:assert/strict';
import { closeOrphanedLiveRooms } from '../src/live-room-lifecycle.js';

const now = Date.parse('2026-10-16T20:00:00.000Z');
const quiet = { info() {}, warn() {}, error() {} };

function row(overrides = {}) {
  return {
    id: 'session-1', host_id: 'host-1', room_name: 'chl_room_123',
    started_at: '2026-10-16T18:00:00.000Z',
    updated_at: '2026-10-16T19:55:00.000Z', status: 'live', ended_at: null,
    ...overrides,
  };
}

function mockDb(rows, { updateError = null } = {}) {
  const updates = [];
  const db = {
    from(table) {
      assert.equal(table, 'live_sessions');
      return {
        select(columns) {
          assert.equal(columns, 'id,host_id,room_name,started_at,updated_at,status,ended_at');
          return { eq() { return this; }, is() { return Promise.resolve({ data: rows, error: null }); } };
        },
        update(values) {
          updates.push(values);
          const chain = {
            eq() { return this; }, is() { return this; }, select() { return this; },
            maybeSingle() { return Promise.resolve({ data: updateError ? null : { id: 'session-1' }, error: updateError }); },
          };
          return chain;
        },
      };
    },
  };
  return { db, updates };
}

async function run() {
  {
    const { db, updates } = mockDb([row()]);
    const result = await closeOrphanedLiveRooms({
      client: db, livekitUrl: 'wss://example.livekit.cloud', apiKey: 'key', apiSecret: 'secret', now,
      logger: quiet,
      roomService: {
        async listRooms() { return [{ name: 'chl_room_123', numParticipants: 2 }]; },
        async listParticipants() { return [{ identity: 'host-1' }, { identity: 'viewer-1' }]; },
      },
    });
    assert.deepEqual(result, { scanned: 1, ended: 0, refreshed: 1 });
    assert.equal(updates[0].updated_at, new Date(now).toISOString(), 'a connected host refreshes the server-side heartbeat');
  }
  {
    const { db, updates } = mockDb([row()]);
    let deleted = '';
    const result = await closeOrphanedLiveRooms({
      client: db, livekitUrl: 'wss://example.livekit.cloud', apiKey: 'key', apiSecret: 'secret', now,
      logger: quiet,
      roomService: {
        async listRooms() { return [{ name: 'chl_room_123', numParticipants: 1 }]; },
        async listParticipants() { return [{ identity: 'viewer-1' }]; },
        async deleteRoom(name) { deleted = name; },
      },
    });
    assert.deepEqual(result, { scanned: 1, ended: 1, refreshed: 0 });
    assert.equal(deleted, 'chl_room_123', 'a room without its host is closed');
    assert.equal(updates.at(-1).status, 'ended');
    assert.equal(updates.at(-1).viewer_count, 0);
  }
  {
    const { db, updates } = mockDb([row()]);
    const result = await closeOrphanedLiveRooms({
      client: db, livekitUrl: 'wss://example.livekit.cloud', apiKey: 'key', apiSecret: 'secret', now,
      logger: quiet, roomService: {
        async listRooms() { return []; },
        async listParticipants() { throw new Error('must not be called when room is absent'); },
      },
    });
    assert.deepEqual(result, { scanned: 1, ended: 1, refreshed: 0 });
    assert.equal(updates[0].status, 'ended', 'a missing LiveKit room must be removed from live listings');
  }
  {
    const { db, updates } = mockDb([row()]);
    const result = await closeOrphanedLiveRooms({
      client: db, livekitUrl: 'wss://example.livekit.cloud', apiKey: 'key', apiSecret: 'secret', now,
      logger: quiet, roomService: { async listRooms() { throw new Error('temporary network outage'); } },
    });
    assert.deepEqual(result, { scanned: 1, ended: 0, refreshed: 0 });
    assert.equal(updates.length, 0, 'unknown LiveKit state must not end a session');
  }
  {
    const fresh = row({ updated_at: new Date(now - 30_000).toISOString() });
    const { db, updates } = mockDb([fresh]);
    const result = await closeOrphanedLiveRooms({
      client: db, livekitUrl: 'wss://example.livekit.cloud', apiKey: 'key', apiSecret: 'secret', now,
      logger: quiet, roomService: { async listRooms() { throw new Error('must not query fresh heartbeat'); } },
    });
    assert.deepEqual(result, { scanned: 1, ended: 0, refreshed: 0 });
    assert.equal(updates.length, 0, 'fresh sessions must be left untouched');
  }
  console.log('LIVE room lifecycle reconciliation tests passed');
}

run().catch((error) => { console.error(error); process.exitCode = 1; });
