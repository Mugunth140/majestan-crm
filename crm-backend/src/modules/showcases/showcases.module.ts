import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { PropertiesModule } from '../properties/properties.module';
import { AdsAccessGuard } from '../ads/ads-access.guard';
import { ShowcasesController } from './showcases.controller';
import { ShowcasesService } from './showcases.service';

@Module({
  imports: [AuthModule, PropertiesModule],
  controllers: [ShowcasesController],
  providers: [ShowcasesService, AdsAccessGuard],
})
export class ShowcasesModule {}
