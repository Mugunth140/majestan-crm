import { ConfigService } from '@nestjs/config';
import { getDataSourceToken } from '@nestjs/typeorm';
import { DataSource, DataSourceOptions } from 'typeorm';
import { SITE_DATA_SOURCE, siteDatabaseOptions } from './site-database';

it('names the site connection in the factory options, so shutdown can find and close it', () => {
  const options = siteDatabaseOptions(new ConfigService({})) as DataSourceOptions;
  // TypeOrmCoreModule.onApplicationShutdown looks the DataSource up with these options.
  expect(getDataSourceToken(options)).toBe(getDataSourceToken(SITE_DATA_SOURCE));
  expect(getDataSourceToken(options)).not.toBe(DataSource);
});
