import { MasterService } from './master.service';

describe('MasterService room names', () => {
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
    const siteApi = { get: jest.fn(), post: jest.fn(), patch: jest.fn(), del: jest.fn() };
    const service = new MasterService(crmDataSource as any, {} as any, siteApi as any);
    return { service, repository };
  }

  it('lists active room names ordered by name', async () => {
    const { service, repository } = make({
      find: jest.fn(async () => [{ id: 1, name: 'Master Bedroom', is_active: true }]),
    });
    const rows = await service.getRoomNames();
    expect(repository.find).toHaveBeenCalledWith({
      where: { is_active: true },
      order: { name: 'ASC' },
    });
    expect(rows).toEqual([{ id: 1, label: 'Master Bedroom', value: 'Master Bedroom', is_active: true }]);
  });

  it('creates, updates and deletes', async () => {
    const { service, repository } = make({
      findOne: jest.fn(async () => ({ id: 3, name: 'Kitchen', is_active: true })),
    });
    await expect(service.createRoomName('Kitchen')).resolves.toMatchObject({ id: 3 });
    await service.updateRoomName(3, { name: 'Modular Kitchen', is_active: true });
    expect(repository.save).toHaveBeenCalledWith(
      expect.objectContaining({ name: 'Modular Kitchen' }),
    );
    await service.deleteRoomName(3);
    expect(repository.delete).toHaveBeenCalledWith(3);
  });
});

describe('MasterService room dimensions', () => {
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
    const siteApi = { get: jest.fn(), post: jest.fn(), patch: jest.fn(), del: jest.fn() };
    const service = new MasterService(crmDataSource as any, {} as any, siteApi as any);
    return { service, repository };
  }

  it('lists active dimensions with length and width', async () => {
    const { service } = make({
      find: jest.fn(async () => [{ id: 1, name: 'Standard', lengthFt: 12, widthFt: 10, is_active: true }]),
    });
    const rows = await service.getRoomDimensions();
    expect(rows).toEqual([
      { id: 1, label: 'Standard', value: 'Standard', lengthFt: 12, widthFt: 10, is_active: true },
    ]);
  });

  it('creates with separate length and width', async () => {
    const { service, repository } = make();
    await service.createRoomDimension({ name: 'Standard', lengthFt: 12, widthFt: 10 });
    expect(repository.save).toHaveBeenCalledWith(
      expect.objectContaining({ name: 'Standard', lengthFt: 12, widthFt: 10 }),
    );
  });
});
