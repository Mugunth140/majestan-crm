import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn } from 'typeorm';

export type MailSuppressionReason = 'opt_out' | 'hard_bounce' | 'complaint' | 'manual';

/** Shared do-not-mail list: applies to every module's email. */
@Entity('mail_suppressions')
export class MailSuppression {
  @PrimaryGeneratedColumn({ unsigned: true }) id: number;
  @Column({ length: 255, unique: true }) email: string;
  @Column({ type: 'enum', enum: ['opt_out', 'hard_bounce', 'complaint', 'manual'] }) reason: MailSuppressionReason;
  @Column({ type: 'varchar', length: 100, nullable: true }) source: string | null;
  @Column({ type: 'varchar', length: 500, nullable: true }) note: string | null;
  @Column({ type: 'int', nullable: true }) created_by: number | null;
  @CreateDateColumn() created_at: Date;
}
