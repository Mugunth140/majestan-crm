import { Module } from '@nestjs/common';
import { PropertiesService } from './properties.service';
import { SiteApiService } from './site-api.service';
import { PropertiesController } from './properties.controller';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [AuthModule],
  controllers: [PropertiesController],
  providers: [PropertiesService, SiteApiService],
})
export class PropertiesModule {}
