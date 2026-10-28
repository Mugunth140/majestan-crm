import { DynamicModule, Global, Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MailOutbox } from '../../database/entities/mail-outbox.entity';
import { MailSuppression } from '../../database/entities/mail-suppression.entity';
import { AuthModule } from '../auth/auth.module';
import { PermissionsModule } from '../permissions/permissions.module';
import { readMailConfig } from './core/mail-config';
import { MailComposer } from './core/mail-composer.service';
import { MailDispatcher } from './core/mail-dispatcher.service';
import { type MailEventDefinition } from './core/mail-event';
import { MailRegistry } from './core/mail-registry.service';
import { MAIL_CONFIG, MailTransports } from './core/mail-transports.service';
import { MailTriggers } from './core/mail-triggers.service';
import { MailController } from './mail.controller';
import { MailService } from './mail.service';

/** Holds a module's mail events; created by MailModule.forFeature(). */
@Module({})
export class MailFeatureModule {}

/**
 * Central mail service (docs/mail-service-design.md). Imported once in AppModule;
 * feature modules add their emails with MailModule.forFeature([...definitions]).
 */
@Global()
@Module({
  imports: [TypeOrmModule.forFeature([MailOutbox, MailSuppression]), PermissionsModule, AuthModule],
  controllers: [MailController],
  providers: [
    { provide: MAIL_CONFIG, useFactory: () => readMailConfig() },
    MailRegistry,
    MailComposer,
    MailTransports,
    MailDispatcher,
    MailService,
    MailTriggers,
  ],
  exports: [MailRegistry, MailService],
})
export class MailModule {
  static forFeature(definitions: MailEventDefinition[]): DynamicModule {
    // The token carries the keys so two forFeature() calls are distinct modules.
    const token = `MAIL_EVENTS:${definitions.map((d) => d.key).join(',')}`;
    return {
      module: MailFeatureModule,
      providers: [{ provide: token, useFactory: (registry: MailRegistry) => (registry.register(definitions), true), inject: [MailRegistry] }],
    };
  }
}
