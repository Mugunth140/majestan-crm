import { MasterService } from './master.service';

describe('MasterService road names', () => {
  function make(repo: Record<string, jest.Mock> = {}) {
    const repository = {
      find: jest.fn(async () => []),
      findOne: jest.fn(async () => null),
      create: jest.fn((v: unknown) => v),
      save: jest.fn(async (v: unknown) => ({ id: 7, ...(v as object) })),
      delete: jest.fn(async () => ({ affected: 1 })),
      ...repo,
    };
    const crmDataSource = { getRepository: jest.fn(() => repository) };
    const service = new MasterService(crmDataSource as any, {} as any, {} as any);
    return { service, crmDataSource, repository };
  }

  it('lists active road names ordered by name', async () => {
    const { service, crmDataSource, repository } = make({
      find: jest.fn(async () => [{ id: 1, name: 'Ring Road', is_active: true }]),
    });
    const rows = await service.getRoadNames();
    expect(crmDataSource.getRepository).toHaveBeenCalled();
    expect(repository.find).toHaveBeenCalledWith({
      where: { is_active: true },
      order: { name: 'ASC' },
    });
    expect(rows).toEqual([{ id: 1, label: 'Ring Road', value: 'Ring Road', is_active: true }]);
  });

  it('returns an existing road name on duplicate create', async () => {
    const { service } = make({
      findOne: jest.fn(async () => ({ id: 3, name: 'Ring Road', is_active: true })),
    });
    const row = await service.createRoadName('Ring Road');
    expect(row).toMatchObject({ id: 3, label: 'Ring Road', value: 'Ring Road' });
  });

  it('updates name and status', async () => {
    const { service, repository } = make({
      findOne: jest.fn(async () => ({ id: 3, name: 'Old', is_active: true })),
    });
    await service.updateRoadName(3, { name: 'Ring Road', is_active: false });
    expect(repository.save).toHaveBeenCalledWith(
      expect.objectContaining({ name: 'Ring Road', is_active: false }),
    );
  });

  it('deletes by id', async () => {
    const { service, repository } = make();
    await service.deleteRoadName(3);
    expect(repository.delete).toHaveBeenCalledWith(3);
  });
});
