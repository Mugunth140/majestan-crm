import { Test } from '@nestjs/testing';
import { Reflector } from '@nestjs/core';
import {
  INestApplication,
  UnauthorizedException,
  type ExecutionContext,
} from '@nestjs/common';
import request from 'supertest';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { SiteAnalyticsController } from './site-analytics.controller';
import { SiteAnalyticsService } from './site-analytics.service';

describe('site analytics access over local HTTP', () => {
  let app: INestApplication;
  const service = {
    report: jest.fn().mockResolvedValue({ overview: { visitors: 2 } }),
    compare: jest.fn().mockResolvedValue({}),
    status: jest.fn().mockResolvedValue({ enabled: true }),
  };
  beforeAll(async () => {
    const module = await Test.createTestingModule({
      controllers: [SiteAnalyticsController],
      providers: [
        Reflector,
        RolesGuard,
        { provide: SiteAnalyticsService, useValue: service },
      ],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({
        canActivate(context: ExecutionContext) {
          const req = context.switchToHttp().getRequest<{
            headers: Record<string, string>;
            user: { role: string };
          }>();
          const role = req.headers['x-test-role'];
          if (!role) throw new UnauthorizedException();
          req.user = { role };
          return true;
        },
      })
      .compile();
    app = module.createNestApplication();
    await app.init();
  });
  afterAll(async () => {
    await app.close();
  });
  it.each(['Admin', 'Super Admin', 'Manager'])('permits %s', async (role) => {
    await request(app.getHttpServer())
      .get('/api/v1/site-analytics/report?from=2026-11-01&to=2026-11-08')
      .set('x-test-role', role)
      .expect(200);
  });
  it.each(['Team Lead', 'Staff', 'Unknown'])(
    'rejects %s on every endpoint',
    async (role) => {
      for (const endpoint of ['report', 'compare', 'status'])
        await request(app.getHttpServer())
          .get(`/api/v1/site-analytics/${endpoint}`)
          .set('x-test-role', role)
          .expect(403);
    },
  );
  it('requires authentication', async () => {
    await request(app.getHttpServer())
      .get('/api/v1/site-analytics/status')
      .expect(401);
  });
});
