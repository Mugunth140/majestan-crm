// fallow-ignore-file circular-dependencies
import type { Relation } from "typeorm";
import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, ManyToOne, JoinColumn, OneToMany, Index } from 'typeorm';
import { User } from './user.entity';
import { LeadInquiry } from './lead-inquiry.entity';
import { LeadFollowUp } from './lead-follow-up.entity';
import { LeadDocument } from './lead-document.entity';

@Entity('leads')
export class Lead {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  @Index()
  name: string;

  @Column({ unique: true })
  mobile_number: string;

  @Column({ nullable: true })
  @Index()
  email: string;

  @Column({ nullable: true })
  whatsapp_number: string;

  @Column({ nullable: true })
  city: string;

  @Column({ type: 'text', nullable: true })
  address: string;

  @Column({ nullable: true })
  lead_source: string;

  @Column({ type: 'varchar', default: 'New Lead' })
  @Index()
  status: string;

  @Column({ name: 'assigned_staff_id', nullable: true })
  @Index()
  assigned_staff_id: number;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'assigned_staff_id' })
  assigned_staff: User;

  @Column({ default: false })
  is_unqualified: boolean;

  @OneToMany(() => LeadInquiry, inquiry => inquiry.lead)
  inquiries: LeadInquiry[];

  @OneToMany(() => LeadFollowUp, followUp => followUp.lead)
  follow_ups: LeadFollowUp[];

  @OneToMany(() => LeadDocument, doc => doc.lead)
  documents: LeadDocument[];

  @CreateDateColumn()
  @Index()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;
}
