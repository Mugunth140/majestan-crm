import { PropertiesService } from './properties.service';

describe('owner property review workflow', () => {
  function make(property: Record<string, unknown> = {}) {
    const siteApi = { get: jest.fn(async () => ({ items: [{ id: 7 }], total: 15 })), patch: jest.fn(async () => ({})) };
    const service = new PropertiesService(siteApi as any, {} as any, {} as any);
    jest.spyOn(service, 'findOne').mockResolvedValue({ id: 7, propertyType: 'plot', source: 'owner-post', status: 'available', approvalStatus: 'Pending', ...property } as any);
    return { service, siteApi };
  }

  it('keeps review filtering and total counts on the upstream paginated query', async () => {
    const { service, siteApi } = make();
    const result = await service.findAll({ status: 'review', page: 2, limit: 10, search: 'Garden', cityId: 1, propertyType: 'plot' });
    const query = new URL(siteApi.get.mock.calls[0][0] as string, 'http://site.test').searchParams;
    expect(Object.fromEntries(query)).toMatchObject({ statusFilter: 'review', page: '2', limit: '10', search: 'Garden', cityId: '1', propertyType: 'plot' });
    expect(result.meta).toEqual({ total: 15, page: 2, limit: 10, totalPages: 2 });
  });

  it('publishes a pending owner listing even if its stored status is already available', async () => {
    const { service, siteApi } = make();
    expect(await service.toggleVisibility(7)).toMatchObject({ status: 'available', approvalStatus: 'Approved' });
    expect(siteApi.patch).toHaveBeenCalledWith('/admin/properties/plot/7/status', { status: 'available' });
  });

  it('approval also makes an owner listing available through the publishing endpoint', async () => {
    const { service, siteApi } = make({ status: 'unavailable' });
    await service.setApprovalStatus(7, 'Approved');
    expect(siteApi.patch).toHaveBeenCalledWith('/admin/properties/plot/7/status', { status: 'available' });
  });

  it('keeps the existing staff approval behavior and rejects publishing terminal owner listings', async () => {
    const staff = make({ source: 'staff', status: 'unavailable' });
    await staff.service.setApprovalStatus(7, 'Approved');
    expect(staff.siteApi.patch).toHaveBeenCalledWith('/admin/properties/plot/7', { approvalStatus: 'Approved' });
    const sold = make({ status: 'sold' });
    await expect(sold.service.setApprovalStatus(7, 'Approved')).rejects.toThrow('Cannot publish');
    expect(sold.siteApi.patch).not.toHaveBeenCalled();
  });

  it('unpublishes approved available listings and returns pending owner listings to review on revocation', async () => {
    const { service, siteApi } = make({ approvalStatus: 'Approved' });
    expect(await service.toggleVisibility(7)).toMatchObject({ status: 'archived', approvalStatus: 'Approved' });
    await service.setApprovalStatus(7, 'Pending');
    expect(siteApi.patch).toHaveBeenLastCalledWith('/admin/properties/plot/7', { approvalStatus: 'Pending' });
  });
});
