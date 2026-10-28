import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn } from 'typeorm';

/**
 * Editable email wording. With event_key: an override of a system email's
 * default template. Without: a saved template staff pick in the composer.
 */
@Entity('mail_templates')
export class MailTemplate {
  @PrimaryGeneratedColumn({ unsigned: true }) id: number;
  @Column({ length: 50 }) module: string;
  @Column({ length: 50 }) entity_type: string;
  @Column({ type: 'varchar', length: 100, nullable: true }) event_key: string | null;
  @Column({ length: 150 }) name: string;
  @Column({ length: 500 }) subject: string;
  @Column({ type: 'mediumtext' }) body_html: string;
  @Column({ type: 'boolean', default: true }) is_active: boolean;
  @Column({ type: 'int', nullable: true }) created_by: number | null;
  @Column({ type: 'int', nullable: true }) updated_by: number | null;
  @CreateDateColumn() created_at: Date;
  @UpdateDateColumn() updated_at: Date;
}
