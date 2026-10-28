import type { DataSource } from 'typeorm';
import type { MailIdentityKey } from '../identities';
import type { MailVariables } from '../render/template';

export type MailMode = 'confirm' | 'auto';

/**
 * Payload convention for domain events that trigger mail:
 * every payload carries the id of the record the mail is about.
 */
export interface DomainEventPayload {
  entityId: number;
  actorId?: number | null;
  [key: string]: unknown;
}

export interface MailContext {
  dataSource: DataSource;
  actorId: number | null;
}

/** Documents one {{variable}} for the template editor's picker. */
export interface MailVariableDoc {
  key: string;
  label: string;
  /** Shown in previews when no real record is used. */
  sample: string;
  /** Pre-built HTML (cards, buttons): insert on its own line. */
  block?: boolean;
}

/**
 * A kind of CRM record emails can be about (candidate, lead, inbound…).
 * Defined once per module; every email type and hand-written email for that
 * record reuses it.
 */
export interface MailEntity<TData = any> {
  entityType: string;
  module: string;
  identity: MailIdentityKey;
  /** e.g. "Candidate", used in the UI. */
  label: string;
  load(entityId: number, ctx: MailContext): Promise<TData | null>;
  recipients(data: TData): { to: string[]; cc?: string[] };
  /** Values for {{variables}}: plain text is escaped, SafeHtml blocks are inserted as-is. */
  variables(data: TData): MailVariables;
  variableDocs: MailVariableDoc[];
  /**
   * Where sent emails appear in the record's contact activity: the module's
   * contact-log table and its record-id column. Every table has contact_type,
   * subject, message, sent_by_id and a unique source_call_id.
   */
  contactLog?: { table: string; column: string };
}

export const defineMailEntity = <TData>(entity: MailEntity<TData>) => entity;

/** A subject/body pair with {{variables}}. The body is email-safe HTML. */
export interface MailTemplateSource {
  subject: string;
  body: string;
  preheader?: string;
}

/** For automatic emails sent on a timetable (e.g. a reminder the day before a visit). */
export interface MailSchedule {
  /** How often to look for records that are due. */
  everyMinutes: number;
  /** Ids of records that should get this email now; idempotency keys stop repeats. */
  due(ctx: { dataSource: DataSource; now: Date }): Promise<number[]>;
  /** Cancel instead of sending if it couldn't go out within this many hours. */
  expiresAfterHours: number;
}

export interface MailTrigger {
  on: string;
  when?: (payload: DomainEventPayload) => boolean;
}

/** What a module writes to add an email type. */
export interface MailEventSpec<TData = any> {
  key: string;
  entity: MailEntity<TData>;
  label: string;
  description: string;
  mode: MailMode;
  version: number;
  triggers?: MailTrigger[];
  /** Only for mode 'auto': run on a timetable instead of (or as well as) triggers. */
  schedule?: MailSchedule;
  /** Blocking problems shown in the preview ("Interview time is not set"). */
  check?(data: TData): string[];
  /** Same key = same mail. Prevents duplicates when a status is saved twice. */
  idempotencyKey(data: TData, entityId: number): string;
  /** Default wording; admins can override it in Settings → Email templates. */
  template: MailTemplateSource;
}

/** A registered email type: the spec plus the entity fields the core needs directly. */
export interface MailEventDefinition<TData = any> extends MailEventSpec<TData> {
  module: string;
  entityType: string;
  identity: MailIdentityKey;
  load: MailEntity<TData>['load'];
  recipients: MailEntity<TData>['recipients'];
}

export function defineMailEvent<TData>(spec: MailEventSpec<TData>): MailEventDefinition<TData> {
  return {
    ...spec,
    module: spec.entity.module,
    entityType: spec.entity.entityType,
    identity: spec.entity.identity,
    load: spec.entity.load,
    recipients: spec.entity.recipients,
  };
}

/** Removes empty/duplicate addresses and lowercases them. */
export function cleanAddresses(values: (string | null | undefined)[]): string[] {
  return [...new Set(values.map((v) => (v ?? '').trim().toLowerCase()).filter((v) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)))];
}
