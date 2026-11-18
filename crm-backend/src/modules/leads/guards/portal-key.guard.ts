import { CanActivate, ExecutionContext, Injectable, ServiceUnavailableException, UnauthorizedException } from '@nestjs/common';
import { createHash, timingSafeEqual } from 'node:crypto';

/** Checks X-API-Key against the portal's own key, so each portal can be revoked on its own. */
function checkKey(context: ExecutionContext, envVar: string, portal: string) {
  const expected = process.env[envVar];
  if (!expected) throw new ServiceUnavailableException(`${portal} integration is not configured`);
  const provided = context.switchToHttp().getRequest().headers?.['x-api-key'];
  if (typeof provided !== 'string' || !provided || !timingSafeEqual(
    createHash('sha256').update(provided).digest(), createHash('sha256').update(expected).digest(),
  )) throw new UnauthorizedException('Invalid integration key');
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
