import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, ManyToOne, JoinColumn, OneToMany } from 'typeorm';
import { User } from './user.entity';
import { LeadStatus } from './lead-status.entity';
import { LeadInquiry } from './lead-inquiry.entity';
import { LeadFollowUp } from './lead-follow-up.entity';

@Entity('leads')
export class Lead {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  name: string;

  @Column({ unique: true })
  mobile_number: string;

  @Column({ unique: true, nullable: true })
  email: string;

  @Column({ nullable: true })
  whatsapp_number: string;

  @Column({ nullable: true })
  city: string;

  @Column({ type: 'text', nullable: true })
  address: string;

  @Column({ nullable: true })
  lead_source: string;

  @Column({ name: 'status_id', nullable: true })
  status_id: number;

  @ManyToOne(() => LeadStatus)
  @JoinColumn({ name: 'status_id' })
  status: LeadStatus;

  @Column({ name: 'assigned_staff_id', nullable: true })
  assigned_staff_id: number;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'assigned_staff_id' })
  assigned_staff: User;

  @OneToMany(() => LeadInquiry, inquiry => inquiry.lead)
  inquiries: LeadInquiry[];

  @OneToMany(() => LeadFollowUp, followUp => followUp.lead)
  follow_ups: LeadFollowUp[];

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;
}
