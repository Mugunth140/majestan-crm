// fallow-ignore-file circular-dependencies
import type { Relation } from 'typeorm';
import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, ManyToOne, JoinColumn, Index } from 'typeorm';
import { Lead } from './lead.entity';
import { User } from './user.entity';

@Entity('routing_histories')
export class RoutingHistory {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'lead_id' })
  @Index()
  lead_id: number;

  @ManyToOne(() => Lead, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'lead_id' })
  lead: Relation<Lead>;

  // 'Claimed' | 'Assigned' | 'Auto-transferred' | 'Auto-unassigned' | 'Converted'
  @Column({ type: 'varchar' })
  event_type: string;

  @Column({ type: 'varchar', nullable: true })
  department: string | null; // department at time of event

  @Column({ name: 'from_user_id', nullable: true })
  from_user_id: number | null;

  @ManyToOne(() => User, { nullable: true })
  @JoinColumn({ name: 'from_user_id' })
  from_user: Relation<User> | null;

  @Column({ name: 'to_user_id', nullable: true })
  to_user_id: number | null;

  @ManyToOne(() => User, { nullable: true })
  @JoinColumn({ name: 'to_user_id' })
  to_user: Relation<User> | null;

  @Column({ name: 'actioned_by_id', nullable: true })
  actioned_by_id: number | null;

  @ManyToOne(() => User, { nullable: true })
  @JoinColumn({ name: 'actioned_by_id' })
  actioned_by: Relation<User> | null;

  @Column({ type: 'text', nullable: true })
  feedback: string | null;

  @CreateDateColumn()
  @Index()
  created_at: Date;
}
