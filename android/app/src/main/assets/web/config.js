// Creator Hub Live — browser-safe runtime configuration.
// Private service credentials belong only in the deployed backend environment.
(function () {
  'use strict';
  
  // Public API endpoint; private credentials stay on the backend.
  var configuredBase = 'https://creator-hub-live-02c1.onrender.com';
  
  var CreatorHubConfig = {
    app: {
      name: 'Creator Hub Live',
      project: 'creator-hub-live',
      environment: 'production',
      currency: 'JMD',
      locale: 'en-JM'
    },
    supabase: {
      // Public project URL and publishable client key.
      url: 'https://txibryhznycmuqufnxvh.supabase.co',
      restUrl: 'https://txibryhznycmuqufnxvh.supabase.co/rest/v1/',
      publishableKey: 'sb_publishable_ewC8MT1HSsDLA5EyDV-PIg_vrZecqUY'
    },
    livekit: {
      // The backend's token response is the single source of truth for the
      // LiveKit server URL. Do not pin a second project URL in the browser:
      // it can silently diverge from the backend API key/secret project.
      projectId: '',
      url: '',
      websocketUrl: '',
      tokenEndpoint: '/api/livekit/token'
    },
    api: {
      baseUrl: configuredBase,
      healthPath: '/api/health',
      livekitTokenPath: '/api/livekit/token',
      publicConfigPath: '/api/config/public'
    },
    wallet: { currency: 'JMD' },
    storage: {
      // Storage endpoint; no private credentials are stored here.
      url: 'https://txibryhznycmuqufnxvh.supabase.co',
      bucket: ''
    },
    maps: {
      provider: 'OpenStreetMap',
      tileUrl: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png'
    },
    features: { livekit: true, paypal: true, maps: true, storage: true },
    version: '3.2.0'
  };

  // Backward-compatible legacy shape used by the existing pages.
  CreatorHubConfig.SUPABASE_URL = CreatorHubConfig.supabase.url;
  CreatorHubConfig.SUPABASE_PUBLISHABLE_KEY = CreatorHubConfig.supabase.publishableKey;
  CreatorHubConfig.SUPABASE_ANON_KEY = CreatorHubConfig.supabase.publishableKey;
  CreatorHubConfig.API_BASE = CreatorHubConfig.api.baseUrl;
  CreatorHubConfig.API_URL = CreatorHubConfig.api.baseUrl;
  CreatorHubConfig.BACKEND_URL = CreatorHubConfig.api.baseUrl;
  CreatorHubConfig.LIVEKIT_URL = CreatorHubConfig.livekit.url;
  CreatorHubConfig.LIVEKIT_WEBSOCKET_URL = CreatorHubConfig.livekit.websocketUrl;
  CreatorHubConfig.LIVEKIT_API_KEY = 'API_KEY_IS_NOT_REQUIRED_IN_BROWSER_REQUESTS';
  CreatorHubConfig.PAYPAL_ENVIRONMENT = 'sandbox';
  CreatorHubConfig.BRAND = CreatorHubConfig.app.name;
  CreatorHubConfig.APP_NAME = CreatorHubConfig.app.name;
  CreatorHubConfig.ENVIRONMENT = CreatorHubConfig.app.environment;
  CreatorHubConfig.VERSION = CreatorHubConfig.version;
  CreatorHubConfig.API_VERSION = 'v1';
  CreatorHubConfig.DEBUG = false;

  // Global browser mapping definitions explicitly loaded for application pages
  window.CreatorHubConfig = CreatorHubConfig;
  window.CHL_CONFIG = CreatorHubConfig;
  window.APP_CONFIG = CreatorHubConfig;
  window.CREATOR_HUB_API_BASE = CreatorHubConfig.api.baseUrl;
})();
