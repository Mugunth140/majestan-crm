import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { HrCandidate } from '../../database/entities/hr-candidate.entity';
import { HrController } from './hr.controller';
import { HrService } from './hr.service';

@Module({
  imports: [TypeOrmModule.forFeature([HrCandidate])],
  controllers: [HrController],
  providers: [HrService],
})
export class HrModule {}
