#!/usr/bin/env node
// Schedule this script once daily on your backend/Render cron job.
// Environment: BACKEND_URL and LIVE_RECORDING_CLEANUP_SECRET.
const base = String(process.env.BACKEND_URL || process.env.CREATOR_HUB_BACKEND_URL || '').replace(/\/+$/, '');
const secret = String(process.env.LIVE_RECORDING_CLEANUP_SECRET || '');
if (!base || !secret) {
  console.error('Required environment variables: BACKEND_URL and LIVE_RECORDING_CLEANUP_SECRET.');
  process.exit(2);
}
const url = `${base}/api/live-experience/maintenance/recordings/cleanup`;
try {
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'x-live-recording-cleanup-secret': secret, accept: 'application/json' },
    signal: AbortSignal.timeout(30000),
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok || body.ok === false) {
    console.error(`Recording cleanup failed (HTTP ${response.status}):`, JSON.stringify(body));
    process.exit(1);
  }
  console.log(JSON.stringify(body, null, 2));
} catch (error) {
  console.error(`Recording cleanup request failed: ${error.message}`);
  process.exit(1);
}
