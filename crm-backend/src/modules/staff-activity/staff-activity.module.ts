import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { StaffActivityController } from './staff-activity.controller';
import { StaffActivityService } from './staff-activity.service';

@Module({
  imports: [AuthModule],
  controllers: [StaffActivityController],
  providers: [StaffActivityService],
})
export class StaffActivityModule {}
