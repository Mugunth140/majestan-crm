import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, ManyToOne, JoinColumn } from 'typeorm';
import { Lead } from './lead.entity';
import { User } from './user.entity';

@Entity('lead_follow_ups')
export class LeadFollowUp {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'lead_id' })
  lead_id: number;

  @ManyToOne(() => Lead, lead => lead.follow_ups, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'lead_id' })
  lead: Lead;

  @Column({ type: 'date', nullable: true })
  follow_up_date: string;

  @Column({ type: 'time', nullable: true })
  follow_up_time: string;

  @Column({ nullable: true })
  purpose: string;

  @Column({ nullable: true })
  priority: string;

  @Column({ type: 'text', nullable: true })
  notes: string;

  @Column({ default: false })
  is_completed: boolean;

  @Column({ name: 'created_by_id', nullable: true })
  created_by_id: number;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'created_by_id' })
  created_by: User;

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;
}
