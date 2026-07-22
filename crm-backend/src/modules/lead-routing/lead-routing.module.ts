import { Module } from '@nestjs/common';
import { LeadRoutingController } from './lead-routing.controller';
import { LeadRoutingService } from './lead-routing.service';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
  imports: [NotificationsModule],
  controllers: [LeadRoutingController],
  providers: [LeadRoutingService],
  exports: [LeadRoutingService],
})
export class LeadRoutingModule {}
