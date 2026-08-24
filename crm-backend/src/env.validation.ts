/**
 * Fail-fast environment validation. Called before the Nest app boots so a
 * misconfigured deployment crashes immediately with a clear message instead
 * of silently falling back to insecure defaults.
 */
const REQUIRED_ENV_VARS = [
  'JWT_SECRET',
  'DB_USERNAME',
  'DB_PASSWORD',
] as const;

export function assertRequiredEnv(): void {
  const missing = REQUIRED_ENV_VARS.filter((key) => process.env[key] === undefined);
  if (missing.length > 0) {
    throw new Error(
      `Missing required environment variables: ${missing.join(', ')}. ` +
        'Set them in .env (local) or the container environment (docker).',
    );
  }
}
