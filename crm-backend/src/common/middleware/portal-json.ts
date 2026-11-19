import { BadRequestException, Logger, PayloadTooLargeException } from '@nestjs/common';
import { json, RequestHandler } from 'express';
const parse = json({ limit: '512kb' });
const logger = new Logger('PortalPush');

/**
 * The layout of a JSON body with every value replaced by its type, e.g.
 * { leads: [{ name: 'string', mobile: 'number' }] }. No customer data is kept.
 */
export function bodyShape(value: unknown, depth = 0): unknown {
  if (Array.isArray(value)) return depth > 3 ? `array(${value.length})` : value.length ? [bodyShape(value[0], depth + 1), `x${value.length}`] : [];
  if (value && typeof value === 'object') {
    if (depth > 3) return 'object';
    return Object.fromEntries(Object.keys(value).slice(0, 40).map((k) => [k, bodyShape((value as Record<string, unknown>)[k], depth + 1)]));
  }
  return value === null ? 'null' : typeof value;
}

/**
 * Magicbricks sends one lead as a bare object ({ name, mobile, ... }); a list of leads may also
 * come bare. Wrap either as { leads: [...] } so both portals share one format.
 */
export function asLeadsEnvelope(body: unknown): unknown {
  if (Array.isArray(body)) return { leads: body };
  if (body && typeof body === 'object' && !('leads' in body) && ('mobile' in body || 'name' in body))
    return { leads: [body] };
  return body;
}

/** Body parser for property-portal pushes (99acres, Magicbricks). */
export const portalJsonParser: RequestHandler = (req, res, next) => parse(req, res, error => {
  const portal = req.originalUrl.includes('magicbricks') ? 'Magicbricks' : '99acres';
  // The global exception filter handles Nest HttpExceptions, not body-parser's raw errors.
  if (error?.type === 'entity.too.large') return next(new PayloadTooLargeException('Request exceeds 512 KB'));
  if (error?.type === 'entity.parse.failed') {
    logger.warn(`${portal} push: invalid JSON (content-type ${req.headers['content-type'] ?? 'none'})`);
    return next(new BadRequestException('Invalid JSON body'));
  }
  if (!error) {
    logger.log(`${portal} push shape (content-type ${req.headers['content-type'] ?? 'none'}): ${JSON.stringify(bodyShape(req.body))}`);
    req.body = asLeadsEnvelope(req.body);
  }
  return next(error);
});
