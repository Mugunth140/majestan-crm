import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { HrCandidate } from '../../database/entities/hr-candidate.entity';
import { HrFollowUp } from '../../database/entities/hr-follow-up.entity';
import { HrService } from './hr.service';
import { HrController } from './hr.controller';

@Module({
  imports: [TypeOrmModule.forFeature([HrCandidate, HrFollowUp])],
  controllers: [HrController],
  providers: [HrService],
})
export class HrModule {}
