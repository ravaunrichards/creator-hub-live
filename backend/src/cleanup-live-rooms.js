import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';
import { closeOrphanedLiveRooms } from './live-room-lifecycle.js';

const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const livekitUrl = process.env.LIVEKIT_URL || '';
const livekitApiKey = process.env.LIVEKIT_API_KEY || '';
const livekitApiSecret = process.env.LIVEKIT_API_SECRET || '';

if (!supabaseUrl || !serviceRoleKey || !livekitUrl || !livekitApiKey || !livekitApiSecret) {
  console.error('[LIVE cleanup job] Missing required environment configuration.');
  process.exit(1);
}

const client = createClient(supabaseUrl, serviceRoleKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

try {
  const result = await closeOrphanedLiveRooms({
    client,
    livekitUrl,
    apiKey: livekitApiKey,
    apiSecret: livekitApiSecret,
    logger: console,
  });
  console.info('[LIVE cleanup job] Completed:', JSON.stringify(result));
  if (result.skipped) process.exitCode = 1;
} catch (error) {
  console.error('[LIVE cleanup job] Failed safely:', error?.message || error);
  process.exitCode = 1;
}
