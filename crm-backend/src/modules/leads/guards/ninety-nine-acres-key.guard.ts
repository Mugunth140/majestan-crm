import { CanActivate, ExecutionContext, Injectable, ServiceUnavailableException, UnauthorizedException } from '@nestjs/common';
import { createHash, timingSafeEqual } from 'node:crypto';

@Injectable()
export class NinetyNineAcresKeyGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const expected = process.env.NINETY_NINE_ACRES_API_KEY;
    if (!expected) throw new ServiceUnavailableException('99acres integration is not configured');
    const provided = context.switchToHttp().getRequest().headers?.['x-api-key'];
    if (typeof provided !== 'string' || !provided || !timingSafeEqual(
      createHash('sha256').update(provided).digest(), createHash('sha256').update(expected).digest(),
    )) throw new UnauthorizedException('Invalid integration key');
    return true;
  }
}
