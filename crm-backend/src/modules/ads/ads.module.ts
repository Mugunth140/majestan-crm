import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { PropertiesModule } from '../properties/properties.module';
import { AdsAccessGuard } from './ads-access.guard';
import { AdsController } from './ads.controller';
import { AdsService } from './ads.service';

@Module({
  imports: [AuthModule, PropertiesModule],
  controllers: [AdsController],
  providers: [AdsService, AdsAccessGuard],
})
export class AdsModule {}
