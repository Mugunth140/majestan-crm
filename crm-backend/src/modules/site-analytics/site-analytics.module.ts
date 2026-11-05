import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { RolesGuard } from '../auth/roles.guard';
import { SiteAnalyticsController } from './site-analytics.controller';
import { SiteAnalyticsService } from './site-analytics.service';

@Module({
  imports: [AuthModule],
  controllers: [SiteAnalyticsController],
  providers: [SiteAnalyticsService, RolesGuard],
})
export class SiteAnalyticsModule {}
