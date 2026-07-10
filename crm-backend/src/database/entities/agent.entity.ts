// fallow-ignore-file circular-dependencies
import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, ManyToOne, JoinColumn, OneToMany } from 'typeorm';
import { User } from './user.entity';
import { AgentFollowUp } from './agent-follow-up.entity';
import { AgentContactLog } from './agent-contact-log.entity';

@Entity('agents')
export class Agent {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  name: string;

  @Column({ nullable: true })
  company_name: string;

  @Column({ unique: true })
  mobile_number: string;

  @Column({ nullable: true })
  whatsapp_number: string;

  @Column({ nullable: true })
  email: string;

  @Column({ nullable: true })
  city: string;

  @Column({ nullable: true })
  state: string;

  @Column({ nullable: true })
  partner_type: string;

  @Column({ nullable: true })
  property_category: string;

  @Column({ default: false })
  commission_accepted: boolean;

  @Column({ nullable: true })
  commission_type: string;

  @Column({ nullable: true })
  commission_value: string;

  @Column({ type: 'text', nullable: true })
  remarks: string;

  @Column({ type: 'varchar', default: 'New' })
  status: string;

  @Column({ name: 'assigned_staff_id', nullable: true })
  assigned_staff_id: number;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'assigned_staff_id' })
  assigned_staff: User;

  @OneToMany(() => AgentFollowUp, followUp => followUp.agent)
  follow_ups: AgentFollowUp[];

  @OneToMany(() => AgentContactLog, log => log.agent)
  contact_logs: AgentContactLog[];

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;
}
