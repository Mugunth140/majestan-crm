import { Module } from '@nestjs/common';
import { MiddlewareConsumer, NestModule } from '@nestjs/common';
import { CorrelationIdMiddleware } from './common/middleware/correlation-id.middleware';
import pinoHttp from 'pino-http';

import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { EventEmitterModule } from '@nestjs/event-emitter';
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
import { AgentsModule } from './modules/agents/agents.module';
import { InboundsModule } from './modules/inbounds/inbounds.module';
import { HrModule } from './modules/hr/hr.module';
import { AssetsModule } from './modules/assets/assets.module';
import { LeadRoutingModule } from './modules/lead-routing/lead-routing.module';
import { NotificationsModule } from './modules/notifications/notifications.module';
import { ContactLogsModule } from './modules/contact-logs/contact-logs.module';
import { TasksModule } from './modules/tasks/tasks.module';
import { PropertiesModule } from './modules/properties/properties.module';

import { ActivityLog } from './database/entities/activity-log.entity';
import { Department } from './database/entities/department.entity';
import { Permission } from './database/entities/permission.entity';
import { RolePermission } from './database/entities/role-permission.entity';
import { UserPermission } from './database/entities/user-permission.entity';
import { Role } from './database/entities/role.entity';
import { User } from './database/entities/user.entity';
import { LeadSource } from './database/entities/lead-source.entity';
import { Lead } from './database/entities/lead.entity';
import { LeadInquiry } from './database/entities/lead-inquiry.entity';
import { LeadFollowUp } from './database/entities/lead-follow-up.entity';
import { LeadDocument } from './database/entities/lead-document.entity';
import { ContactLog } from './database/entities/contact-log.entity';
import { Agent } from './database/entities/agent.entity';
import { AgentFollowUp } from './database/entities/agent-follow-up.entity';
import { AgentContactLog } from './database/entities/agent-contact-log.entity';
import { Inbound } from './database/entities/inbound.entity';
import { InboundFollowUp } from './database/entities/inbound-follow-up.entity';
import { InboundContactLog } from './database/entities/inbound-contact-log.entity';
import { HrCandidate } from './database/entities/hr-candidate.entity';
import { HrFollowUp } from './database/entities/hr-follow-up.entity';
import { HrContactLog } from './database/entities/hr-contact-log.entity';
import { AssetContactLog } from './database/entities/asset-contact-log.entity';
import { Asset } from './database/entities/asset.entity';
import { AssetLocation } from './database/entities/asset-location.entity';
import { AssetFinancials } from './database/entities/asset-financials.entity';
import { AssetFeature } from './database/entities/asset-feature.entity';
import { AssetDocument } from './database/entities/asset-document.entity';
import { AssetLayout } from './database/entities/asset-layout.entity';
import { RoutingHistory } from './database/entities/routing-history.entity';
import { Notification } from './database/entities/notification.entity';
import { TaskTemplate } from './database/entities/task-template.entity';
import { TaskMetricTarget } from './database/entities/task-metric-target.entity';
import { TaskMetricProgress } from './database/entities/task-metric-progress.entity';
import { TaskActivityLog } from './database/entities/task-activity-log.entity';
import { TaskReceipt } from './database/entities/task-receipt.entity';

// Site entities
import { Property } from './database/entities/site/property.entity';
import { PropertyDetails } from './database/entities/site/property-details.entity';
import { PropertyImage } from './database/entities/site/property-image.entity';
import { PropertyLocation } from './database/entities/site/property-location.entity';
import { City } from './database/entities/site/city.entity';
import { Sublocation } from './database/entities/site/sublocation.entity';
import { MailModule } from './modules/mail/mail.module';
import { CommunicationsModule } from './modules/communications/communications.module';

@Module({
  imports: [
    EventEmitterModule.forRoot(),
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
        username: configService.get<string>('DB_USERNAME'),
        password: configService.get<string>('DB_PASSWORD'),
        database: configService.get<string>('CRM_DB_NAME', 'majestan_crm'),
        entities: [User, Role, Permission, RolePermission, UserPermission, Department, ActivityLog, LeadSource, Lead, LeadInquiry, LeadFollowUp, LeadDocument, ContactLog, Agent, AgentFollowUp, AgentContactLog, Inbound, InboundFollowUp, InboundContactLog, HrCandidate, HrFollowUp, HrContactLog, AssetLayout, Asset, AssetLocation, AssetFinancials, AssetFeature, AssetDocument, AssetContactLog, RoutingHistory, Notification, TaskTemplate, TaskMetricTarget, TaskMetricProgress, TaskActivityLog, TaskReceipt],
        synchronize: false, // Migrations are used instead
        extra: {
          connectionLimit: configService.get<number>('DB_CONNECTION_LIMIT', 25),
          connectTimeout: 10000,
          acquireTimeout: 10000,
        },
      }),
    }),

    // Connection 2: Majestan Site Database (Read-Write for Properties)
    TypeOrmModule.forRootAsync({
      name: 'site',
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        type: 'mysql',
        host: configService.get<string>('SITE_DB_HOST', configService.get<string>('DB_HOST', 'mysql')!),
        port: configService.get<number>('SITE_DB_PORT', configService.get<number>('DB_PORT', 3306)!),
        username: configService.get<string>('SITE_DB_USER', configService.get<string>('DB_USERNAME', '')!),
        password: configService.get<string>('SITE_DB_PASS', configService.get<string>('DB_PASSWORD', '')!),
        database: configService.get<string>('SITE_DB_NAME', 'majestan'),
        entities: [Property, PropertyDetails, PropertyImage, PropertyLocation, City, Sublocation],
        synchronize: false,
        logging: false,
        extra: {
          connectionLimit: configService.get<number>('DB_CONNECTION_LIMIT_SITE', 5),
          connectTimeout: 10000,
          acquireTimeout: 10000,
        },
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
    AgentsModule,
    InboundsModule,
    HrModule,
    AssetsModule,
    LeadRoutingModule,
    NotificationsModule,
    ContactLogsModule,
    TasksModule,
    PropertiesModule,
    MailModule,
    CommunicationsModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(CorrelationIdMiddleware).forRoutes('*');
    consumer.apply(pinoHttp({
      customProps: (req: any, res: any) => ({
        reqId: (req as any).id,
      }),
      autoLogging: {
        ignore: (req: any) => req.url?.includes('health') || false,
      }
    })).forRoutes('*');
  }
}
