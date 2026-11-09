import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { UserAvatarsService } from './user-avatars.service';

jest.mock('bun', () => ({ S3Client: class {} }), { virtual: true });

const PNG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0]);
const file = (buffer: Buffer) => ({ buffer, originalname: 'me.png' }) as Express.Multer.File;

class FakeAvatars extends UserAvatarsService {
  written: { key: string; type: string }[] = [];
  deleted: string[] = [];
  protected async storage() {
    return {
      write: async (key: string, _data: Buffer, opts: { type: string }) => { this.written.push({ key, type: opts.type }); },
      delete: async (key: string) => { this.deleted.push(key); },
    } as never;
  }
}

describe('UserAvatarsService', () => {
  const before = process.env.R2_PUBLIC_URL;
  beforeAll(() => { process.env.R2_PUBLIC_URL = 'https://cdn.example.com/'; });
  afterAll(() => { process.env.R2_PUBLIC_URL = before; });

  it('stores an image under the user and returns its CDN URL', async () => {
    const svc = new FakeAvatars();
    const url = await svc.upload(7, file(PNG));
    expect(svc.written[0].key).toMatch(/^users\/avatars\/7\/[0-9a-f-]+\.png$/);
    expect(svc.written[0].type).toBe('image/png');
    expect(url).toBe(`https://cdn.example.com/${svc.written[0].key}`);
  });

  it('rejects files that are not photos, whatever they are named', async () => {
    await expect(new FakeAvatars().upload(7, file(Buffer.from('%PDF-1.4 hello')))).rejects.toBeInstanceOf(BadRequestException);
    await expect(new FakeAvatars().upload(7, file(Buffer.alloc(0)))).rejects.toBeInstanceOf(BadRequestException);
  });

  it('only deletes photos it stored', async () => {
    const svc = new FakeAvatars();
    await svc.discard('https://cdn.example.com/users/avatars/7/a.png');
    await svc.discard('https://cdn.example.com/properties/1/x.png');
    await svc.discard(null);
    expect(svc.deleted).toEqual(['users/avatars/7/a.png']);
  });
});

describe('UsersController photo access', () => {
  // The controller pulls in TypeORM decorators only; no database is touched.
  const { UsersController } = require('./users.controller');
  const service = { setAvatar: jest.fn(async () => ({ avatar_url: 'u' })), removeAvatar: jest.fn(async () => ({ avatar_url: null })) };
  const controller = new UsersController(service);

  it('lets users change their own photo and admins anyone’s', async () => {
    await expect(controller.uploadAvatar(5, file(PNG), { user: { id: 5, role: 'Staff' } })).resolves.toEqual({ success: true, data: { avatar_url: 'u' } });
    await expect(controller.removeAvatar(9, { user: { id: 1, role: 'Admin' } })).resolves.toEqual({ success: true, data: { avatar_url: null } });
  });

  it('stops anyone else', async () => {
    await expect(controller.uploadAvatar(9, file(PNG), { user: { id: 5, role: 'Manager' } })).rejects.toBeInstanceOf(ForbiddenException);
    expect(service.setAvatar).toHaveBeenCalledTimes(1);
  });
});
