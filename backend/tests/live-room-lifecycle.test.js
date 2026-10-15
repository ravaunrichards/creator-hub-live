import assert from 'node:assert/strict';
import { closeOrphanedLiveRooms, closeLiveKitRoom } from '../src/live-room-lifecycle.js';

const now = Date.parse('2026-10-15T20:00:00.000Z');
const quiet = { info() {}, warn() {}, error() {} };

function mockDb(rows, { updateError = null } = {}) {
  const updates = [];
  const db = {
    from(table) {
      assert.equal(table, 'live_sessions');
      return {
        select(columns) {
          assert.equal(columns, 'id,room_name,started_at,updated_at,status,ended_at');
          return {
            eq() { return this; },
            is() { return Promise.resolve({ data: rows, error: null }); },
          };
        },
        update(values) {
          updates.push(values);
          const chain = {
            eq() { return this; },
            is() { return this; },
            select() { return this; },
            maybeSingle() {
              return Promise.resolve({ data: updateError ? null : { id: 'session-1' }, error: updateError });
            },
          };
          return chain;
        },
      };
    },
  };
  return { db, updates };
}

function row(overrides = {}) {
  return {
    id: 'session-1',
    room_name: 'chl_room_123',
    started_at: '2026-10-15T19:00:00.000Z',
    updated_at: '2026-10-15T19:00:00.000Z',
    status: 'live',
    ended_at: null,
    ...overrides,
  };
}

async function run() {
  {
    const { db, updates } = mockDb([row()]);
    const result = await closeOrphanedLiveRooms({
      client: db, livekitUrl: 'wss://example.livekit.cloud', apiKey: 'key', apiSecret: 'secret', now,
      logger: quiet, roomService: { async listRooms() { return []; } },
    });
    assert.deepEqual(result, { scanned: 1, ended: 1 });
    assert.equal(updates.length, 1);
    assert.equal(updates[0].status, 'ended');
    assert.equal(updates[0].viewer_count, 0);
    assert.equal(updates[0].ended_at, new Date(now).toISOString());
  }
  {
    const { db, updates } = mockDb([row()]);
    let deleted = '';
    const result = await closeOrphanedLiveRooms({
      client: db, livekitUrl: 'wss://example.livekit.cloud', apiKey: 'key', apiSecret: 'secret', now,
      logger: quiet, roomService: {
        async listRooms() { return [{ name: 'chl_room_123', numParticipants: 0 }]; },
        async deleteRoom(name) { deleted = name; },
      },
    });
    assert.deepEqual(result, { scanned: 1, ended: 1 });
    assert.equal(deleted, 'chl_room_123', 'old empty rooms should be closed before reconciliation');
    assert.equal(updates[0].status, 'ended');
  }
  {
    const { db, updates } = mockDb([row()]);
    const result = await closeOrphanedLiveRooms({
      client: db, livekitUrl: 'wss://example.livekit.cloud', apiKey: 'key', apiSecret: 'secret', now,
      logger: quiet, roomService: { async listRooms() { return [{ name: 'chl_room_123', numParticipants: 2 }]; } },
    });
    assert.deepEqual(result, { scanned: 1, ended: 0 });
    assert.equal(updates.length, 0, 'a room with participants must remain live');
  }
  {
    const { db, updates } = mockDb([row()]);
    const result = await closeOrphanedLiveRooms({
      client: db, livekitUrl: 'wss://example.livekit.cloud', apiKey: 'key', apiSecret: 'secret', now,
      logger: quiet, roomService: { async listRooms() { throw new Error('temporary outage'); } },
    });
    assert.deepEqual(result, { scanned: 1, ended: 0 });
    assert.equal(updates.length, 0, 'LiveKit errors must never end a session');
  }
  {
    const { db, updates } = mockDb([row({ started_at: '2026-10-15T19:58:00.000Z' })]);
    let listed = false;
    const result = await closeOrphanedLiveRooms({
      client: db, livekitUrl: 'wss://example.livekit.cloud', apiKey: 'key', apiSecret: 'secret', now,
      logger: quiet, roomService: { async listRooms() { listed = true; return []; } },
    });
    assert.deepEqual(result, { scanned: 1, ended: 0 });
    assert.equal(listed, false, 'rooms inside the five-minute safety window must be left alone');
    assert.equal(updates.length, 0);
  }
  {
    let deleted = '';
    const result = await closeLiveKitRoom('chl_room_123', {
      livekitUrl: 'wss://example.livekit.cloud', apiKey: 'key', apiSecret: 'secret', logger: quiet,
      roomService: { async deleteRoom(name) { deleted = name; } },
    });
    assert.deepEqual(result, { closed: true });
    assert.equal(deleted, 'chl_room_123');
  }
  console.log('PASS — missing rooms are marked ended after grace period');
  console.log('PASS — old empty rooms are closed and reconciled');
  console.log('PASS — rooms with participants remain live');
  console.log('PASS — transient LiveKit failures never end sessions');
  console.log('PASS — rooms inside grace period are preserved');
  console.log('PASS — explicit end can close the LiveKit room');
}

await run();
