import { CanActivate, ExecutionContext, Injectable, Logger, ServiceUnavailableException, UnauthorizedException } from '@nestjs/common';
import { createHash, timingSafeEqual } from 'node:crypto';

const logger = new Logger('PortalKey');
const same = (a: string, b: string) =>
  timingSafeEqual(createHash('sha256').update(a).digest(), createHash('sha256').update(b).digest());

/** Header names that look like a key, so a portal using the wrong header shows up too. */
const KEYISH = /key|auth|token|secret/i;

/**
 * What a refused key looks like, without the key: its length, and whether it would match
 * with spaces or a "Bearer " prefix removed. Never logs the value or any part of it.
 */
export function describeRefusedKey(headers: Record<string, unknown>, expected: string) {
  const raw = headers?.['x-api-key'];
  const provided = typeof raw === 'string' ? raw : Array.isArray(raw) ? String(raw[0] ?? '') : '';
  const cleaned = provided.trim().replace(/^bearer\s+/i, '').replace(/^["']|["']$/g, '').trim();
  const auth = headers?.authorization;
  const authValue = typeof auth === 'string' ? auth.replace(/^bearer\s+/i, '').trim() : '';
  return {
    sent: typeof raw === 'string' ? 'x-api-key' : raw == null ? 'none' : typeof raw,
    length: provided.length,
    expectedLength: expected.length,
    startsLikeOurs: provided.slice(0, 3) === expected.slice(0, 3),
    hasSpaces: /\s/.test(provided),
    hasBearer: /^\s*bearer\s/i.test(provided),
    hasQuotes: /^["']|["']$/.test(provided.trim()),
    matchesOnceCleaned: !!cleaned && same(cleaned, expected),
    authorizationMatches: !!authValue && same(authValue, expected),
    keyHeaders: Object.keys(headers ?? {}).filter((h) => KEYISH.test(h)),
  };
}

/**
 * The key as given, or without its "sk-" prefix: 99acres saved the key without it. The part
 * after "sk-" is the whole secret, so this does not make the key any easier to guess.
 */
export function keyMatches(provided: string, expected: string) {
  if (same(provided, expected)) return true;
  return expected.startsWith('sk-') && !provided.startsWith('sk-') && same('sk-' + provided, expected);
}

/** Checks X-API-Key against the portal's own key, so each portal can be revoked on its own. */
function checkKey(context: ExecutionContext, envVar: string, portal: string) {
  const expected = process.env[envVar];
  if (!expected) throw new ServiceUnavailableException(`${portal} integration is not configured`);
  const headers = context.switchToHttp().getRequest().headers ?? {};
  const provided = headers['x-api-key'];
  if (typeof provided !== 'string' || !provided || !keyMatches(provided, expected)) {
    logger.warn(`${portal} key refused ${JSON.stringify(describeRefusedKey(headers, expected))}`);
    throw new UnauthorizedException('Invalid integration key');
  }
  return true;
}

@Injectable()
export class NinetyNineAcresKeyGuard implements CanActivate {
  canActivate(context: ExecutionContext) { return checkKey(context, 'NINETY_NINE_ACRES_API_KEY', '99acres'); }
}

@Injectable()
export class MagicbricksKeyGuard implements CanActivate {
  canActivate(context: ExecutionContext) { return checkKey(context, 'MAGICBRICKS_API_KEY', 'Magicbricks'); }
}
