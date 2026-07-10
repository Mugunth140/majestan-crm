// fallow-ignore-file circular-dependencies
import type { Relation } from "typeorm";
import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, ManyToOne, JoinColumn } from 'typeorm';
import { Agent } from './agent.entity';
import { User } from './user.entity';

@Entity('agent_follow_ups')
export class AgentFollowUp {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'agent_id' })
  agent_id: number;

  @ManyToOne(() => Agent, agent => agent.follow_ups, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'agent_id' })
  agent: Relation<Agent>;

  @Column({ type: 'date', nullable: true })
  follow_up_date: string | null;

  @Column({ type: 'time', nullable: true })
  follow_up_time: string | null;

  @Column({ type: 'varchar', nullable: true })
  contacted_via: string | null;

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

  @Column({ name: 'created_by_id', nullable: true })
  created_by_id: number;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'created_by_id' })
  created_by: User;

  @CreateDateColumn()
  created_at: Date;
}
