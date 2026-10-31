import { Injectable, OnApplicationBootstrap } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';

/** The site API migrates its schema, but the selector reads the separate CRM
 * registry. Insert missing values only; preserve staff labels/active settings. */
@Injectable()
export class PropertyTypeRegistryService implements OnApplicationBootstrap {
  constructor(@InjectDataSource() private readonly db: DataSource) {}
  async onApplicationBootstrap(): Promise<void> {
    await this.db.query(
      'INSERT IGNORE INTO property_types (name, value, is_active) VALUES (?, ?, 1), (?, ?, 1), (?, ?, 1)',
      ['Investment Property', 'investment_property', 'PG / Service Apartment', 'pg_service_apartment', 'Farm House', 'farm_house'],
    );
  }
}
