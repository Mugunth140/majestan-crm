import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn } from 'typeorm';

export type MailOutboxStatus = 'draft' | 'pending' | 'sending' | 'sent' | 'failed' | 'cancelled' | 'suppressed';

/** Queue and permanent history for every CRM email (see docs/mail-service-design.md). */
@Entity('mail_outbox')
export class MailOutbox {
  @PrimaryGeneratedColumn({ unsigned: true }) id: number;

  @Column({ length: 100 }) event_key: string;
  @Column({ unsigned: true, default: 1 }) event_version: number;
  @Column({ length: 50 }) module: string;
  @Column({ length: 50 }) identity: string;
  @Column({ length: 50 }) entity_type: string;
  @Column() entity_id: number;

  @Column({ type: 'json' }) to_json: string[];
  @Column({ type: 'json', nullable: true }) cc_json: string[] | null;
  @Column({ type: 'varchar', length: 255, nullable: true }) reply_to: string | null;
  @Column({ length: 500 }) subject: string;
  @Column({ type: 'mediumtext', nullable: true }) html: string | null;
  @Column({ type: 'mediumtext', nullable: true }) text: string | null;
  @Column({ type: 'text', nullable: true }) note: string | null;

  @Column({ length: 255 }) idempotency_key: string;
  @Column({ type: 'enum', enum: ['draft', 'pending', 'sending', 'sent', 'failed', 'cancelled', 'suppressed'] })
  status: MailOutboxStatus;
  @Column({ length: 100, default: 'manual' }) trigger_source: string;

  @Column({ unsigned: true, default: 0 }) attempts: number;
  @Column({ type: 'datetime', nullable: true }) next_attempt_at: Date | null;
  @Column({ type: 'varchar', length: 1000, nullable: true }) last_error: string | null;
  @Column({ type: 'varchar', length: 255, nullable: true }) message_id: string | null;

  @Column({ type: 'int', nullable: true }) created_by: number | null;
  @Column({ type: 'int', nullable: true }) confirmed_by: number | null;
  @CreateDateColumn() created_at: Date;
  @UpdateDateColumn() updated_at: Date;
  @Column({ type: 'datetime', nullable: true }) confirmed_at: Date | null;
  @Column({ type: 'datetime', nullable: true }) sent_at: Date | null;
  @Column({ type: 'datetime', nullable: true }) expires_at: Date | null;
}
