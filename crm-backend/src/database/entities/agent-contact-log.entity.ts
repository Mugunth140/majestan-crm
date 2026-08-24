// fallow-ignore-file circular-dependencies
import type { Relation } from "typeorm";
import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, ManyToOne, JoinColumn, Index } from 'typeorm';
import { Agent } from './agent.entity';
import { User } from './user.entity';

@Entity('agent_contact_logs')
export class AgentContactLog {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'agent_id' })
  agent_id: number;

  @ManyToOne(() => Agent, agent => agent.contact_logs, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'agent_id' })
  agent: Relation<Agent>;

  @Column()
  contact_type: string;

  @Column({ nullable: true })
  subject: string;

  @Column({ type: 'text', nullable: true })
  message: string;

  @Column({ name: 'sent_by_id', nullable: true })
  sent_by_id: number;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'sent_by_id' })
  sent_by: User;

  @Column({ type: 'int', nullable: true })
  call_duration: number | null;

  @Column({ type: 'varchar', length: 20, nullable: true })
  call_direction: string | null;

  @Index('IDX_agent_contact_logs_source_call_id', { unique: true })
  @Column({ name: 'source_call_id', type: 'varchar', length: 255, nullable: true })
  source_call_id: string | null;

  @CreateDateColumn()
  created_at: Date;
}
