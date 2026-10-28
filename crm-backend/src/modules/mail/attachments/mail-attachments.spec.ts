import { safeFilename, sniffContentType } from './mail-attachments.service';

describe('mail attachments', () => {
  it('recognises PDF and images by content, not by name', () => {
    expect(sniffContentType(Buffer.from('%PDF-1.7 ...'))).toBe('application/pdf');
    expect(sniffContentType(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0]))).toBe('image/png');
    expect(sniffContentType(Buffer.from([0xff, 0xd8, 0xff, 0xe0]))).toBe('image/jpeg');
    expect(sniffContentType(Buffer.from('RIFF\0\0\0\0WEBPVP8 '))).toBe('image/webp');
    expect(sniffContentType(Buffer.from('MZ\x90\x00 an exe renamed to .pdf'))).toBeNull();
    expect(sniffContentType(Buffer.from('<html>'))).toBeNull();
  });

  it('cleans file names and uses the real type as extension', () => {
    expect(safeFilename('../../etc/passwd', 'application/pdf')).toBe('passwd.pdf');
    expect(safeFilename('C:\\Users\\me\\Price list <final>.PDF', 'application/pdf')).toBe('Price list _final_.pdf');
    expect(safeFilename('photo.exe', 'image/jpeg')).toBe('photo.jpg');
    expect(safeFilename('', 'image/png')).toBe('attachment.png');
    expect(safeFilename('வீடு புகைப்படம்.jpg', 'image/jpeg')).toBe('வீடு புகைப்படம்.jpg');
  });
});
