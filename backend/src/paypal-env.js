// Normalize PayPal environment settings supplied by common hosting dashboards.
// Environment variable names are read case-insensitively because some dashboards
// preserve accidental lower-case keys. Unknown explicit values stay invalid.
export function readEnvironmentSetting(env, name) {
  if (!env || typeof env !== 'object') return undefined;
  const canonical = String(name || '').trim();
  const matchingKeys = Object.keys(env).filter(
    candidate => candidate.toLowerCase() === canonical.toLowerCase()
  );
  // Prefer a non-empty exact key, then any non-empty case-insensitive alias.
  // This avoids a blank PAYPAL_ENV masking a populated paypal_env entry.
  const orderedKeys = [
    ...(Object.prototype.hasOwnProperty.call(env, canonical) ? [canonical] : []),
    ...matchingKeys.filter(candidate => candidate !== canonical)
  ];
  for (const key of orderedKeys) {
    const value = env[key];
    if (value != null && String(value).trim() !== '') return String(value).trim();
  }
  return undefined;
}

export function normalizePayPalEnvironment(primary, alias, alternate) {
  const values = [primary, alias, alternate].map(value => {
    // Strip invisible format characters which can be pasted from dashboards.
    const clean = String(value == null ? '' : value)
      .normalize('NFKC')
      .replace(/[\u200B-\u200D\u2060\uFEFF]/g, '')
      .trim()
      .toLowerCase();
    return clean.replace(/^(['"])(.*)\1$/, '$2').trim();
  });
  const raw = values.find(Boolean) || 'sandbox';
  const normalized = raw.replace(/[\s_-]+/g, '');
  if ([
    'live', 'production', 'prod', 'paypal', 'paypallive', 'livemode',
    'liveenvironment', 'productionenvironment', 'productionmode', 'liveapi',
    'paypalproduction', 'paypalproductionapi'
  ].includes(normalized)) return { raw, environment: 'live' };
  if ([
    'sandbox', 'test', 'testing', 'paypalsandbox', 'sandboxmode',
    'sandboxenvironment', 'testenvironment', 'sandboxapi', 'paypalsandboxapi'
  ].includes(normalized)) return { raw, environment: 'sandbox' };
  return { raw, environment: 'invalid' };
}
