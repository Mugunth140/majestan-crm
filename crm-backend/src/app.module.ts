import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AppController } from './app.controller';
import { AppService } from './app.service';

// Modules
import { AuthModule } from './modules/auth/auth.module';
import { UsersModule } from './modules/users/users.module';
import { RolesModule } from './modules/roles/roles.module';
import { PermissionsModule } from './modules/permissions/permissions.module';
import { DepartmentsModule } from './modules/departments/departments.module';
import { ActivityLogsModule } from './modules/activity-logs/activity-logs.module';
import { HealthModule } from './modules/health/health.module';
import { MasterModule } from './modules/master/master.module';
import { LeadsModule } from './modules/leads/leads.module';

import { ActivityLog } from './database/entities/activity-log.entity';
import { Department } from './database/entities/department.entity';
import { Permission } from './database/entities/permission.entity';
import { RolePermission } from './database/entities/role-permission.entity';
import { Role } from './database/entities/role.entity';
import { User } from './database/entities/user.entity';
import { LeadStatus } from './database/entities/lead-status.entity';
import { LeadSource } from './database/entities/lead-source.entity';
import { Lead } from './database/entities/lead.entity';
import { LeadInquiry } from './database/entities/lead-inquiry.entity';
import { LeadFollowUp } from './database/entities/lead-follow-up.entity';
import { ContactLog } from './database/entities/contact-log.entity';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
    }),

    // Connection 1: CRM Database (Default)
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        type: 'mysql',
        host: configService.get<string>('DB_HOST', 'mysql'),
        port: configService.get<number>('DB_PORT', 3306),
        username: configService.get<string>('DB_USERNAME', 'root'),
        password: configService.get<string>('DB_PASSWORD', '8220'),
        database: configService.get<string>('CRM_DB_NAME', 'majestan_crm'),
        entities: [User, Role, Permission, RolePermission, Department, ActivityLog, LeadStatus, LeadSource, Lead, LeadInquiry, LeadFollowUp, ContactLog],
        synchronize: true, // DEV ONLY
      }),
    }),

    // Connection 2: Majestan Site Database (Read-Only)
    TypeOrmModule.forRootAsync({
      name: 'siteConnection',
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        type: 'mysql',
        host: configService.get<string>('DB_HOST', 'mysql'),
        port: configService.get<number>('DB_PORT', 3306),
        username: configService.get<string>('DB_USERNAME', 'root'),
        password: configService.get<string>('DB_PASSWORD', '8220'),
        database: configService.get<string>('SITE_DB_NAME', 'majestan'),
        entities: [],
        synchronize: false,
      }),
    }),

    // Business Modules
    AuthModule,
    UsersModule,
    RolesModule,
    PermissionsModule,
    DepartmentsModule,
    ActivityLogsModule,
    HealthModule,
    MasterModule,
    LeadsModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
