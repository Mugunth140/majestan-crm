jest.mock('bun', () => ({ S3Client: jest.fn() }), { virtual: true });
jest.mock('exifr', () => ({ gps: jest.fn() }));
import { gps } from 'exifr';
import { InboundsService } from './inbounds.service';

const gpsMock = gps as jest.Mock;
describe('inbound capture and repeat review', () => {
  let repository: any;
  let service: InboundsService;
  let storage: any;
  const oldPublicUrl = process.env.R2_PUBLIC_URL;
  const originalFetch = global.fetch;
  beforeEach(() => {
    process.env.R2_PUBLIC_URL = 'https://cdn.example';
    repository = { find: jest.fn(), findOne: jest.fn(), save: jest.fn(async value => value) };
    service = new InboundsService(repository, {} as any, {} as any, {} as any, { hasInboundTrackingAccess: async () => false } as any);
    storage = { write: jest.fn().mockResolvedValue(undefined), delete: jest.fn().mockResolvedValue(undefined) };
    (service as any)._s3Client = storage;
    gpsMock.mockResolvedValue(undefined);
    global.fetch = jest.fn().mockResolvedValue({ ok: true, arrayBuffer: async () => new ArrayBuffer(20) });
  });
  afterEach(() => {
    if (oldPublicUrl === undefined) delete process.env.R2_PUBLIC_URL;
    else process.env.R2_PUBLIC_URL = oldPublicUrl;
    global.fetch = originalFetch;
    jest.restoreAllMocks();
  });
  function file(size = 8 * 1024 * 1024) {
    return { size, buffer: Buffer.from('original EXIF image'), originalname: 'property.jpg', mimetype: 'image/jpeg' } as Express.Multer.File;
  }
  it('accepts an image over 5 MB and extracts GPS before storing a compressed WebP', async () => {
    const inbound = { id: 2, property_id: 'I00002', latitude: null, longitude: null };
    repository.findOne.mockResolvedValue(inbound);
    gpsMock.mockResolvedValue({ latitude: 0, longitude: -76.95 });
    const upload = file();
    const saved = await service.uploadImage(2, upload);
    expect(gpsMock).toHaveBeenCalledWith(upload.buffer);
    expect(saved).toMatchObject({ latitude: 0, longitude: -76.95 });
    expect(saved.image_url).toMatch(/\.webp$/);
    expect(fetch).toHaveBeenCalledWith(expect.stringContaining('/q:80/'), expect.any(Object));
    expect(storage.write).toHaveBeenCalledWith(expect.stringMatching(/\.webp$/), expect.any(Buffer), { type: 'image/webp' });
  });
  it('accepts exactly 10 MB and rejects files above that limit', async () => {
    repository.findOne.mockResolvedValue({ id: 2, property_id: 'I00002' });
    await expect(service.uploadImage(2, file(10 * 1024 * 1024))).resolves.toBeDefined();
    storage.write.mockClear();
    await expect(service.uploadImage(2, file(10 * 1024 * 1024 + 1))).rejects.toThrow('10MB');
    expect(storage.write).not.toHaveBeenCalled();
  });
  it('keeps image uploads working without GPS or imgproxy', async () => {
    repository.findOne.mockResolvedValue({ id: 2, property_id: 'I00002', latitude: 11, longitude: 76 });
    gpsMock.mockRejectedValue(new Error('Unreadable metadata'));
    (fetch as jest.Mock).mockRejectedValue(new Error('Imgproxy down'));
    jest.spyOn(console, 'error').mockImplementation(() => {});
    const saved = await service.uploadImage(2, file());
    expect(saved).toMatchObject({ latitude: 11, longitude: 76 });
    expect(saved.image_url).toContain('temp_');
  });
  it('classifies repeat numbers across staff assignments without exposing restricted contacts', async () => {
    repository.find.mockResolvedValueOnce([{ id: 7, mobile_number: '+91 9876543210', follow_ups: [] }])
      .mockResolvedValueOnce([{ id: 1, mobile_number: '9876543210' }, { id: 7, mobile_number: '+91 9876543210' }]);
    const rows = await service.findAll({ id: 12, role: 'Staff' });
    expect(repository.find.mock.calls[0][0].where).toEqual({ assigned_staff_id: 12 });
    expect(repository.find.mock.calls[1][0]).toEqual({ select: { id: true, mobile_number: true } });
    expect(rows[0].submission_status).toBe('Repeat');
    expect(rows[0].mobile_number).toBeUndefined();
  });
});
