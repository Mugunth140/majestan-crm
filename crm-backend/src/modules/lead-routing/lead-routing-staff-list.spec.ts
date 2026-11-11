import { LeadRoutingService } from './lead-routing.service';

jest.mock('bun', () => ({ S3Client: class {} }), { virtual: true });

const staff = [
  { id: 11, name: 'Asha' },
  { id: 12, name: 'Bala' },
];

function setup(
  listed: { id: number; name: string }[],
  me: { id: number; name: string } | null,
) {
  const chain = (result: unknown) => {
    const qb: any = {};
    for (const m of [
      'leftJoinAndSelect',
      'where',
      'andWhere',
      'select',
      'addSelect',
      'groupBy',
    ])
      qb[m] = () => qb;
    qb.getMany = async () => [...listed];
    qb.getRawMany = async () => result;
    return qb;
  };
  const findOne = jest.fn().mockResolvedValue(me);
  const dataSource: any = {
    getRepository: () => ({ createQueryBuilder: () => chain([]), findOne }),
  };
  return {
    service: new LeadRoutingService(dataSource, {} as any, {} as any),
    findOne,
  };
}

describe('getStaffList: assigning to yourself', () => {
  it('adds a Team Lead to their own list, first', async () => {
    const { service } = setup(staff, { id: 5, name: 'Team Lead Tara' });
    const list = await service.getStaffList('all', 'Team Lead', 2, 5);
    expect(list.map((u) => u.id)).toEqual([5, 11, 12]);
  });

  it('moves a Manager already in the list to the top', async () => {
    const { service, findOne } = setup(
      [...staff, { id: 7, name: 'Manager Mani' }],
      null,
    );
    const list = await service.getStaffList('all', 'Manager', undefined, 7);
    expect(list.map((u) => u.id)).toEqual([7, 11, 12]);
    expect(findOne).not.toHaveBeenCalled();
  });

  it('leaves Admins out of the list', async () => {
    const { service, findOne } = setup(staff, { id: 1, name: 'Admin' });
    const list = await service.getStaffList('all', 'Admin', undefined, 1);
    expect(list.map((u) => u.id)).toEqual([11, 12]);
    expect(findOne).not.toHaveBeenCalled();
  });
});
