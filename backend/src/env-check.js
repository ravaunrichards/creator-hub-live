// ============================================================================
// Environment readiness validation (v4.3.0 hardening)
// ----------------------------------------------------------------------------
// Fail fast in production when the credentials that back server-side authority
// are missing, instead of booting a server that silently 500s on every write.
// In non-production it only warns, so local/dev boots stay frictionless.
//
// REQUIRED: the Supabase service-role pair the backend uses to enforce
//   authority (balances, winners, ledger) server-side.
// RECOMMENDED: feature credentials; absent -> that feature degrades, but the
//   server still boots.
// ============================================================================

const REQUIRED = ["SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY"];

const RECOMMENDED = [
  "SUPABASE_ANON_KEY",
  "LIVEKIT_API_KEY",
  "LIVEKIT_API_SECRET",
  "LIVEKIT_URL",
  "PAYPAL_CLIENT_ID",
  "PAYPAL_CLIENT_SECRET",
  "PAYPAL_WEBHOOK_ID",
];

function isSet(name, env) {
  const value = env[name];
  return typeof value === "string" && value.trim().length > 0;
}

export function validateEnvironment(env = process.env) {
  const isProduction = String(env.NODE_ENV || "").toLowerCase() === "production";
  const missingRequired = REQUIRED.filter((name) => !isSet(name, env));
  const missingRecommended = RECOMMENDED.filter((name) => !isSet(name, env));
  const ready = missingRequired.length === 0;
  return { ready, isProduction, missingRequired, missingRecommended };
}

// Logs a readiness summary. In production with missing REQUIRED vars it throws
// so the process exits non-zero instead of serving a broken deployment.
export function assertEnvironmentReady(env = process.env, logger = console) {
  const report = validateEnvironment(env);

  if (report.missingRecommended.length > 0) {
    logger.warn(
      "[env] Recommended variables not set (related features will be degraded/disabled): " +
        report.missingRecommended.join(", ")
    );
  }

  if (!report.ready) {
    const msg =
      "[env] Missing REQUIRED environment variables: " + report.missingRequired.join(", ");
    if (report.isProduction) {
      throw new Error(msg + " \u2014 refusing to start in production.");
    }
    logger.warn(msg + " \u2014 continuing in non-production mode; writes will fail until set.");
  } else {
    logger.log("[env] Required environment variables present.");
  }

  return report;
}
