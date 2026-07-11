import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { InboundsService } from './inbounds.service';
import { InboundsController } from './inbounds.controller';
import { Inbound } from '../../database/entities/inbound.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Inbound])],
  controllers: [InboundsController],
  providers: [InboundsService],
  exports: [InboundsService],
})
export class InboundsModule {}
