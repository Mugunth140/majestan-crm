import { DataSource } from 'typeorm';
import * as dotenv from 'dotenv';
dotenv.config({ path: '../.env' }); // Load from root crm directory

export const AppDataSource = new DataSource({
  type: 'mysql',
  host: process.env.DB_HOST || '127.0.0.1', // local access
  port: parseInt(process.env.DB_PORT || '3306'),
  username: process.env.DB_USERNAME,
  password: process.env.DB_PASSWORD,
  database: process.env.CRM_DB_NAME || 'majestan_crm',
  entities: ['src/database/entities/*.entity.ts'],
  // No TypeORM migrations here by design: all CRM schema changes ship as raw
  // SQL in infra/migrations/ (applied by the db-migrate container against
  // majestan_crm). See infra/migrations/README.md and AGENTS.md.
  migrations: [],
  synchronize: false,
});
