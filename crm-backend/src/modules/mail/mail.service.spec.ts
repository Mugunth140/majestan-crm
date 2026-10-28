import { BadRequestException, ConflictException, ForbiddenException } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { MailService } from './mail.service';
import { MailRegistry } from './core/mail-registry.service';
import { MailComposer } from './core/mail-composer.service';
import { MailTriggers } from './core/mail-triggers.service';
import { readMailConfig } from './core/mail-config';
import { defineMailEvent } from './core/mail-event';

type Person = { email: string | null; name: string; ready: boolean };

const people = new Map<number, Person>();
const welcome = defineMailEvent<Person>({
  key: 'test.welcome', module: 'hr', entityType: 'person', identity: 'hr', label: 'Welcome', description: '',
  mode: 'confirm', version: 1,
  triggers: [{ on: 'person.created' }, { on: 'person.changed', when: (p) => p.to === 'ready' }],
  load: async (id) => people.get(id) ?? null,
  recipients: (d) => ({ to: [d.email ?? ''] }),
  check: (d) => (d.ready ? [] : ['Not ready']),
  idempotencyKey: (d, id) => `test.welcome:${id}:${d.ready}`,
  render: (d, { layout, html }) => layout({ subject: `Hi ${d.name}`, body: html`<p>${d.name}</p>`, text: d.name }),
});

function setup(opts: { allowed?: boolean } = {}) {
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
    findOne: async ({ where }: any) => [...rows].reverse().find((r) => matches(r, where)) ?? null,
    findOneBy: async (where: any) => rows.find((r) => matches(r, where)) ?? null,
    update: async (where: any, set: any) => {
      for (const r of rows) if (typeof where === 'number' ? r.id === where : matches(r, where)) Object.assign(r, set);
    },
    createQueryBuilder: () => ({ update: () => ({ set: qbUpdate }) }),
  };
  const suppressions: any = { find: async () => [] };
  const registry = new MailRegistry();
  registry.register([welcome]);
  const composer = new MailComposer({} as any, suppressions);
  const permissions: any = { hasPermission: jest.fn().mockResolvedValue(opts.allowed ?? true) };
  const service = new MailService(registry, composer, outbox, suppressions, permissions, readMailConfig({}));
  return { service, rows, registry };
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

  it('rejects a second registration of the same key', () => {
    const { registry } = setup();
    expect(() => registry.register([{ ...welcome }])).toThrow('registered twice');
  });
});
