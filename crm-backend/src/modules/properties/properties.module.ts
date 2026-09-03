import { Module } from '@nestjs/common';
import { PropertiesService } from './properties.service';
import { SiteApiService } from './site-api.service';
import { PropertiesController } from './properties.controller';
import { AuthModule } from '../auth/auth.module';
import { PermissionsModule } from '../permissions/permissions.module';

@Module({
  imports: [AuthModule, PermissionsModule],
  controllers: [PropertiesController],
  providers: [PropertiesService, SiteApiService],
})
export class PropertiesModule {}
