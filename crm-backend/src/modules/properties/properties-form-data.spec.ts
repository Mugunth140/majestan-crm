import { PropertiesService } from './properties.service';

describe('PropertiesService findFormData furnishings', () => {
  function make(formData: unknown = {}) {
    const siteApi = { get: jest.fn(async () => formData) };
    const crmDataSource = {
      getRepository: jest.fn(() => ({ find: jest.fn(async () => []) })),
    };
    const service = new PropertiesService(siteApi as any, {} as any, crmDataSource as any);
    return { service };
  }

  it('passes site furnishing items through to the form', async () => {
    const { service } = make({
      cities: [],
      sublocations: [],
      amenities: [],
      furnishings: [{ id: 1, name: 'Sofa', icon: 'Sofa' }],
    });
    const data = await service.findFormData();
    expect(data.furnishings).toEqual([{ id: 1, name: 'Sofa', icon: 'Sofa' }]);
  });

  it('degrades to an empty list when the site omits furnishings', async () => {
    const { service } = make({});
    const data = await service.findFormData();
    expect(data.furnishings).toEqual([]);
  });
});
