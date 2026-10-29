jest.mock('bun', () => ({ S3Client: jest.fn() }), { virtual: true });
jest.mock('exifr', () => ({ gps: jest.fn() }));
import { InboundsService } from './inbounds.service';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { AssignInboundsDto } from './dto/assign-inbounds.dto';
import { CreateInboundDto } from './dto/create-inbound.dto';

describe('Inbound Queue', () => {
  let service: InboundsService;
  let repo: any;
  let users: any;
  beforeEach(() => {
    users = { find: jest.fn(async () => [{ id: 12, name: 'Kavya', department: { name: 'Inbound' } }, { id: 13, name: 'Arjun', department: { name: 'Sales' } }]),
      findOne: jest.fn(async () => ({ id: 12, department: { name: 'Inbound Department' } })) };
    repo = { create: (value: any) => ({ id: 1, ...value }), save: jest.fn(async (value: any) => value),
      find: jest.fn(async () => [{ id: 1 }]), findOne: jest.fn(async () => ({ id: 1, uploaded_by_id: 7, assigned_staff_id: 12, is_queued: false })),
      update: jest.fn(async () => ({ affected: 1 })), manager: { getRepository: () => users } };
    service = new InboundsService(repo, {} as any, {} as any, { find: async () => [] } as any, { hasInboundTrackingAccess: async () => false } as any);
  });
  it('queues PWA submissions unassigned and fixes the uploader to the actor', async () => {
    const result = await service.create({ quick_capture: true, uploaded_by_id: 999, assigned_staff_id: 99, property_type: 'office' } as any, 7);
    expect(result).toMatchObject({ uploaded_by_id: 7, is_queued: true, assigned_staff_id: null });
    expect(result).not.toHaveProperty('quick_capture');
  });
  it('keeps desktop submissions in the pipeline and does not require a historical uploader', async () => {
    expect(await service.create({ assigned_staff_id: 12 })).toMatchObject({ is_queued: false, uploaded_by_id: null, assigned_staff_id: 12 });
  });
  it('requires a property type on quick capture', async () => {
    await expect(service.create({ quick_capture: true } as any, 7)).rejects.toThrow('property type');
    expect(repo.save).not.toHaveBeenCalled();
  });
  it('allows active inbound staff to assign, preserving uploader and removing the queue flag', async () => {
    await service.assign([1], 12, { id: 12, role: 'Staff' });
    expect(repo.update).toHaveBeenCalledWith(expect.anything(), { assigned_staff_id: 12, is_queued: false });
  });
  it('returns an unassigned record to Queue', async () => {
    await service.assign([1], null, { id: 9, role: 'Admin' });
    expect(repo.update).toHaveBeenCalledWith(expect.anything(), { assigned_staff_id: null, is_queued: true });
  });
  it('rejects assignments by field staff outside the inbound department', async () => {
    users.findOne.mockResolvedValue({ department: { name: 'Field' } });
    await expect(service.assign([1], 12, { id: 7, role: 'Staff' })).rejects.toThrow('Only inbound');
    expect(repo.update).not.toHaveBeenCalled();
  });
  it('rejects unknown, non-inbound and inactive target staff', async () => {
    for (const staffId of [13, 999]) await expect(service.assign([1], staffId, { role: 'Admin' })).rejects.toThrow('active inbound');
    expect(repo.update).not.toHaveBeenCalled();
  });
  it('validates the entire bulk selection before assigning', async () => {
    await expect(service.assign([1, 2], 12, { role: 'Admin' })).rejects.toThrow('not found');
    expect(repo.update).not.toHaveBeenCalled();
  });
  it('ignores uploader and queue tampering on normal edits', async () => {
    const saved = await service.update(1, { uploaded_by_id: 999, is_queued: true, alternative_contact: 'Kavya' });
    expect(saved).toMatchObject({ uploaded_by_id: 7, is_queued: false, alternative_contact: 'Kavya' });
  });
  it('prevents reassignment through the normal update endpoint', async () => {
    await expect(service.updateAuthorized(1, { assigned_staff_id: 99 }, { id: 7 })).rejects.toThrow('Use Assign');
    expect(repo.save).not.toHaveBeenCalled();
  });
  it('lets the uploader read their submission after reassignment', async () => {
    expect(await service.findOne(1, { id: 7, role: 'Staff' })).toMatchObject({ id: 1 });
  });
  it.each([{ inboundIds: [], staffId: 12 }, { inboundIds: [1,1], staffId: 12 }, { inboundIds: [1] }, { inboundIds: [1], staffId: 0 }])('validates assignment requests: %o', async body => {
    expect((await validate(plainToInstance(AssignInboundsDto, body))).length).toBeGreaterThan(0);
  });
  it('strips forged uploader and queue fields at the public DTO boundary', async () => {
    const dto: any = plainToInstance(CreateInboundDto, { mobile_number: '9876543210', property_category: 'commercial', quick_capture: true, uploaded_by_id: 999, is_queued: false });
    expect(await validate(dto, { whitelist: true })).toEqual([]);
    expect(dto.quick_capture).toBe(true); expect(dto.uploaded_by_id).toBeUndefined(); expect(dto.is_queued).toBeUndefined();
  });
});
