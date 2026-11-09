import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, Index } from 'typeorm';

/** Append-only lead history; see migration 067. */
@Entity('lead_events')
@Index('idx_lead_events_lead', ['lead_id', 'created_at'])
export class LeadEvent {
  @PrimaryGeneratedColumn({ type: 'bigint' })
  id: number;

  @Column()
  lead_id: number;

  @Column({ type: 'int', nullable: true })
  actor_id: number | null;

  @Column({ type: 'varchar', length: 40 })
  type: string;

  @Column({ type: 'varchar', length: 60, nullable: true })
  field: string | null;

  @Column({ type: 'text', nullable: true })
  from_value: string | null;

  @Column({ type: 'text', nullable: true })
  to_value: string | null;

  @Column({ type: 'json', nullable: true })
  meta: Record<string, unknown> | null;

  @CreateDateColumn({ type: 'datetime', precision: 6 })
  created_at: Date;
}
