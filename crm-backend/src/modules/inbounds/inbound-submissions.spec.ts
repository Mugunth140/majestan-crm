import { normalizeInboundMobile, submissionStatuses, readInboundPhotoCoordinates } from './inbound-submissions';

function photoWithGps() {
  const tiff = Buffer.alloc(128);
  tiff.write('II'); tiff.writeUInt16LE(42, 2); tiff.writeUInt32LE(8, 4);
  tiff.writeUInt16LE(1, 8);
  tiff.writeUInt16LE(0x8825, 10); tiff.writeUInt16LE(4, 12); tiff.writeUInt32LE(1, 14); tiff.writeUInt32LE(26, 18);
  tiff.writeUInt16LE(4, 26);
  for (const [i, tag, type, count, value] of [[0, 1, 2, 2, 83], [1, 2, 5, 3, 80], [2, 3, 2, 2, 87], [3, 4, 5, 3, 104]]) {
    const offset = 28 + i * 12;
    tiff.writeUInt16LE(tag, offset); tiff.writeUInt16LE(type, offset + 2); tiff.writeUInt32LE(count, offset + 4); tiff.writeUInt32LE(value, offset + 8);
  }
  for (const [i, n] of [11, 1, 0, 76, 57, 0].entries()) {
    tiff.writeUInt32LE(n, 80 + i * 8); tiff.writeUInt32LE(1, 84 + i * 8);
  }
  return Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe1, 0, 136]), Buffer.from('Exif\0\0'), tiff, Buffer.from([0xff, 0xd9])]);
}

describe('inbound submissions', () => {
  it.each(['9876543210', '+91 98765 43210', '0091-98765-43210', '09876543210'])('normalizes %s for matching', mobile => {
    expect(normalizeInboundMobile(mobile)).toBe('9876543210');
  });
  it('marks only later submissions as Repeat regardless of order and ignores empty numbers', () => {
    const result = submissionStatuses([
      { id: 7, mobile_number: '+91 98765 43210' }, { id: 1, mobile_number: '9876543210' },
      { id: 8, mobile_number: '8765432109' }, { id: 9 }, { id: 10, mobile_number: '' },
    ]);
    expect(Object.fromEntries(result)).toEqual({ 1: 'New', 7: 'Repeat', 8: 'New', 9: 'New', 10: 'New' });
  });
  it('extracts signed coordinates from real JPEG EXIF bytes', async () => {
    const coordinates = await readInboundPhotoCoordinates(photoWithGps());
    expect(coordinates?.latitude).toBeCloseTo(-11.0166667);
    expect(coordinates?.longitude).toBeCloseTo(-76.95);
  });
  it('allows a photo whose metadata is missing or unreadable', async () => {
    expect(await readInboundPhotoCoordinates(Buffer.from('no EXIF data'))).toBeNull();
  });
});
