import { Module } from '@nestjs/common';
import { BuildersService } from './builders.service';
import { BuildersController } from './builders.controller';
import { PropertiesModule } from '../properties/properties.module';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [PropertiesModule, AuthModule],
  controllers: [BuildersController],
  providers: [BuildersService],
  exports: [BuildersService],
})
export class BuildersModule {}
