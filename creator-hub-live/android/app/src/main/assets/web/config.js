// Creator Hub Live — browser-safe runtime configuration.
// Private service credentials belong only in the deployed backend environment.
(function () {
  'use strict';
  var configuredBase = (window.__CREATOR_HUB_API_BASE__ || '').trim();
  var CreatorHubConfig = {
    app: {
      name: 'Creator Hub Live',
      project: 'creator-hub-live',
      environment: 'production',
      currency: 'JMD',
      locale: 'en-JM'
    },
    supabase: {
      url: 'https://mccpbfhgnmhkxnohzoyu.supabase.co',
      restUrl: 'https://mccpbfhgnmhkxnohzoyu.supabase.co/rest/v1/',
      publishableKey: 'sb_publishable_srcwFc6VFVpgT_m15yLvGg_RPGFvle6'
    },
    livekit: {
      projectId: 'p_3iyxbyzr2vp',
      url: 'wss://creator-hub-live-iwqooqmr.livekit.cloud',
      websocketUrl: 'wss://creator-hub-live-iwqooqmr.livekit.cloud',
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
      url: 'https://mccpbfhgnmhkxnohzoyu.supabase.co',
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

  window.CreatorHubConfig = CreatorHubConfig;
  window.CHL_CONFIG = CreatorHubConfig;
  window.APP_CONFIG = CreatorHubConfig;
  window.CREATOR_HUB_API_BASE = CreatorHubConfig.api.baseUrl;
})();
