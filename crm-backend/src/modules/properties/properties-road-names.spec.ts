import { PropertiesService } from './properties.service';

describe('PropertiesService form-data road names', () => {
  function make(rows: unknown[] = [{ id: 1, name: 'Ring Road' }]) {
    const repo = { find: jest.fn(async () => rows) };
    const siteApi = { get: jest.fn(async () => ({})) };
    const crmDataSource = { getRepository: jest.fn(() => repo) };
    const service = new PropertiesService(siteApi as any, {} as any, crmDataSource as any);
    return { service, repo };
  }

  it('includes active road names as value/label pairs', async () => {
    const { service } = make();
    const data = await service.findFormData();
    expect(data.roadNames).toEqual([{ value: 'Ring Road', label: 'Ring Road' }]);
  });

  it('degrades to an empty list when the lookup fails', async () => {
    const repo = { find: jest.fn(async () => { throw new Error('db down'); }) };
    const siteApi = { get: jest.fn(async () => ({})) };
    const crmDataSource = { getRepository: jest.fn(() => repo) };
    const service = new PropertiesService(siteApi as any, {} as any, crmDataSource as any);
    const data = await service.findFormData();
    expect(data.roadNames).toEqual([]);
  });
});
