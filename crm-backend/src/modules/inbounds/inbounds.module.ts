import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { InboundsService } from './inbounds.service';
import { InboundsController } from './inbounds.controller';
import { Inbound } from '../../database/entities/inbound.entity';
import { InboundFollowUp } from '../../database/entities/inbound-follow-up.entity';
import { InboundContactLog } from '../../database/entities/inbound-contact-log.entity';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [TypeOrmModule.forFeature([Inbound, InboundFollowUp, InboundContactLog]), AuthModule],
  controllers: [InboundsController],
  providers: [InboundsService],
  exports: [InboundsService],
})
export class InboundsModule {}
