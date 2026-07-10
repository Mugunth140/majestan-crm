// fallow-ignore-file circular-dependencies
import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, ManyToOne, JoinColumn } from 'typeorm';
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
  agent: Agent;

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

  @CreateDateColumn()
  created_at: Date;
}
