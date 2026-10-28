import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn } from 'typeorm';

/** A file attached to a composed email. `data` is only loaded when sending. */
@Entity('mail_attachments')
export class MailAttachment {
  @PrimaryGeneratedColumn({ unsigned: true }) id: number;
  @Column({ type: 'int', unsigned: true, nullable: true }) outbox_id: number | null;
  @Column() uploaded_by: number;
  @Column({ length: 255 }) filename: string;
  @Column({ length: 100 }) content_type: string;
  @Column({ unsigned: true }) size: number;
  @Column({ length: 64 }) sha256: string;
  @Column({ type: 'mediumblob', nullable: true, select: false }) data: Buffer | null;
  @CreateDateColumn() created_at: Date;
}
