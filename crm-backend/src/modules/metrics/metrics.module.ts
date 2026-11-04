import { Module } from '@nestjs/common';
import { MetricsController } from './metrics.controller';
import { MetricsService } from './metrics.service';
import { CoachingService } from './coaching.service';
import { AuthModule } from '../auth/auth.module';
@Module({ imports: [AuthModule], controllers: [MetricsController], providers: [MetricsService, CoachingService] })
export class MetricsModule {}
