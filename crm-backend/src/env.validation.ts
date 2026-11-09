/**
 * Fail-fast environment validation. Called before the Nest app boots so a
 * misconfigured deployment crashes immediately with a clear message instead
 * of silently falling back to insecure defaults.
 */
const REQUIRED_ENV_VARS = ['JWT_SECRET', 'DB_USERNAME', 'DB_PASSWORD'] as const;

export function assertRequiredEnv(): void {
  const missing = REQUIRED_ENV_VARS.filter(
    (key) => process.env[key] === undefined,
  );
  if (missing.length > 0) {
    throw new Error(
      `Missing required environment variables: ${missing.join(', ')}. ` +
        'Set them in .env (local) or the container environment (docker).',
    );
  }
}

/** Optional integration: invalid/missing settings disable analytics, never CRM. */
export function siteAnalyticsEnvironment(
  env: Record<string, string | undefined> = process.env,
) {
  const apiUrl = (
    env.SITE_ANALYTICS_API_URL ?? 'http://site-site-backend-1:5000/api/v1'
  )
    .trim()
    .replace(/\/+$/, '');
  const readKey = (env.SITE_ANALYTICS_READ_KEY ?? '').trim();
  let validUrl = false;
  try {
    const url = new URL(apiUrl);
    validUrl =
      ['http:', 'https:'].includes(url.protocol) &&
      !url.username &&
      !url.password &&
      !url.search &&
      !url.hash;
  } catch {
    /* Optional integration is not configured. */
  }
  return { apiUrl, readKey, configured: validUrl && !!readKey };
}
