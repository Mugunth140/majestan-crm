import { MasterService } from './master.service';

describe('MasterService amenities (site table)', () => {
  function make() {
    const crmDataSource = { getRepository: jest.fn() };
    const query: jest.Mock = jest.fn(async () => []);
    const siteDataSource = { query };
    const siteApi = {
      get: jest.fn(),
      post: jest.fn(async (_url: string, body: unknown) => ({ id: 9, ...(body as any).data })),
      patch: jest.fn(async () => ({ id: 9 })),
      del: jest.fn(async () => ({ deleted: true })),
    };
    const service = new MasterService(crmDataSource as any, siteDataSource as any, siteApi as any);
    return { service, siteDataSource, siteApi };
  }

  it('lists active amenities for dropdowns', async () => {
    const { service, siteDataSource } = make();
    siteDataSource.query.mockResolvedValueOnce([
      { id: 1, name: 'Pool', category: 'recreation', icon_key: 'waves' },
    ]);
    const rows = await service.getAmenities();
    expect(siteDataSource.query.mock.calls[0][0]).toContain('WHERE is_active = 1');
    expect(rows).toEqual([
      { id: 1, label: 'Pool', value: 'Pool', category: 'recreation', icon_key: 'waves' },
    ]);
  });

  it('searches all amenities by name', async () => {
    const { service, siteDataSource } = make();
    await service.getAllAmenities('poo');
    expect(siteDataSource.query.mock.calls[0][0]).toContain('WHERE name LIKE ?');
    expect(siteDataSource.query.mock.calls[0][1]).toEqual(['%poo%']);
  });

  it('creates with an auto-generated unique slug', async () => {
    const { service, siteDataSource, siteApi } = make();
    // name free, first slug taken, suffixed slug free
    siteDataSource.query
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([{ id: 4 }])
      .mockResolvedValueOnce([]);
    await service.createAmenity({ name: 'Swimming Pool', category: 'recreation', icon_key: 'waves' });
    expect(siteApi.post).toHaveBeenCalledWith(
      '/admin/amenities',
      {
        data: {
          name: 'Swimming Pool',
          slug: 'swimming-pool-2',
          category: 'recreation',
          icon_key: 'waves',
          is_active: true,
        },
      },
    );
  });

  it('rejects duplicate names and invalid categories', async () => {
    const { service, siteDataSource } = make();
    siteDataSource.query.mockResolvedValueOnce([{ id: 1 }]);
    await expect(service.createAmenity({ name: 'Pool' })).rejects.toThrow(
      'An amenity with this name already exists',
    );
    await expect(service.createAmenity({ name: 'Gym', category: 'nope' })).rejects.toThrow(
      'Invalid amenity category',
    );
  });

  it('updates without touching the slug', async () => {
    const { service, siteDataSource, siteApi } = make();
    siteDataSource.query.mockResolvedValueOnce([]);
    await service.updateAmenity(9, { name: 'Pool Deck', category: 'recreation', is_active: true });
    expect(siteApi.patch).toHaveBeenCalledWith(
      '/admin/amenities/9',
      { data: { name: 'Pool Deck', category: 'recreation', is_active: true } },
    );
  });

  it('deletes via the site admin API', async () => {
    const { service, siteApi } = make();
    await service.deleteAmenity(9);
    expect(siteApi.del).toHaveBeenCalledWith('/admin/amenities/9');
  });
});
