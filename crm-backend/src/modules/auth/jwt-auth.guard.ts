import { Injectable, CanActivate, ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { Request } from 'express';

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
  ) {}

  canActivate(context: ExecutionContext): boolean {
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
