import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { PermissionsModule } from '../permissions/permissions.module';
import { InboundsModule } from '../inbounds/inbounds.module';
import { AssetsModule } from '../assets/assets.module';
import { PropertiesModule } from '../properties/properties.module';
import { ProjectsModule } from '../projects/projects.module';
import { BuildersModule } from '../builders/builders.module';
import { SearchController } from './search.controller';
import { SearchService } from './search.service';

@Module({
  imports: [AuthModule, PermissionsModule, InboundsModule, AssetsModule, PropertiesModule, ProjectsModule, BuildersModule],
  controllers: [SearchController],
  providers: [SearchService],
})
export class SearchModule {}
