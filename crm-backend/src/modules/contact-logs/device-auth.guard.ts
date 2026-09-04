import { CanActivate, ExecutionContext, ForbiddenException, Injectable, UnauthorizedException } from '@nestjs/common';
import { DataSource } from 'typeorm';
import * as bcrypt from 'bcrypt';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

/**
 * Logger authentication: device secret OR staff JWT (either suffices).
 *
 * - Device headers (X-Device-Id + X-Device-Secret): long-lived, scoped to
 *   logger endpoints, sliding 30-day expiry. Used by the background app so
 *   staff never re-login.
 * - Otherwise delegates to JwtAuthGuard (Bearer token), preserving the
 *   existing PWA/admin behavior.
 *
 * Failure modes: 401 for unknown/expired/invalid secret (transient — keep
 * retrying), 403 'device_revoked' for admin-revoked devices (wipe + stop).
 */
@Injectable()
export class DeviceAuthGuard implements CanActivate {
  constructor(
    private readonly dataSource: DataSource,
    private readonly jwtAuthGuard: JwtAuthGuard,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest();
    const deviceId = req.headers['x-device-id'];
    const secret = req.headers['x-device-secret'];
    if (!deviceId || !secret) {
      return this.jwtAuthGuard.canActivate(context);
    }

    const rows = await this.dataSource.query(
      `SELECT s.user_id, s.secret_hash, s.revoked_at, s.expires_at, u.is_active
       FROM logger_device_secrets s
       JOIN users u ON u.id = s.user_id
       WHERE s.device_id = ?`,
      [deviceId],
    );
    const row = rows?.[0];
    if (!row) {
      throw new UnauthorizedException('Unknown device');
    }
    if (row.is_active !== 1) {
      // User account was deactivated by an admin. Return 403 so the Android
      // worker treats this like device_revoked and stops retrying (a 401 here
      // would loop indefinitely with backoff).
      throw new ForbiddenException('account_deactivated');
    }
    if (row.revoked_at) {
      throw new ForbiddenException('device_revoked');
    }
    if (new Date(row.expires_at).getTime() <= Date.now()) {
      throw new UnauthorizedException('Device secret expired');
    }
    const ok = await bcrypt.compare(secret, row.secret_hash);
    if (!ok) {
      throw new UnauthorizedException('Invalid device secret');
    }

    // Sliding window: every successful use pushes expiry out 30 days.
    await this.dataSource.query(
      `UPDATE logger_device_secrets
       SET last_used_at = NOW(6), expires_at = DATE_ADD(NOW(6), INTERVAL 30 DAY)
       WHERE device_id = ?`,
      [deviceId],
    );

    req.user = { id: Number(row.user_id), sub: Number(row.user_id) };
    return true;
  }
}
