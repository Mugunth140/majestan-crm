import pino from 'pino';
import { SENSITIVE_REQUEST_LOG_PATHS } from './request-redactions';
it('redacts integration, website, authorization and cookie credentials from request logs', () => {
  let output = '';
  const logger = pino({ redact: SENSITIVE_REQUEST_LOG_PATHS }, { write: (value: string) => { output += value; } });
  logger.info({ req: { headers: { 'x-api-key': 'private-portal-key', authorization: 'Bearer private-login-token', 'x-service-key': 'private-website-key', cookie: 'private-cookie', 'content-type': 'application/json' } } });
  for (const value of ['private-portal-key', 'private-login-token', 'private-website-key', 'private-cookie']) expect(output).not.toContain(value);
  expect(output).toContain('application/json'); expect(output).toContain('[Redacted]');
});
