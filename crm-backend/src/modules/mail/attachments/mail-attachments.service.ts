import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { createHash } from 'crypto';
import { EntityManager, In, IsNull, LessThan, Repository } from 'typeorm';
import { MailAttachment } from '../../../database/entities/mail-attachment.entity';

export const MAX_ATTACHMENT_BYTES = 10 * 1024 * 1024;
const MAX_PENDING_PER_USER = 20;

/** Recognises PDF and common images by their first bytes, not by name or browser-sent type. */
export function sniffContentType(buffer: Buffer): string | null {
  if (buffer.length >= 5 && buffer.subarray(0, 5).toString('latin1') === '%PDF-') return 'application/pdf';
  if (buffer.length >= 8 && buffer.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return 'image/png';
  if (buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) return 'image/jpeg';
  if (buffer.length >= 12 && buffer.subarray(0, 4).toString('latin1') === 'RIFF' && buffer.subarray(8, 12).toString('latin1') === 'WEBP') return 'image/webp';
  return null;
}

const EXTENSION: Record<string, string> = { 'application/pdf': '.pdf', 'image/png': '.png', 'image/jpeg': '.jpg', 'image/webp': '.webp' };

/** Keeps a readable name but strips paths and odd characters; extension follows the real type. */
export function safeFilename(original: string, contentType: string): string {
  const base = (original || 'attachment')
    .split(/[\\/]/)
    .pop()!
    .replace(/\.[^.]*$/, '')
    .replace(/[^\p{L}\p{M}\p{N} ._()-]+/gu, '_') // \p{M}: Tamil and other scripts' vowel signs
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 120);
  return `${base || 'attachment'}${EXTENSION[contentType] ?? ''}`;
}

export interface AttachmentMeta {
  id: number;
  filename: string;
  contentType: string;
  size: number;
}

@Injectable()
export class MailAttachmentsService {
  constructor(@InjectRepository(MailAttachment) private readonly attachments: Repository<MailAttachment>) {}

  async upload(file: Express.Multer.File | undefined, actorId: number): Promise<AttachmentMeta> {
    if (!file?.buffer?.length) throw new BadRequestException('Choose a file to attach');
    if (file.size > MAX_ATTACHMENT_BYTES) throw new BadRequestException('Attachments can be at most 10 MB');
    const contentType = sniffContentType(file.buffer);
    if (!contentType) throw new BadRequestException('Only PDF and image files (PNG, JPG, WEBP) can be attached');
    const pending = await this.attachments.count({ where: { uploaded_by: actorId, outbox_id: IsNull() } });
    if (pending >= MAX_PENDING_PER_USER) throw new BadRequestException('Too many unsent attachments. Send or remove some first');
    const row = await this.attachments.save(
      this.attachments.create({
        uploaded_by: actorId,
        outbox_id: null,
        filename: safeFilename(file.originalname, contentType),
        content_type: contentType,
        size: file.size,
        sha256: createHash('sha256').update(file.buffer).digest('hex'),
        data: file.buffer,
      }),
    );
    return this.meta(row);
  }

  /** Only the uploader can remove a file, and only before it is sent. */
  async remove(id: number, actorId: number) {
    const result = await this.attachments.delete({ id, uploaded_by: actorId, outbox_id: IsNull() });
    if (!result.affected) throw new NotFoundException('Attachment not found');
    return { success: true };
  }

  /** The caller's unsent files with these ids, in the given order; refuses anything else. */
  async pendingFor(ids: number[], actorId: number): Promise<AttachmentMeta[]> {
    const unique = [...new Set(ids)];
    if (!unique.length) return [];
    const rows = await this.attachments.find({ where: { id: In(unique), uploaded_by: actorId, outbox_id: IsNull() } });
    if (rows.length !== unique.length) throw new BadRequestException('One or more attachments are missing. Please attach them again');
    const total = rows.reduce((sum, row) => sum + row.size, 0);
    if (total > MAX_ATTACHMENT_BYTES) throw new BadRequestException('Attachments can be at most 10 MB in total');
    return unique.map((id) => this.meta(rows.find((row) => row.id === id)!));
  }

  /** Links the files to the queued email, inside the caller's transaction. */
  async claim(manager: EntityManager, ids: number[], actorId: number, outboxId: number) {
    if (!ids.length) return;
    const result = await manager
      .createQueryBuilder()
      .update(MailAttachment)
      .set({ outbox_id: outboxId })
      .where('id IN (:...ids) AND uploaded_by = :actorId AND outbox_id IS NULL', { ids, actorId })
      .execute();
    if (result.affected !== new Set(ids).size) throw new BadRequestException('One or more attachments are missing. Please attach them again');
  }

  async forOutbox(outboxId: number): Promise<AttachmentMeta[]> {
    const rows = await this.attachments.find({ where: { outbox_id: outboxId }, order: { id: 'ASC' } });
    return rows.map((row) => this.meta(row));
  }

  /** With file contents, for the dispatcher. Files whose content was purged are skipped. */
  async filesFor(outboxId: number): Promise<{ filename: string; contentType: string; content: Buffer }[]> {
    const rows = await this.attachments
      .createQueryBuilder('a')
      .addSelect('a.data')
      .where('a.outbox_id = :outboxId AND a.data IS NOT NULL', { outboxId })
      .orderBy('a.id', 'ASC')
      .getMany();
    return rows.map((row) => ({ filename: row.filename, contentType: row.content_type, content: row.data! }));
  }

  /** Housekeeping: drop files never sent within a day, and file contents past retention. */
  async purge(now: Date, retentionDays: number) {
    await this.attachments.delete({ outbox_id: IsNull(), created_at: LessThan(new Date(now.getTime() - 24 * 3600_000)) });
    await this.attachments
      .createQueryBuilder()
      .update(MailAttachment)
      .set({ data: null })
      .where('created_at < :cutoff AND data IS NOT NULL', { cutoff: new Date(now.getTime() - retentionDays * 24 * 3600_000) })
      .execute();
  }

  private meta(row: MailAttachment): AttachmentMeta {
    return { id: row.id, filename: row.filename, contentType: row.content_type, size: row.size };
  }
}
