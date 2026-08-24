import { SetMetadata } from '@nestjs/common';

export const ROLES_KEY = 'roles';

/**
 * Restricts a route (or controller) to the given role names.
 * 'Super Admin' always passes regardless of this list.
 * Must be combined with RolesGuard, e.g.:
 *   @UseGuards(JwtAuthGuard, RolesGuard)
 *   @Roles('Admin')
 */
export const Roles = (...roles: string[]) => SetMetadata(ROLES_KEY, roles);
