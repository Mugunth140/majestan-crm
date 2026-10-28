import { BadRequestException, ConflictException, ForbiddenException } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { MailService } from './mail.service';
import { MailRegistry } from './core/mail-registry.service';
import { MailComposer } from './core/mail-composer.service';
import { MailTriggers } from './core/mail-triggers.service';
import { readMailConfig } from './core/mail-config';
import { defineMailEntity, defineMailEvent } from './core/mail-event';

type Person = { email: string | null; name: string; ready: boolean };

const people = new Map<number, Person>();
const personEntity = defineMailEntity<Person>({
  entityType: 'person', module: 'hr', identity: 'hr', label: 'Person',
  load: async (id) => people.get(id) ?? null,
  recipients: (d) => ({ to: [d.email ?? ''] }),
  variables: (d) => ({ 'person.name': d.name }),
  variableDocs: [{ key: 'person.name', label: 'Name', sample: 'Ravi' }],
});
const welcome = defineMailEvent<Person>({
  key: 'test.welcome', entity: personEntity, label: 'Welcome', description: '',
  mode: 'confirm', version: 1,
  triggers: [{ on: 'person.created' }, { on: 'person.changed', when: (p) => p.to === 'ready' }],
  check: (d) => (d.ready ? [] : ['Not ready']),
  idempotencyKey: (d, id) => `test.welcome:${id}:${d.ready}`,
  template: { subject: 'Hi {{person.name}}', body: '<p>Hello {{person.name}}</p>' },
});

// A record type finance@ may also write to (COMPOSER_SENDERS lists 'lead').
const leadEntity = defineMailEntity<Person>({ ...personEntity, entityType: 'lead', module: 'sales', identity: 'sales', label: 'Lead' });
const leadHello = defineMailEvent<Person>({ ...welcome, key: 'test.lead_hello', entity: leadEntity, triggers: [] });

function setup(opts: { allowed?: boolean; permit?: (permission: string) => boolean } = {}) {
  const rows: any[] = [];
  let nextId = 1;
  const matches = (row: any, where: any) => Object.entries(where).every(([k, v]) => row[k] === v);
  const qbUpdate = (set: any) => ({
    where: (_sql: string, params: any) => ({
      execute: async () => {
        const row = rows.find((r) => r.id === params.id && (params.open ? params.open.includes(r.status) : r.status === 'draft'));
        if (row) Object.assign(row, set);
        return { affected: row ? 1 : 0 };
      },
    }),
  });
  const outbox: any = {
    rows,
    create: (x: any) => x,
    save: async (x: any) => { const row = { id: nextId++, ...x }; rows.push(row); return row; },
    insert: async (x: any) => {
      if (rows.some((r) => r.idempotency_key === x.idempotency_key)) throw Object.assign(new Error('dup'), { code: 'ER_DUP_ENTRY' });
      rows.push({ id: nextId++, attempts: 0, ...x });
    },
    exists: async ({ where }: any) => rows.some((r) => matches(r, where)),
    find: async ({ where }: any) => rows.filter((r) => matches(r, where)).reverse(),
    findOne: async ({ where }: any) => [...rows].reverse().find((r) => matches(r, where)) ?? null,
    findOneBy: async (where: any) => rows.find((r) => matches(r, where)) ?? null,
    update: async (where: any, set: any) => {
      for (const r of rows) if (typeof where === 'number' ? r.id === where : matches(r, where)) Object.assign(r, set);
    },
    createQueryBuilder: () => ({ update: () => ({ set: qbUpdate }) }),
  };
  outbox.manager = { transaction: (fn: any) => fn({ getRepository: () => outbox }) };
  const suppressions: any = { find: async () => [] };
  const registry = new MailRegistry();
  registry.register([welcome, leadHello]);
  const staff: any = { getRepository: () => ({ findOne: async () => ({ id: 9, name: 'Staff Nine', email: null, phone: null }) }) };
  const templates: any = { findOne: async () => null };
  const composer = new MailComposer(staff, suppressions, templates);
  const permissions: any = {
    hasPermission: jest.fn(async (_id: number, permission: string) => (opts.permit ? opts.permit(permission) : opts.allowed ?? true)),
  };
  const claimed: Record<number, number[]> = {};
  const attachments: any = {
    pendingFor: async (ids: number[]) => ids.map((id) => ({ id, filename: `f${id}.pdf`, contentType: 'application/pdf', size: 10 })),
    claim: async (_m: any, ids: number[], _a: number, outboxId: number) => { if (ids.length) claimed[outboxId] = ids; },
    forOutbox: async () => [],
  };
  const service = new MailService(registry, composer, outbox, suppressions, permissions, readMailConfig({}), attachments);
  return { service, rows, registry, claimed };
}

const actor = { id: 9 };

describe('MailService', () => {
  beforeEach(() => people.clear());

  it('creates a draft from a domain event and replaces a stale draft of the same email', async () => {
    const { service, rows, registry } = setup();
    const events = new EventEmitter2();
    new MailTriggers(registry, events, service).onApplicationBootstrap();

    people.set(1, { email: 'Ravi@Example.com', name: 'Ravi', ready: false });
    await events.emitAsync('person.created', { entityId: 1, actorId: 9 });
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ status: 'draft', to_json: ['ravi@example.com'], trigger_source: 'person.created', created_by: 9 });

    await events.emitAsync('person.changed', { entityId: 1, to: 'other' }); // `when` filters it out
    expect(rows).toHaveLength(1);

    people.set(1, { email: 'ravi@example.com', name: 'Ravi', ready: true });
    await events.emitAsync('person.changed', { entityId: 1, to: 'ready' });
    expect(rows.map((r) => r.status)).toEqual(['cancelled', 'draft']);

    await events.emitAsync('person.changed', { entityId: 1, to: 'ready' }); // same content: no duplicate
    expect(rows).toHaveLength(2);
  });

  it('suggests nothing when there is no email address', async () => {
    const { service, rows } = setup();
    people.set(2, { email: null, name: 'No Mail', ready: true });
    await service.createFromTrigger(welcome, { entityId: 2 }, 'person.created');
    expect(rows).toHaveLength(0);
  });

  it('refuses to send while checks fail, and when the content changed after preview', async () => {
    const { service } = setup();
    people.set(3, { email: 'a@x.com', name: 'A', ready: false });
    await expect(service.send('test.welcome', 3, null, null, actor)).rejects.toBeInstanceOf(BadRequestException);

    people.set(3, { email: 'a@x.com', name: 'A', ready: true });
    const preview = await service.preview('test.welcome', 3, null, actor);
    expect(preview.issues).toEqual([]);
    people.set(3, { email: 'a@x.com', name: 'Changed', ready: true });
    await expect(service.send('test.welcome', 3, null, preview.hash, actor)).rejects.toBeInstanceOf(ConflictException);
  });

  it('confirms the open draft instead of creating a second email, keeping the note', async () => {
    const { service, rows } = setup();
    people.set(4, { email: 'b@x.com', name: 'B', ready: true });
    await service.createFromTrigger(welcome, { entityId: 4 }, 'person.created');
    const preview = await service.previewDraft(rows[0].id, 'See you soon', actor);
    const sent = await service.confirm(rows[0].id, 'See you soon', preview.hash, actor);
    expect(rows).toHaveLength(1);
    expect(sent).toMatchObject({ status: 'pending', note: 'See you soon', confirmedBy: 9 });
    expect(rows[0].html).toContain('See you soon');
    await expect(service.confirm(rows[0].id, null, null, actor)).rejects.toBeInstanceOf(BadRequestException);
  });

  it('lets a manual send go out again with a distinct idempotency key', async () => {
    const { service, rows } = setup();
    people.set(5, { email: 'c@x.com', name: 'C', ready: true });
    await service.send('test.welcome', 5, null, null, actor);
    await service.send('test.welcome', 5, null, null, actor);
    expect(rows).toHaveLength(2);
    expect(rows[1].idempotency_key).toMatch(/#resend-/);
  });

  it('requires the module send permission', async () => {
    const { service } = setup({ allowed: false });
    people.set(6, { email: 'd@x.com', name: 'D', ready: true });
    await expect(service.preview('test.welcome', 6, null, actor)).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('sends a staff-written email with fields filled in, cc and attachments', async () => {
    const { service, rows, claimed } = setup();
    people.set(7, { email: 'g@x.com', name: 'Gita', ready: false });
    const input = { entityType: 'person', entityId: 7, subject: 'Hello {{person.name}}', body: '<p>Hi {{person.name}}, see attached.</p>', cc: ['Boss@X.com'], attachmentIds: [3] };
    const pv = await service.composePreview(input, actor);
    expect(pv.subject).toBe('Hello Gita');
    expect(pv.cc).toEqual(['boss@x.com']);
    expect(pv.issues).toEqual([]); // the manual type has no "ready" check
    expect(pv.attachments).toHaveLength(1);
    await expect(service.composeSend({ ...input, attachmentIds: [], hash: pv.hash }, actor)).rejects.toBeInstanceOf(ConflictException);
    const sent = await service.composeSend({ ...input, hash: pv.hash }, actor);
    expect(sent).toMatchObject({ status: 'pending', event: 'manual.person', label: 'Email', triggerSource: 'composer' });
    expect(claimed[sent.id]).toEqual([3]);
    expect(rows[0].html).toContain('Hi Gita, see attached.');
  });

  it('edits a draft in the composer and keeps its checks', async () => {
    const { service, rows } = setup();
    people.set(8, { email: 'h@x.com', name: 'Hari', ready: false });
    await service.createFromTrigger(welcome, { entityId: 8 }, 'person.created');
    const draftId = rows[0].id;
    const input = { entityType: 'person', entityId: 8, subject: 'Edited {{person.name}}', body: '<p>New text</p>', draftId };
    const blocked = await service.composePreview(input, actor);
    expect(blocked.issues).toContain('Not ready');
    people.set(8, { email: 'h@x.com', name: 'Hari', ready: true });
    await expect(service.composePreview({ ...input, entityId: 99 }, actor)).rejects.toThrow('Draft does not belong to this record');
    const pv = await service.composePreview(input, actor);
    await service.composeSend({ ...input, hash: pv.hash }, actor);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ status: 'pending', subject: 'Edited Hari', confirmed_by: 9 });
    await expect(service.composeSend({ ...input, hash: pv.hash }, actor)).rejects.toThrow('This email is no longer a draft');
  });

  it('lets finance@ write to a lead with its own permission, mailbox and signature', async () => {
    const { service, rows, registry } = setup({ permit: (p) => p === 'finance.mail.send' });
    people.set(20, { email: 'buyer@x.com', name: 'Buyer', ready: true });
    expect(registry.senders('lead').map((s) => s.identity)).toEqual(['sales', 'finance']);
    expect(registry.senders('person').map((s) => s.identity)).toEqual(['hr']);

    const catalog = await service.catalog('lead', actor);
    expect(catalog.senders).toEqual([
      expect.objectContaining({ key: 'sales', canSend: false }),
      expect.objectContaining({ key: 'finance', from: 'finance@majestanrealty.com', canSend: true }),
    ]);
    const input = { entityType: 'lead', entityId: 20, subject: 'Receipt', body: '<p>Thanks {{person.name}}</p>' };
    await expect(service.composePreview(input, actor)).rejects.toBeInstanceOf(ForbiddenException); // sales@ by default
    const pv = await service.composePreview({ ...input, sender: 'finance' }, actor);
    expect(pv.from).toBe('Majestan Realty Accounts <finance@majestanrealty.com>');
    expect(pv.html).toContain('Accounts Team, Majestan Realty');
    const sent = await service.composeSend({ ...input, sender: 'finance', hash: pv.hash }, actor);
    expect(sent).toMatchObject({ event: 'manual.lead@finance', label: 'Email from finance@majestanrealty.com' });
    expect(rows[0]).toMatchObject({ identity: 'finance', module: 'finance', entity_type: 'lead' });
    expect(registry.resolve('manual.lead@finance')).toBe(registry.manual('lead', 'finance'));
    await expect(service.history('lead', 20, actor)).resolves.toHaveLength(1); // finance can see the record's emails
    await expect(service.history('person', 20, actor)).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('refuses mailboxes that may not write to a record, and standard emails from another mailbox', async () => {
    const { service, registry } = setup();
    people.set(21, { email: 'p@x.com', name: 'P', ready: true });
    expect(() => registry.manual('person', 'finance')).toThrow(BadRequestException);
    expect(() => registry.manual('lead', 'hr')).toThrow(BadRequestException);
    await expect(service.composePreview({ entityType: 'lead', entityId: 21, subject: 'x', body: '<p>x</p>', eventKey: 'test.lead_hello', sender: 'finance' }, actor))
      .rejects.toThrow('always sent from sales@majestanrealty.com');
  });

  it('blocks sending while "[enter …]" blanks from a template are left in', async () => {
    const { service } = setup();
    people.set(22, { email: 'q@x.com', name: 'Q', ready: true });
    const pv = await service.composePreview({ entityType: 'person', entityId: 22, subject: 'Due [enter date]', body: '<p>Pay <strong>[enter amount]</strong></p>' }, actor);
    expect(pv.issues).toEqual(['Fill in: [enter date], [enter amount]']);
  });

  it('rejects a second registration of the same key', () => {
    const { registry } = setup();
    expect(() => registry.register([{ ...welcome }])).toThrow('registered twice');
  });
});
