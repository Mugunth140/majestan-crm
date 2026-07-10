// fallow-ignore-file circular-dependencies
import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, ManyToOne, JoinColumn } from 'typeorm';
import { Lead } from './lead.entity';

@Entity('lead_inquiries')
export class LeadInquiry {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'lead_id' })
  lead_id: number;

  @ManyToOne(() => Lead, lead => lead.inquiries, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'lead_id' })
  lead: Lead;

  @Column({ nullable: true })
  project_list: string;

  @Column({ nullable: true })
  purchase_type: string;

  @Column({ nullable: true })
  property_type: string;

  @Column({ nullable: true })
  property_category: string;

  @Column({ nullable: true })
  funder: string;

  @Column({ type: 'json', nullable: true })
  preferences: any;

  @CreateDateColumn()
  created_at: Date;
}
