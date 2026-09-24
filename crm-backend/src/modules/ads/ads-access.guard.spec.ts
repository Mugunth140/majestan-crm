import { AdsAccessGuard, isDesignDepartment } from './ads-access.guard';

function contextWith(user: any) {
  return {
    switchToHttp: () => ({ getRequest: () => ({ user }) }),
  } as any;
}

describe('isDesignDepartment', () => {
  it.each(['Design', 'designing', 'DESIGN Team', 'Designing Department'])(
    'matches %s',
    (name) => expect(isDesignDepartment(name)).toBe(true),
  );
  it.each(['Sales', 'Telecalling', '', null, undefined])('rejects %s', (name) =>
    expect(isDesignDepartment(name)).toBe(false),
  );
});

describe('AdsAccessGuard', () => {
  it.each(['Admin', 'Super Admin', 'Manager'])('allows role %s without DB lookup', async (role) => {
    const dataSource = { query: jest.fn() };
    const guard = new AdsAccessGuard(dataSource as any);
    await expect(
      guard.canActivate(contextWith({ role, department_id: 99 })),
    ).resolves.toBe(true);
    expect(dataSource.query).not.toHaveBeenCalled();
  });

  it('allows designing-department staff via department lookup', async () => {
    const dataSource = { query: jest.fn(async () => [{ name: 'Designing' }]) };
    const guard = new AdsAccessGuard(dataSource as any);
    await expect(guard.canActivate(contextWith({ role: 'Staff', department_id: 4 }))).resolves.toBe(
      true,
    );
    expect(dataSource.query).toHaveBeenCalledWith(
      'SELECT name FROM departments WHERE id = ? LIMIT 1',
      [4],
    );
  });

  it('denies sales staff', async () => {
    const dataSource = { query: jest.fn(async () => [{ name: 'Sales' }]) };
    const guard = new AdsAccessGuard(dataSource as any);
    await expect(
      guard.canActivate(contextWith({ role: 'Staff', department_id: 2 })),
    ).rejects.toThrow(/design/i);
  });

  it('denies users with no department', async () => {
    const dataSource = { query: jest.fn() };
    const guard = new AdsAccessGuard(dataSource as any);
    await expect(guard.canActivate(contextWith({ role: 'Staff' }))).rejects.toThrow();
    expect(dataSource.query).not.toHaveBeenCalled();
  });
});
