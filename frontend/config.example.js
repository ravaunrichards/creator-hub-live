// Copy this shape to config.js only when a deployment needs an external API base.
// The checked-in config.js already contains browser-safe Supabase/LiveKit settings.
window.__CREATOR_HUB_API_BASE__ = '';
window.CHL_CONFIG = {
  API_BASE: '',
  SUPABASE_URL: 'https://YOUR-PROJECT.supabase.co',
  SUPABASE_PUBLISHABLE_KEY: 'YOUR_SUPABASE_PUBLISHABLE_KEY'
};
