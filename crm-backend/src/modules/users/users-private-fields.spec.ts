import { User } from '../../database/entities/user.entity';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';

jest.mock('bun', () => ({ S3Client: class {} }), { virtual: true });

// Two people on the team, with the personal details only admins may read.
function person(id: number, name: string) {
  return Object.assign(new User(), {
    id, name, email: `${name.toLowerCase()}@x.test`, password_hash: 'hash', is_active: true,
    aadhaar_no: `1234 5678 90${id}`, bank_account_no: `00011122${id}`, phone: `98765000${id}`, address: `${id} Main Road`,
    role: { id: 4, name: 'Staff' }, department: { id: 1, name: 'Sales' },
  });
}
const people = [person(1, 'Asha'), person(2, 'Ravi')];

function controller() {
  const repo = {
    find: jest.fn(async () => people),
    findOne: jest.fn(async ({ where }: any) => people.find((p) => p.id === where.id) ?? null),
  };
  const permissions = { listUserPermissions: jest.fn(async () => ['leads.view']) };
  return new UsersController(new UsersService(repo as any, permissions as any, {} as any, {} as any));
}
const as = (id: number, role: string) => ({ user: { id, sub: id, role } });
const PRIVATE = ['aadhaar_no', 'bank_account_no', 'phone', 'address', 'password_hash', 'permissions'];

describe('GET /users personal details', () => {
  it('keeps them from staff listing everyone', async () => {
    const { data } = await controller().findAll(as(2, 'Staff'));
    expect(data).toHaveLength(2);
    for (const u of data as any[]) {
      for (const key of PRIVATE) expect(u).not.toHaveProperty(key);
      expect(u).toMatchObject({ name: expect.any(String), role: { name: 'Staff' }, department: { name: 'Sales' } });
    }
  });

  it('gives admins the full records', async () => {
    const { data } = await controller().findAll(as(9, 'Admin'));
    expect(data[0]).toMatchObject({ aadhaar_no: '1234 5678 901', bank_account_no: '000111221', permissions: ['leads.view'] });
    expect(data[0]).not.toHaveProperty('password_hash');
  });

  it("keeps them from staff opening someone else's record", async () => {
    const { data } = await controller().findOne('1', as(2, 'Staff'));
    for (const key of PRIVATE) expect(data).not.toHaveProperty(key);
  });

  it('lets a person read their own record in full', async () => {
    const { data } = await controller().findOne('2', as(2, 'Staff'));
    expect(data).toMatchObject({ id: 2, aadhaar_no: '1234 5678 902', phone: '987650002' });
    expect(data).not.toHaveProperty('password_hash');
  });
});
