import { BadRequestException, Injectable, NotFoundException, ServiceUnavailableException } from '@nestjs/common';
import { createCipheriv, createDecipheriv, createHmac, randomBytes, randomUUID } from 'crypto';
import type { S3Client } from 'bun';
import { safeFilename, sniffContentType } from '../mail/attachments/mail-attachments.service';

export const MAX_HR_DOCUMENT_BYTES = 10 * 1024 * 1024;
export const HR_DOCUMENT_TYPES = ['resume', 'aadhaar', 'pan', 'educationCert', 'experienceCert', 'photo'] as const;
export type HrDocumentType = typeof HR_DOCUMENT_TYPES[number];
const PREFIX = 'hr-private://';

/** Encrypted at rest even when the shared R2 bucket has a public CDN. Only the
 * authenticated HR download endpoint decrypts; no public document URL is saved. */
@Injectable()
export class HrDocumentsService {
  private client?: S3Client;
  private encryptionKey(): Buffer {
    const secret = process.env.HR_DOCUMENT_ENCRYPTION_KEY || process.env.JWT_SECRET;
    if (!secret) throw new ServiceUnavailableException('HR document encryption is not configured');
    return createHmac('sha256', secret).update('majestan/hr-documents/v1').digest();
  }
  protected async storage(): Promise<S3Client> {
    if (!this.client) {
      const { R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET_NAME } = process.env;
      if (![R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET_NAME].every(Boolean)) {
        throw new ServiceUnavailableException('HR document storage is not configured');
      }
      const { S3Client } = await import('bun');
      this.client = new S3Client({ accessKeyId: R2_ACCESS_KEY_ID!, secretAccessKey: R2_SECRET_ACCESS_KEY!, endpoint: `https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com`, bucket: R2_BUCKET_NAME! });
    }
    return this.client;
  }
  async upload(candidateId: number, type: HrDocumentType, file: Express.Multer.File): Promise<string> {
    if (!file?.buffer?.length) throw new BadRequestException('Choose a nonempty document');
    if (file.buffer.length > MAX_HR_DOCUMENT_BYTES) throw new BadRequestException('Document must be 10 MB or smaller');
    const contentType = sniffContentType(file.buffer);
    if (!contentType || (type === 'photo' && !contentType.startsWith('image/'))) {
      throw new BadRequestException(type === 'photo' ? 'Choose a JPEG, PNG or WebP photo' : 'Choose a PDF, JPEG, PNG or WebP document');
    }
    const metadata = Buffer.from(JSON.stringify({ filename: safeFilename(file.originalname, contentType), contentType }));
    const size = Buffer.alloc(4); size.writeUInt32BE(metadata.length);
    const iv = randomBytes(12);
    const cipher = createCipheriv('aes-256-gcm', this.encryptionKey(), iv);
    cipher.setAAD(Buffer.from(`${candidateId}:${type}`));
    const encrypted = Buffer.concat([cipher.update(Buffer.concat([size, metadata, file.buffer])), cipher.final()]);
    const key = `hr-documents/v1/${candidateId}/${type}/${randomUUID()}`;
    await (await this.storage()).write(key, Buffer.concat([Buffer.from('HRD1'), iv, cipher.getAuthTag(), encrypted]), { type: 'application/octet-stream' });
    return PREFIX + key;
  }
  async read(candidateId: number, type: HrDocumentType, reference: string | null | undefined) {
    if (!reference?.startsWith(`${PREFIX}hr-documents/v1/${candidateId}/${type}/`)) throw new NotFoundException('No stored HR document found. Upload this document again.');
    const key = reference.slice(PREFIX.length);
    const file = (await this.storage()).file(key);
    if (!(await file.exists())) throw new NotFoundException('Document is no longer available');
    const encrypted = Buffer.from(await file.arrayBuffer());
    if (encrypted.length < 36 || encrypted.subarray(0, 4).toString() !== 'HRD1') throw new BadRequestException('Document could not be read');
    const decipher = createDecipheriv('aes-256-gcm', this.encryptionKey(), encrypted.subarray(4, 16));
    decipher.setAuthTag(encrypted.subarray(16, 32));
    decipher.setAAD(Buffer.from(`${candidateId}:${type}`));
    const plain = Buffer.concat([decipher.update(encrypted.subarray(32)), decipher.final()]);
    const size = plain.readUInt32BE(0);
    if (size > 2048 || size > plain.length - 4) throw new BadRequestException('Document could not be read');
    const metadata = JSON.parse(plain.subarray(4, size + 4).toString()) as { filename: string; contentType: string };
    return { ...metadata, buffer: plain.subarray(size + 4) };
  }
  async discard(reference: string) {
    if (!reference.startsWith(PREFIX)) return;
    await (await this.storage()).delete(reference.slice(PREFIX.length));
  }
}
