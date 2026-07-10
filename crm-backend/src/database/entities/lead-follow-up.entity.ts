// fallow-ignore-file circular-dependencies
import type { Relation } from "typeorm";
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
  lead: Relation<Lead>;

  // When the follow-up actually happened
  @Column({ type: 'date', nullable: true })
  follow_up_date: string | null;

  @Column({ type: 'time', nullable: true })
  follow_up_time: string | null;

  // How the lead was contacted this session
  @Column({ type: 'varchar', nullable: true })
  contacted_via: string | null; // email | sms | whatsapp | call

  // When the next follow-up is scheduled
  @Column({ type: 'date', nullable: true })
  next_follow_up_date: string | null;

  @Column({ type: 'time', nullable: true })
  next_follow_up_time: string | null;

  @Column({ type: 'varchar', nullable: true })
  purpose: string | null;

  @Column({ type: 'varchar', nullable: true })
  priority: string | null;

  @Column({ type: 'varchar', nullable: true })
  rnr: string | null;

  @Column({ type: 'text', nullable: true })
  notes: string | null;

  @Column({ default: false })
  is_completed: boolean;

  @Column({ type: 'int', name: 'created_by_id', nullable: true })
  created_by_id: number | null;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'created_by_id' })
  created_by: User;

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;
}
