import { WebsiteUsersService, phoneKey } from './website-users.service';

const siteRows = [
  { id: 3, name: 'Priya', email: 'p@x.in', phone: '+91 98765 43210', verified: 1, registeredAt: new Date(), wishlistCount: '2', enquiryCount: '1', lastEnquiryAt: new Date('2026-11-02') },
  { id: 2, name: 'Ravi', email: null, phone: '9000000001', verified: 1, registeredAt: new Date('2026-06-11'), wishlistCount: 0, enquiryCount: 0, lastEnquiryAt: null },
];

function service() {
  const crmQuery = jest.fn().mockResolvedValue([
    { id: 4206, status: 'Contacted', staff: 'Abarna', mkey: '9876543210' },
    { id: 100, status: 'Dropped', staff: null, mkey: '9876543210' },
  ]);
  const siteQuery = jest.fn().mockResolvedValue(siteRows);
  return { svc: new WebsiteUsersService({ query: crmQuery } as any, { query: siteQuery } as any), crmQuery, siteQuery };
}

describe('WebsiteUsersService', () => {
  it('compares phones by their last 10 digits', () => {
    expect(phoneKey('+91 98765-43210')).toBe('9876543210');
  });

  it('links each user to the newest lead with their mobile', async () => {
    const { svc, crmQuery } = service();
    const out = await svc.list({});
    expect(crmQuery.mock.calls[0][1]).toEqual([['9876543210', '9000000001']]);
    expect(out.data[0].lead).toEqual({ id: 4206, displayId: 'L04206', status: 'Contacted', staff: 'Abarna' });
    expect(out.data[0]).toMatchObject({ wishlistCount: 2, enquiryCount: 1, verified: true });
    expect(out.data[1].lead).toBeNull();
    expect(out.summary).toMatchObject({ total: 2, leads: 1, notLeads: 1 });
  });

  it('filters by lead link and search, and pages the result', async () => {
    const { svc } = service();
    expect((await svc.list({ lead: 'none' })).data.map((u) => u.id)).toEqual([2]);
    expect((await svc.list({ search: '43210' })).data.map((u) => u.id)).toEqual([3]);
    expect((await svc.list({ search: 'l04206' })).data.map((u) => u.id)).toEqual([3]);
    const paged = await svc.list({ page: 2, limit: 1 });
    expect(paged.data.map((u) => u.id)).toEqual([2]);
    expect(paged.meta).toMatchObject({ total: 2, totalPages: 2 });
  });
});
