// fallow-ignore-file circular-dependencies
import type { Relation } from "typeorm";
import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, ManyToOne, JoinColumn, Index } from 'typeorm';
import { HrCandidate } from './hr-candidate.entity';
import { User } from './user.entity';

@Entity('hr_contact_logs')
export class HrContactLog {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'hr_candidate_id' })
  hr_candidate_id: number;

  @ManyToOne(() => HrCandidate, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'hr_candidate_id' })
  candidate: Relation<HrCandidate>;

  @Column({ default: 'call' })
  contact_type: string;

  @Column({ name: 'sent_by_id', nullable: true })
  sent_by_id: number;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'sent_by_id' })
  sent_by: User;

  @Column({ type: 'int', nullable: true })
  call_duration: number | null;

  @Column({ type: 'varchar', length: 20, nullable: true })
  call_direction: string | null;

  @Index('IDX_hr_contact_logs_source_call_id', { unique: true })
  @Column({ name: 'source_call_id', type: 'varchar', length: 255, nullable: true })
  source_call_id: string | null;

  @CreateDateColumn()
  created_at: Date;
}
