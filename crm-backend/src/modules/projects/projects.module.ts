import { Module } from '@nestjs/common';
import { ProjectsService } from './projects.service';
import { ProjectsController } from './projects.controller';
import { PropertiesModule } from '../properties/properties.module';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [PropertiesModule, AuthModule],
  controllers: [ProjectsController],
  providers: [ProjectsService],
})
export class ProjectsModule {}
