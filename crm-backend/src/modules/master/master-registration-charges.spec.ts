import { MasterService } from './master.service';

describe('MasterService registration charges', () => {
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

  it('lists active registration charges ordered by name', async () => {
    const { service, crmDataSource, repository } = make({
      find: jest.fn(async () => [{ id: 1, name: '1%', is_active: true }]),
    });
    const rows = await service.getRegistrationCharges();
    expect(crmDataSource.getRepository).toHaveBeenCalled();
    expect(repository.find).toHaveBeenCalledWith({
      where: { is_active: true },
      order: { name: 'ASC' },
    });
    expect(rows).toEqual([{ id: 1, label: '1%', value: '1%', is_active: true }]);
  });

  it('returns an existing charge on duplicate create', async () => {
    const { service } = make({
      findOne: jest.fn(async () => ({ id: 3, name: '9%', is_active: true })),
    });
    const row = await service.createRegistrationCharge('9%');
    expect(row).toMatchObject({ id: 3, label: '9%', value: '9%' });
  });

  it('updates name and status', async () => {
    const { service, repository } = make({
      findOne: jest.fn(async () => ({ id: 3, name: 'Old', is_active: true })),
    });
    await service.updateRegistrationCharge(3, { name: '9%', is_active: false });
    expect(repository.save).toHaveBeenCalledWith(
      expect.objectContaining({ name: '9%', is_active: false }),
    );
  });

  it('deletes by id', async () => {
    const { service, repository } = make();
    await service.deleteRegistrationCharge(3);
    expect(repository.delete).toHaveBeenCalledWith(3);
  });
});
