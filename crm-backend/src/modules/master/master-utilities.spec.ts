import { MasterService } from './master.service';

describe('MasterService utilities proxy', () => {
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
    await service.getAllUtilities('water');
    expect(siteApi.get).toHaveBeenCalledWith('/admin/utilities?search=water');
  });

  it('unwraps the paginated site response into an array', async () => {
    const siteApi = {
      get: jest.fn(async () => ({ items: [{ id: 1, name: 'Water' }], total: 1 })),
      post: jest.fn(),
      patch: jest.fn(),
      del: jest.fn(),
    };
    const service = new MasterService({} as any, {} as any, siteApi as any);
    await expect(service.getAllUtilities()).resolves.toEqual([
      { id: 1, name: 'Water' },
    ]);
  });

  it('creates via the site admin endpoint', async () => {
    const { service, siteApi } = make();
    await service.createUtility({ name: 'Water', icon: 'Droplets' });
    expect(siteApi.post).toHaveBeenCalledWith('/admin/utilities', {
      data: { name: 'Water', icon: 'Droplets' },
    });
  });

  it('updates via the site admin endpoint', async () => {
    const { service, siteApi } = make();
    await service.updateUtility(4, { name: 'Water', icon: 'Droplets', is_active: true });
    expect(siteApi.patch).toHaveBeenCalledWith('/admin/utilities/4', {
      data: { name: 'Water', icon: 'Droplets', is_active: true },
    });
  });

  it('deletes via the site admin endpoint', async () => {
    const { service, siteApi } = make();
    await service.deleteUtility(4);
    expect(siteApi.del).toHaveBeenCalledWith('/admin/utilities/4');
  });
});
