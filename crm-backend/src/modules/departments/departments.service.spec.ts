import { DepartmentsService, departmentBase } from './departments.service';

function fakeRepo(names: string[]) {
  const rows = names.map((name, i) => ({ id: i + 1, name }));
  return {
    rows,
    find: jest.fn(async () => [...rows]),
    create: jest.fn((d: { name: string }) => d),
    save: jest.fn(async (d: { name: string }) => { rows.push({ id: rows.length + 1, ...d }); return d; }),
  };
}

describe('DepartmentsService seed', () => {
  it('treats "Sales" and "Sales Department" as one team', () => {
    expect(departmentBase(' Sales Department ')).toBe('sales');
    expect(departmentBase('HR')).toBe('hr');
  });

  it('does not add a suffixed default next to an existing short name', async () => {
    const repo = fakeRepo(['Management', 'Sales', 'Telecalling', 'HR']);
    await new DepartmentsService(repo as never).onModuleInit();
    expect(repo.rows.map(r => r.name)).toEqual([
      'Management', 'Sales', 'Telecalling', 'HR',
      'Collection Department', 'Designing Department', 'Digital Department', 'Sourcing Department',
    ]);
  });

  it('adds nothing once every default exists', async () => {
    const repo = fakeRepo(['Telecalling Department', 'Sales Department', 'Collection Department', 'Designing Department', 'Digital Department', 'HR Department', 'Sourcing Department']);
    await new DepartmentsService(repo as never).onModuleInit();
    expect(repo.save).not.toHaveBeenCalled();
  });
});
