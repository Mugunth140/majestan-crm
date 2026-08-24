import { Injectable, CanActivate, ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ROLES_KEY } from './roles.decorator';

/**
 * Role-based authorization guard. Reads the roles required by
 * @Roles() on the handler (falling back to the controller class)
 * and checks them against req.user.role, set by JwtAuthGuard.
 * Passes through routes that declare no @Roles().
 */
@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const required = this.reflector.getAllAndOverride<string[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!required || required.length === 0) {
      return true;
    }

    const req = context.switchToHttp().getRequest();
    const role = req.user?.role;
    if (role === 'Super Admin' || required.includes(role)) {
      return true;
    }

    throw new ForbiddenException(`Requires role: ${required.join(' or ')}`);
  }
}
