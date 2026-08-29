import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PropertiesService } from './properties.service';
import { PropertiesController } from './properties.controller';
import { Property } from '../../database/entities/site/property.entity';
import { PropertyDetails } from '../../database/entities/site/property-details.entity';
import { PropertyImage } from '../../database/entities/site/property-image.entity';
import { PropertyLocation } from '../../database/entities/site/property-location.entity';
import { City } from '../../database/entities/site/city.entity';
import { Sublocation } from '../../database/entities/site/sublocation.entity';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [
    TypeOrmModule.forFeature(
      [Property, PropertyDetails, PropertyImage, PropertyLocation, City, Sublocation],
      'site',
    ),
    AuthModule,
  ],
  controllers: [PropertiesController],
  providers: [PropertiesService],
})
export class PropertiesModule {}
