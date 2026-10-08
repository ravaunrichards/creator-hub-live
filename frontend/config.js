// Creator Hub Live — browser-safe runtime configuration.
// Private service credentials belong only in the deployed backend environment.
(function () {
  'use strict';
  
  // ✔️ FIXED: Pointed directly to your active live Render backend API instance
  var configuredBase = 'wss://creator-hub-live-9susyfri.livekit.cloud';
  
  var CreatorHubConfig = {
    app: {
      name: 'Creator Hub Live',
      project: 'creator-hub-live',
      environment: 'production',
      currency: 'JMD',
      locale: 'en-JM'
    },
    supabase: {
      // ✔️ FIXED: Pointed directly to your active production Supabase container ID
      url: 'https://txibryhznycmuqufnxvh.supabase.co',
      restUrl: 'https://txibryhznycmuqufnxvh.supabase.co/rest/v1/',
      publishableKey: 'sb_publishable_ewC8MT1HSsDLA5EyDV-PIg_vrZecqUY'
    },
    livekit: {
      // 📹 Pointed to your active live LiveKit project stream keys
      projectId: 'p_4ia809byg35',
      url: 'wss://creator-hub-live-9susyfri.livekit.cloud',
      websocketUrl: 'wss://creator-hub-live-9susyfri.livekit.cloud',
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
      // ✔️ FIXED: Synced assets repository target link to matching database project
      url: 'https://txibryhznycmuqufnxvh.supabase.co',
      bucket: ''
    },
    maps: {
      provider: 'OpenStreetMap',
      tileUrl: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png'
    },
    social: { tiktokUsername: 'creatorhubcreatornetwork' },
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
  CreatorHubConfig.TIKTOK_USERNAME = CreatorHubConfig.social.tiktokUsername;
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
