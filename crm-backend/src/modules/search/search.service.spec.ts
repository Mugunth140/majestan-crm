// The services are replaced by fakes below; stub their modules so their own imports don't load.
jest.mock('../inbounds/inbounds.service', () => ({ InboundsService: class {} }));
jest.mock('../assets/assets.service', () => ({ AssetsService: class {} }));
jest.mock('../properties/properties.service', () => ({ PropertiesService: class {} }));
jest.mock('../projects/projects.service', () => ({ ProjectsService: class {} }));
jest.mock('../builders/builders.service', () => ({ BuildersService: class {} }));
jest.mock('../permissions/permissions.service', () => ({ PermissionsService: class {} }));
import { SearchService, readTerm } from './search.service';

describe('readTerm', () => {
  it('reads ids, phones and words', () => {
    expect(readTerm('L00025')!.id).toEqual({ prefix: 'L', value: 25 });
    expect(readTerm('#25')!.id).toEqual({ prefix: '', value: 25 });
    expect(readTerm('HRC0012')!.id).toEqual({ prefix: 'HRC', value: 12 });
    expect(readTerm('+91 98765 43210')!.phone).toBe('919876543210');
    expect(readTerm('Ravi')!.phone).toBeNull();
    expect(readTerm('Ravi')!.id).toBeNull();
  });

  it('ignores one stray letter but not a short id', () => {
    expect(readTerm('a')).toBeNull();
    expect(readTerm('  ')).toBeNull();
    expect(readTerm('7')!.id).toEqual({ prefix: '', value: 7 });
  });

  it('escapes LIKE wildcards', () => {
    expect(readTerm('50%_off')!.like).toBe('%50\\%\\_off%');
  });
});

function makeService(opts: { nav?: string[]; inboundIds?: number[] | null; contacts?: boolean } = {}) {
  const calls: { sql: string; params: any[] }[] = [];
  const dataSource = { query: jest.fn(async (sql: string, params: any[]) => { calls.push({ sql, params }); return [{ id: 25, name: 'Ravi', mobile_number: '9876543210', status: 'New', staff_id: 3, staff: 'Anu' }]; }) };
  const nav = new Set(opts.nav ?? ['leads', 'inbound', 'hr']);
  const permissions = { hasNavModule: jest.fn(async (_id: number, key: string) => nav.has(key)) };
  const inbounds = { visibleIds: jest.fn(async () => opts.inboundIds ?? null), canSeeContacts: jest.fn(async () => !!opts.contacts) };
  const none = {} as any;
  const service = new SearchService(dataSource as any, permissions as any, inbounds as any, none, none, none, none);
  return { service, calls };
}

describe('SearchService', () => {
  const staff = { id: 3, role: 'Staff', department: 'Telecalling Department', department_id: 2 };

  it('searches only modules on in the sidebar', async () => {
    const { service } = makeService({ nav: ['leads'] });
    const { scopes, groups } = await service.search(staff, 'Ravi');
    expect(scopes).toEqual(['leads']);
    expect(groups.map((g) => g.scope)).toEqual(['leads']);
    expect(groups[0].items[0]).toMatchObject({ code: 'L00025', title: 'Ravi', href: '/leads/25', person: { id: 3, name: 'Anu' } });
  });

  it("keeps staff to their own leads, like the Leads page", async () => {
    const { service, calls } = makeService({ nav: ['leads'] });
    await service.search(staff, 'Ravi');
    expect(calls[0].sql).toContain('l.assigned_staff_id = 3');
  });

  it('a scope narrows the search to one module and shows more', async () => {
    const { service, calls } = makeService();
    await service.search(staff, 'Ravi', 'hr');
    expect(calls).toHaveLength(1);
    expect(calls[0].sql).toContain('FROM hr_candidates');
    expect(calls[0].params.at(-1)).toBe(20);
  });

  it('never matches inbound phone numbers for someone who cannot see them', async () => {
    const { service, calls } = makeService({ nav: ['inbound'], inboundIds: [4, 5], contacts: false });
    await service.search(staff, '98765 43210');
    expect(calls[0].sql).not.toContain('mobile_number');
    expect(calls[0].params.slice(0, 2)).toEqual([4, 5]);
  });

  it('finds nothing in inbound when none are visible', async () => {
    const { service, calls } = makeService({ nav: ['inbound'], inboundIds: [] });
    expect((await service.search(staff, 'Ravi')).groups).toEqual([]);
    expect(calls).toHaveLength(0);
  });
});

describe('SearchService lead scope by role', () => {
  it('lets admins find unassigned leads waiting in routing', async () => {
    const { service, calls } = makeService({ nav: ['leads'] });
    await service.search({ id: 1, role: 'Admin' }, 'Ravi');
    expect(calls[0].sql.split('WHERE')[1]).not.toContain('assigned_staff_id');
  });
});
