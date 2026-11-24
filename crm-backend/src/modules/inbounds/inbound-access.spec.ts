jest.mock('bun', () => ({ S3Client: jest.fn() }), { virtual: true });
jest.mock('exifr', () => ({ gps: jest.fn() }));
import { InboundsService } from './inbounds.service';

// Writes must respect the same visibility and contact masking as reading an inbound.
describe('inbound write access', () => {
  let service: InboundsService;
  let repo: any;
  let followUps: any;
  let contactLogs: any;
  const record = () => ({ id: 1, uploaded_by_id: 7, assigned_staff_id: 12, is_queued: false, inbound_status: null,
    status: 'Active', mobile_number: '9876543210', email: 'owner@example.com', owner_name: 'Ravi' });
  const stranger = { id: 50, role: 'Staff' };
  const owner = { id: 12, role: 'Staff' };

  beforeEach(() => {
    const users = { findOne: jest.fn(async () => ({ id: 50, department: { name: 'Sales' } })), find: jest.fn(async () => []) };
    repo = { findOne: jest.fn(async () => record()), save: jest.fn(async (value: any) => value), manager: { getRepository: () => users } };
    followUps = { create: (value: any) => value, save: jest.fn(async (value: any) => value) };
    contactLogs = { create: (value: any) => value, save: jest.fn(async (value: any) => value) };
    service = new InboundsService(repo, followUps, contactLogs, { find: async () => [] } as any, { hasInboundTrackingAccess: async () => false } as any);
  });

  it('hides another staff member’s inbound from edits, follow-ups, contact logs and photos', async () => {
    await expect(service.updateAuthorized(1, {}, stranger)).rejects.toThrow('not found');
    await expect(service.addFollowUp(1, { notes: 'x' }, 50, stranger)).rejects.toThrow('not found');
    await expect(service.addContactLog(1, { contact_type: 'call' }, 50, stranger)).rejects.toThrow('not found');
    const photo = { size: 10, buffer: Buffer.from('x'), originalname: 'a.jpg', mimetype: 'image/jpeg' } as Express.Multer.File;
    await expect(service.uploadImage(1, photo, 50, stranger)).rejects.toThrow('not found');
    expect(repo.save).not.toHaveBeenCalled();
    expect(followUps.save).not.toHaveBeenCalled();
    expect(contactLogs.save).not.toHaveBeenCalled();
  });

  it('lets the assigned staff member work the inbound', async () => {
    await service.addFollowUp(1, { notes: 'called' }, 12, owner);
    await service.addContactLog(1, { contact_type: 'call' }, 12, owner);
    expect(followUps.save).toHaveBeenCalled();
    expect(contactLogs.save).toHaveBeenCalled();
  });

  it('masks owner contacts in the edit response for staff without call tracking', async () => {
    const saved = await service.updateAuthorized(1, { owner_name: 'Ravi K' }, owner);
    expect(saved).toMatchObject({ owner_name: 'Ravi K' });
    expect(saved).not.toHaveProperty('mobile_number');
    expect(saved).not.toHaveProperty('email');
    expect(repo.save).toHaveBeenCalledWith(expect.objectContaining({ mobile_number: '9876543210' }));
  });

  it('keeps contacts in the edit response for admins', async () => {
    expect(await service.updateAuthorized(1, {}, { id: 1, role: 'Admin' })).toMatchObject({ mobile_number: '9876543210' });
  });
});
