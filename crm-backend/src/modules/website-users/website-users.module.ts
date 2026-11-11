import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { PermissionsModule } from '../permissions/permissions.module';
import { WebsiteUsersController } from './website-users.controller';
import { WebsiteUsersService } from './website-users.service';

@Module({
  imports: [AuthModule, PermissionsModule],
  controllers: [WebsiteUsersController],
  providers: [WebsiteUsersService],
})
export class WebsiteUsersModule {}
