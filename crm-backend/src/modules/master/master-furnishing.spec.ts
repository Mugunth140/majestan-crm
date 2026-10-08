import { MasterService } from './master.service';

describe('MasterService furnishing items proxy', () => {
  function make() {
    const siteApi = {
      get: jest.fn(async () => []),
      post: jest.fn(async (_p: string, b: unknown) => b),
      patch: jest.fn(async (_p: string, b: unknown) => b),
      del: jest.fn(async () => ({ success: true })),
    };
    const service = new MasterService({} as any, {} as any, siteApi as any);
    return { service, siteApi };
  }

  it('lists via the site admin endpoint', async () => {
    const { service, siteApi } = make();
    await service.getAllFurnishingItems('sofa');
    expect(siteApi.get).toHaveBeenCalledWith('/admin/furnishing-items?search=sofa');
  });

  it('creates via the site admin endpoint', async () => {
    const { service, siteApi } = make();
    await service.createFurnishingItem({ name: 'Sofa', icon: 'Sofa' });
    expect(siteApi.post).toHaveBeenCalledWith('/admin/furnishing-items', {
      data: { name: 'Sofa', icon: 'Sofa' },
    });
  });

  it('updates via the site admin endpoint', async () => {
    const { service, siteApi } = make();
    await service.updateFurnishingItem(4, { name: 'Sofa', icon: 'Sofa', is_active: true });
    expect(siteApi.patch).toHaveBeenCalledWith('/admin/furnishing-items/4', {
      data: { name: 'Sofa', icon: 'Sofa', is_active: true },
    });
  });

  it('deletes via the site admin endpoint', async () => {
    const { service, siteApi } = make();
    await service.deleteFurnishingItem(4);
    expect(siteApi.del).toHaveBeenCalledWith('/admin/furnishing-items/4');
  });
});
