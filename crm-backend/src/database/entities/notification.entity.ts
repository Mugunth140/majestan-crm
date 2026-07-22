// fallow-ignore-file circular-dependencies
import type { Relation } from 'typeorm';
import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, ManyToOne, JoinColumn, Index } from 'typeorm';
import { User } from './user.entity';

@Entity('notifications')
export class Notification {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'user_id' })
  @Index()
  user_id: number;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user: Relation<User>;

  @Column({ type: 'varchar', length: 255 })
  title: string;

  @Column({ type: 'text' })
  message: string;

  // 'lead_assigned' | 'lead_claimed' | 'lead_transferred' | 'rnr5_unassigned' | 'lead_converted' | 'followup_due'
  @Column({ type: 'varchar', length: 50 })
  type: string;

  @Column({ type: 'int', nullable: true })
  entity_id: number | null;

  @Column({ type: 'varchar', length: 50, nullable: true })
  entity_type: string | null; // 'lead'

  @CreateDateColumn()
  @Index()
  created_at: Date;
}
