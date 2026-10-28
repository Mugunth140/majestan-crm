import type { DataSource } from 'typeorm';
import type { LayoutInput, RenderedMail } from '../render/layout';
import type { html, safeUrl } from '../render/html';
import type { MailIdentityKey } from '../identities';

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

export interface RenderContext {
  layout: (input: LayoutInput) => RenderedMail;
  html: typeof html;
  safeUrl: typeof safeUrl;
}

export interface MailTrigger {
  on: string;
  when?: (payload: DomainEventPayload) => boolean;
}

/** One kind of email. A module adds an email by writing one of these. */
export interface MailEventDefinition<TData = any> {
  key: string;
  module: string;
  entityType: string;
  identity: MailIdentityKey;
  label: string;
  description: string;
  mode: MailMode;
  version: number;
  triggers?: MailTrigger[];
  load(entityId: number, ctx: MailContext): Promise<TData | null>;
  recipients(data: TData): { to: string[]; cc?: string[] };
  check?(data: TData): string[];
  idempotencyKey(data: TData, entityId: number): string;
  render(data: TData, ctx: RenderContext): RenderedMail;
}

export const defineMailEvent = <TData>(definition: MailEventDefinition<TData>) => definition;

/** Removes empty/duplicate addresses and lowercases them. */
export function cleanAddresses(values: (string | null | undefined)[]): string[] {
  return [...new Set(values.map((v) => (v ?? '').trim().toLowerCase()).filter((v) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)))];
}
