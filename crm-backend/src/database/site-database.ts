import { ConfigService } from '@nestjs/config';
import { TypeOrmModuleOptions } from '@nestjs/typeorm';
import { Property } from './entities/site/property.entity';
import { PropertyDetails } from './entities/site/property-details.entity';
import { PropertyImage } from './entities/site/property-image.entity';
import { PropertyLocation } from './entities/site/property-location.entity';
import { City } from './entities/site/city.entity';
import { Sublocation } from './entities/site/sublocation.entity';

export const SITE_DATA_SOURCE = 'site';

/**
 * The Majestan site database (read-write for properties).
 *
 * `name` must be in these options as well as in `forRootAsync`: on shutdown
 * @nestjs/typeorm finds the DataSource by the factory's options. Without it
 * the lookup throws, the CRM pool is never closed and every deploy stops the
 * container with exit code 1.
 */
export const siteDatabaseOptions = (config: ConfigService): TypeOrmModuleOptions => ({
  name: SITE_DATA_SOURCE,
  type: 'mysql',
  host: config.get<string>('SITE_DB_HOST', config.get<string>('DB_HOST', 'mysql')!),
  port: config.get<number>('SITE_DB_PORT', config.get<number>('DB_PORT', 3306)!),
  username: config.get<string>('SITE_DB_USER', config.get<string>('DB_USERNAME', '')!),
  password: config.get<string>('SITE_DB_PASS', config.get<string>('DB_PASSWORD', '')!),
  database: config.get<string>('SITE_DB_NAME', 'majestan'),
  entities: [Property, PropertyDetails, PropertyImage, PropertyLocation, City, Sublocation],
  synchronize: false,
  logging: false,
  extra: {
    connectionLimit: config.get<number>('DB_CONNECTION_LIMIT_SITE', 5),
    connectTimeout: 10000,
    acquireTimeout: 10000,
  },
});
