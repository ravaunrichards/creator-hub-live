import assert from 'node:assert/strict';
import { closeOrphanedLiveRooms, closeLiveKitRoom } from '../src/live-room-lifecycle.js';

// now is one hour after the default row heartbeat, well past the stale window.
const now = Date.parse('2026-10-15T20:00:00.000Z');
const quiet = { info() {}, warn() {}, error() {} };

// Mock the Supabase client used by the lifecycle reconciler. The reconciler
// selects host_id alongside the room fields so it can verify host presence
// before ending a session, so the mock asserts that exact column contract.
function mockDb(rows, { updateError = null } = {}) {
  const updates = [];
  const db = {
    from(table) {
      assert.equal(table, 'live_sessions');
      return {
        select(columns) {
          assert.equal(columns, 'id,host_id,room_name,started_at,updated_at,status,ended_at');
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
    host_id: 'host-1',
    room_name: 'chl_room_123',
    started_at: '2026-10-15T19:00:00.000Z',
    updated_at: '2026-10-15T19:00:00.000Z',
    status: 'live',
    ended_at: null,
    ...overrides,
  };
}

async function run() {
  // 1. Stale session whose LiveKit room no longer exists -> host absent -> ended.
  {
    const { db, updates } = mockDb([row()]);
    const result = await closeOrphanedLiveRooms({
      client: db, livekitUrl: 'wss://example.livekit.cloud', apiKey: 'key', apiSecret: 'secret', now,
      logger: quiet, roomService: { async listRooms() { return []; } },
    });
    assert.deepEqual(result, { scanned: 1, ended: 1, refreshed: 0 });
    assert.equal(updates.length, 1);
    assert.equal(updates[0].status, 'ended');
    assert.equal(updates[0].viewer_count, 0);
    assert.equal(updates[0].ended_at, new Date(now).toISOString());
  }

  // 2. Stale session whose room exists but the host is not connected -> the
  //    lingering room is deleted best-effort and the session is ended.
  {
    const { db, updates } = mockDb([row()]);
    let deleted = '';
    const result = await closeOrphanedLiveRooms({
      client: db, livekitUrl: 'wss://example.livekit.cloud', apiKey: 'key', apiSecret: 'secret', now,
      logger: quiet, roomService: {
        async listRooms() { return [{ name: 'chl_room_123' }]; },
        async listParticipants() { return [{ identity: 'viewer-9' }]; },
        async deleteRoom(name) { deleted = name; },
      },
    });
    assert.deepEqual(result, { scanned: 1, ended: 1, refreshed: 0 });
    assert.equal(deleted, 'chl_room_123', 'a host-less room should be closed before the session is ended');
    assert.equal(updates[0].status, 'ended');
  }

  // 3. Stale session whose host is still present in LiveKit -> heartbeat is
  //    refreshed and the session stays live.
  {
    const { db, updates } = mockDb([row()]);
    const result = await closeOrphanedLiveRooms({
      client: db, livekitUrl: 'wss://example.livekit.cloud', apiKey: 'key', apiSecret: 'secret', now,
      logger: quiet, roomService: {
        async listRooms() { return [{ name: 'chl_room_123' }]; },
        async listParticipants() { return [{ identity: 'host-1' }, { identity: 'viewer-2' }]; },
      },
    });
    assert.deepEqual(result, { scanned: 1, ended: 0, refreshed: 1 });
    assert.equal(updates.length, 1, 'a live host heartbeat must be refreshed, not ended');
    assert.equal(updates[0].status, undefined, 'a heartbeat refresh must not change status');
    assert.equal(updates[0].updated_at, new Date(now).toISOString());
  }

  // 4. LiveKit room listing failure must never end a session.
  {
    const { db, updates } = mockDb([row()]);
    const result = await closeOrphanedLiveRooms({
      client: db, livekitUrl: 'wss://example.livekit.cloud', apiKey: 'key', apiSecret: 'secret', now,
      logger: quiet, roomService: { async listRooms() { throw new Error('temporary outage'); } },
    });
    assert.deepEqual(result, { scanned: 1, ended: 0, refreshed: 0 });
    assert.equal(updates.length, 0, 'LiveKit errors must never end a session');
  }

  // 5. LiveKit participant listing failure must never end a session either.
  {
    const { db, updates } = mockDb([row()]);
    const result = await closeOrphanedLiveRooms({
      client: db, livekitUrl: 'wss://example.livekit.cloud', apiKey: 'key', apiSecret: 'secret', now,
      logger: quiet, roomService: {
        async listRooms() { return [{ name: 'chl_room_123' }]; },
        async listParticipants() { throw new Error('participant lookup outage'); },
      },
    });
    assert.deepEqual(result, { scanned: 1, ended: 0, refreshed: 0 });
    assert.equal(updates.length, 0, 'participant lookup errors must never end a session');
  }

  // 6. Sessions inside the stale safety window are left untouched; LiveKit is
  //    not even queried for them.
  {
    const { db, updates } = mockDb([row({ updated_at: '2026-10-15T19:59:30.000Z' })]);
    let listed = false;
    const result = await closeOrphanedLiveRooms({
      client: db, livekitUrl: 'wss://example.livekit.cloud', apiKey: 'key', apiSecret: 'secret', now,
      logger: quiet, roomService: { async listRooms() { listed = true; return []; } },
    });
    assert.deepEqual(result, { scanned: 1, ended: 0, refreshed: 0 });
    assert.equal(listed, false, 'rooms inside the stale safety window must be left alone');
    assert.equal(updates.length, 0);
  }

  // 7. Explicit close deletes the LiveKit room.
  {
    let deleted = '';
    const result = await closeLiveKitRoom('chl_room_123', {
      livekitUrl: 'wss://example.livekit.cloud', apiKey: 'key', apiSecret: 'secret', logger: quiet,
      roomService: { async deleteRoom(name) { deleted = name; } },
    });
    assert.deepEqual(result, { closed: true });
    assert.equal(deleted, 'chl_room_123');
  }

  console.log('PASS — stale sessions with no LiveKit room are marked ended');
  console.log('PASS — host-less rooms are closed and reconciled');
  console.log('PASS — present hosts refresh the heartbeat and stay live');
  console.log('PASS — transient LiveKit room-list failures never end sessions');
  console.log('PASS — transient LiveKit participant-list failures never end sessions');
  console.log('PASS — sessions inside the stale safety window are preserved');
  console.log('PASS — explicit end can close the LiveKit room');
}

await run();
