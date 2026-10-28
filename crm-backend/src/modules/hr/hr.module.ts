import { User } from '../../database/entities/user.entity';
import { MasterModule } from '../master/master.module';
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { HrCandidate } from '../../database/entities/hr-candidate.entity';
import { HrFollowUp } from '../../database/entities/hr-follow-up.entity';
import { HrContactLog } from '../../database/entities/hr-contact-log.entity';
import { HrService } from './hr.service';
import { HrController } from './hr.controller';
import { AuthModule } from '../auth/auth.module';
import { MailModule } from '../mail/mail.module';
import { HR_MAIL_EVENTS } from './mail';

@Module({
  imports: [TypeOrmModule.forFeature([HrCandidate, HrFollowUp, HrContactLog, User]), AuthModule, MasterModule, MailModule.forFeature(HR_MAIL_EVENTS)],
  controllers: [HrController],
  providers: [HrService],
})
export class HrModule {}
