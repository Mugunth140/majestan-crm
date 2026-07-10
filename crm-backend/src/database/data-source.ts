import { DataSource } from 'typeorm';
import * as dotenv from 'dotenv';
dotenv.config({ path: '../.env' }); // Load from root crm directory

export const AppDataSource = new DataSource({
  type: 'mysql',
  host: process.env.DB_HOST || '127.0.0.1', // local access
  port: parseInt(process.env.DB_PORT || '3306'),
  username: process.env.DB_USERNAME || 'root',
  password: process.env.DB_PASSWORD || '8220',
  database: process.env.CRM_DB_NAME || 'majestan_crm',
  entities: ['src/database/entities/*.entity.ts'],
  migrations: ['src/database/migrations/*.ts'],
  synchronize: false,
});
