import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { InboundsService } from './inbounds.service';
import { InboundsController } from './inbounds.controller';
import { Inbound } from '../../database/entities/inbound.entity';
import { InboundFollowUp } from '../../database/entities/inbound-follow-up.entity';
import { InboundContactLog } from '../../database/entities/inbound-contact-log.entity';
import { InboundUnit } from '../../database/entities/inbound-unit.entity';
import { AuthModule } from '../auth/auth.module';
import { PermissionsModule } from '../permissions/permissions.module';
import { MailModule } from '../mail/mail.module';
import { LISTING_MAIL_EVENTS } from './mail/listing-mails';

@Module({
  imports: [TypeOrmModule.forFeature([Inbound, InboundFollowUp, InboundContactLog, InboundUnit]), AuthModule, PermissionsModule, MailModule.forFeature(LISTING_MAIL_EVENTS)],
  controllers: [InboundsController],
  providers: [InboundsService],
  exports: [InboundsService],
})
export class InboundsModule {}
