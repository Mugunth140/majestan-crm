import { Injectable, CanActivate, ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { Request } from 'express';
import { DataSource } from 'typeorm';

/**
 * JWT authentication guard.
 * Verifies Bearer tokens and sets req.user = { id, sub, email, role }.
 * Import AuthModule in any module that uses this guard.
 */
@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly jwtService: JwtService,
    private readonly config: ConfigService,
    private readonly dataSource: DataSource,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest<Request>();
    let token = '';
    const authHeader = req.headers['authorization'];

    if (authHeader?.startsWith('Bearer ')) {
      token = authHeader.slice(7);
    } else if (req.query?.token && typeof req.query.token === 'string') {
      token = req.query.token;
    }

    if (!token) {
      throw new UnauthorizedException('Missing or invalid Authorization token');
    }
    let payload: any;
    try {
      payload = this.jwtService.verify(token, {
        secret: this.config.get<string>('JWT_SECRET'),
      });
    } catch {
      throw new UnauthorizedException('Invalid or expired token');
    }

    if (!payload?.sub) {
      throw new UnauthorizedException('Invalid token payload');
    }

    // Fast active check
    const rows = await this.dataSource.query('SELECT is_active, role_id FROM users WHERE id = ?', [payload.sub]);
    if (!rows || rows.length === 0 || rows[0].is_active !== 1) {
      throw new UnauthorizedException('User account is deactivated');
    }

    // Attach to request so controllers can read req.user
    (req as any).user = {
      id: payload.sub,
      sub: payload.sub,
      email: payload.email,
      role: payload.role,
      department_id: payload.department_id,
    };

    return true;
  }
}
