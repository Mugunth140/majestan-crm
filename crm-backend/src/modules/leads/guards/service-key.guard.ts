import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';

@Injectable()
export class ServiceKeyGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const provided = request.headers?.['x-service-key'];
    const expected = process.env.SITE_TO_CRM_SERVICE_KEY;
    if (!expected || !provided || provided !== expected) {
      throw new UnauthorizedException('Invalid service key');
    }
    return true;
  }
}
