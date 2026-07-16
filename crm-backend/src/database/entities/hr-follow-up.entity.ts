// fallow-ignore-file circular-dependencies
import type { Relation } from "typeorm";
import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, ManyToOne, JoinColumn } from 'typeorm';
import { HrCandidate } from './hr-candidate.entity';

@Entity('hr_follow_ups')
export class HrFollowUp {
  @PrimaryGeneratedColumn() id: number;
  @Column({ name: 'hr_candidate_id' }) hr_candidate_id: number;

  @ManyToOne(() => HrCandidate, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'hr_candidate_id' })
  candidate: Relation<HrCandidate>;

  @Column({ type: 'date', nullable: true }) follow_up_date: string | null;
  @Column({ type: 'time', nullable: true }) follow_up_time: string | null;
  @Column({ type: 'varchar', nullable: true }) contacted_via: string | null;
  @Column({ type: 'date', nullable: true }) next_follow_up_date: string | null;
  @Column({ type: 'time', nullable: true }) next_follow_up_time: string | null;
  @Column({ type: 'varchar', nullable: true }) priority: string | null;
  @Column({ type: 'varchar', nullable: true }) rnr: string | null;
  @Column({ type: 'text', nullable: true }) notes: string | null;

  @CreateDateColumn() created_at: Date;
  @UpdateDateColumn() updated_at: Date;
}
