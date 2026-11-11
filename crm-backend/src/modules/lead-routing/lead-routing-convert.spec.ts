import { BadRequestException } from '@nestjs/common';
import { LeadRoutingService } from './lead-routing.service';

jest.mock('bun', () => ({ S3Client: class {} }), { virtual: true });

/** An in-memory store keyed by entity name, enough for convertLead. */
function setup(lead: Record<string, unknown>, agents: any[] = []) {
  const users = [{ id: 9, role: { name: 'Staff' } }, { id: 1, role: { name: 'Admin' } }];
  const rows: Record<string, any[]> = { User: users, Lead: [lead], Agent: agents, AgentFollowUp: [], Inbound: [], InboundFollowUp: [], RoutingHistory: [] };
  let nextId = 100;
  const nameOf = (x: any) => x?.__entity;
  const repoFor = (entity: any) => ({
    findOne: async ({ where }: any) => rows[entity.name].find((r) => Object.entries(where).every(([k, v]) => r[k] === v)) ?? null,
    create: (x: any) => ({ ...x, __entity: entity.name }),
    save: async (x: any) => x,
  });
  const save = async (x: any) => {
    const list = rows[nameOf(x)] ?? rows.Lead;
    if (!x.id) { x.id = nextId++; list.push(x); }
    return x;
  };
  const manager = { getRepository: repoFor, save };
  const qb: any = { leftJoinAndSelect: () => qb, where: () => qb, andWhere: () => qb, getMany: async () => [] };
  const dataSource: any = {
    transaction: async (fn: any) => fn(manager),
    getRepository: () => ({ createQueryBuilder: () => qb }),
  };
  const events = { emitAsync: jest.fn() };
  const service = new LeadRoutingService(dataSource, {} as any, { createNotification: jest.fn() } as any, events as any);
  return { service, rows, events };
}

const lead = () => ({ id: 4206, name: 'PM Real Estates', mobile_number: '9629090070', whatsapp_number: null, email: 'pm@x.in', city: 'Coimbatore', assigned_staff_id: 9, department: 'telecalling', status: 'New', converted_to: null });

describe('convertLead', () => {
  it('creates an agent owned by the converter and takes the lead out of routing', async () => {
    const { service, rows, events } = setup(lead());
    const out = await service.convertLead(4206, 'agent', 'Is a broker', 9);
    expect(rows.Agent).toHaveLength(1);
    expect(rows.Agent[0]).toMatchObject({ name: 'PM Real Estates', mobile_number: '9629090070', assigned_staff_id: 9, status: 'New' });
    expect(rows.AgentFollowUp[0].notes).toBe('Converted from lead L04206: Is a broker');
    expect(rows.Lead[0]).toMatchObject({ converted_to: 'agent', status: 'Converted', assigned_staff_id: null });
    expect(out).toEqual({ kind: 'agent', id: rows.Agent[0].id, existing: false });
    expect(events.emitAsync).toHaveBeenCalledWith('partners.agent.created', expect.anything());
  });

  it('links an existing agent with the same mobile instead of a duplicate', async () => {
    const { service, rows, events } = setup(lead(), [{ id: 55, mobile_number: '9629090070' }]);
    const out = await service.convertLead(4206, 'agent', 'note', 9);
    expect(rows.Agent).toHaveLength(1);
    expect(out).toEqual({ kind: 'agent', id: 55, existing: true });
    expect(rows.AgentFollowUp[0].agent_id).toBe(55);
    expect(events.emitAsync).not.toHaveBeenCalled();
  });

  it('creates a queued inbound for an owner', async () => {
    const { service, rows } = setup(lead());
    await service.convertLead(4206, 'inbound', 'Has a flat', 9);
    expect(rows.Inbound[0]).toMatchObject({ owner_name: 'PM Real Estates', mobile_number: '9629090070', is_queued: true, uploaded_by_id: 9 });
    expect(rows.Inbound[0].property_id).toMatch(/^I\d{5}$/);
  });

  it("gives an admin's conversion to the staff who held the lead", async () => {
    const { service, rows } = setup(lead());
    await service.convertLead(4206, 'agent', 'broker', 1);
    expect(rows.Agent[0].assigned_staff_id).toBe(9);
  });

  it('refuses a lead that is already converted', async () => {
    const { service, rows } = setup({ ...lead(), converted_to: 'agent' });
    await expect(service.convertLead(4206, 'agent', 'again', 9)).rejects.toBeInstanceOf(BadRequestException);
    expect(rows.Agent).toHaveLength(0);
  });
});
