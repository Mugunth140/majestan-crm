import { BadRequestException, Injectable, ServiceUnavailableException } from '@nestjs/common';
import { randomUUID } from 'crypto';
import type { S3Client } from 'bun';
import { sniffContentType } from '../mail/attachments/mail-attachments.service';

export const MAX_AVATAR_BYTES = 5 * 1024 * 1024;
const EXTENSION: Record<string, string> = { 'image/png': 'png', 'image/jpeg': 'jpg', 'image/webp': 'webp' };
const KEY_PREFIX = 'users/avatars/';

/** Profile photos in the shared R2 bucket, served from its public CDN. */
@Injectable()
export class UserAvatarsService {
  private client?: S3Client;

  protected async storage(): Promise<S3Client> {
    if (!this.client) {
      const { R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET_NAME, R2_PUBLIC_URL } = process.env;
      if (![R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET_NAME, R2_PUBLIC_URL].every(Boolean)) {
        throw new ServiceUnavailableException('Photo storage is not configured');
      }
      const { S3Client } = await import('bun');
      this.client = new S3Client({ accessKeyId: R2_ACCESS_KEY_ID!, secretAccessKey: R2_SECRET_ACCESS_KEY!, endpoint: `https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com`, bucket: R2_BUCKET_NAME! });
    }
    return this.client;
  }

  private publicBase() {
    return (process.env.R2_PUBLIC_URL || '').replace(/\/+$/, '');
  }

  /** Stores the photo under a fresh name (so caches never show the old one) and returns its URL. */
  async upload(userId: number, file: Express.Multer.File): Promise<string> {
    if (!file?.buffer?.length) throw new BadRequestException('Choose a photo');
    if (file.buffer.length > MAX_AVATAR_BYTES) throw new BadRequestException('The photo must be 5 MB or smaller');
    const contentType = sniffContentType(file.buffer);
    if (!contentType || !EXTENSION[contentType]) throw new BadRequestException('Choose a JPEG, PNG or WebP photo');
    const key = `${KEY_PREFIX}${userId}/${randomUUID()}.${EXTENSION[contentType]}`;
    await (await this.storage()).write(key, file.buffer, { type: contentType });
    return `${this.publicBase()}/${key}`;
  }

  /** Deletes a photo this service stored; anything else (an old or outside URL) is left alone. */
  async discard(url: string | null | undefined) {
    const base = `${this.publicBase()}/${KEY_PREFIX}`;
    if (!url || !this.publicBase() || !url.startsWith(base)) return;
    await (await this.storage()).delete(url.slice(this.publicBase().length + 1));
  }
}
