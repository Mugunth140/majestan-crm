import { Global, Module } from '@nestjs/common';
import { AnalyticsStoreService } from './analytics-store.service';
import { CacheService } from './cache.service';

/** DuckDB analytics copy of the CRM database, plus the shared Valkey cache. */
@Global()
@Module({
  providers: [AnalyticsStoreService, CacheService],
  exports: [AnalyticsStoreService, CacheService],
})
export class AnalyticsModule {}
