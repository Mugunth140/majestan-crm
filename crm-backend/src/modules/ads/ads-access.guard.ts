import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';

const ADMIN_ROLES = new Set(['Admin', 'Super Admin', 'Manager']);

export function isDesignDepartment(name: unknown): boolean {
  return typeof name === 'string' && /design/i.test(name);
}

/**
 * Ads management: Admin/Manager by role, everyone else only via the
 * designing department (resolved from department_id — the JWT carries no
 * department name). Future escape hatch: an `ads.manage` grant.
 */
@Injectable()
export class AdsAccessGuard implements CanActivate {
  // Raw DataSource (no forFeature needed) — same pattern as AdminTableService
  // on the site backend.
  constructor(@InjectDataSource() private readonly dataSource: DataSource) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest();
    const user = req.user ?? {};
    if (ADMIN_ROLES.has(user.role)) return true;
    if (typeof user.department_id !== 'number') {
      throw new ForbiddenException('Ads access requires Admin, Manager, or Designing department');
    }
    const rows = await this.dataSource.query('SELECT name FROM departments WHERE id = ? LIMIT 1', [
      user.department_id,
    ]);
    if (isDesignDepartment(rows?.[0]?.name)) return true;
    throw new ForbiddenException('Ads access requires Admin, Manager, or Designing department');
  }
}
