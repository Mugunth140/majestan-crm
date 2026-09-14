import { Module } from '@nestjs/common';
import { MasterController } from './master.controller';
import { MasterService } from './master.service';
import { AuthModule } from '../auth/auth.module';
import { PropertiesModule } from '../properties/properties.module';

@Module({
  imports: [AuthModule, PropertiesModule],
  controllers: [MasterController],
  providers: [MasterService],
  exports: [MasterService],
})
export class MasterModule {}
