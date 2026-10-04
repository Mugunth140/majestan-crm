// fallow-ignore-file circular-dependencies
import type { Relation } from "typeorm";
import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, ManyToOne, JoinColumn } from 'typeorm';
import { Lead } from './lead.entity';

@Entity('website_enquiry_events')
export class WebsiteEnquiryEvent {
  @PrimaryGeneratedColumn()
  id: number;

  @CreateDateColumn()
  created_at: Date;

  @Column({ nullable: true })
  name: string;

  @Column({ nullable: true })
  mobile_number: string;

  @Column({ nullable: true })
  email: string;

  @Column({ nullable: true })
  city: string;

  @Column({ nullable: true })
  whatsapp_number: string;

  @Column({ name: 'property_id', type: 'int', unsigned: true, nullable: true })
  property_id: number | null;

  @Column({ name: 'property_code', type: 'varchar', length: 64, nullable: true })
  property_code: string | null;

  @Column({ name: 'property_slug', type: 'varchar', length: 512, nullable: true })
  property_slug: string | null;

  @Column({ name: 'property_type', type: 'varchar', length: 100, nullable: true })
  property_type: string | null;

  @Column({ type: 'varchar', length: 16, default: 'enquiry' })
  intent: string;

  @Column({ name: 'visit_date', type: 'date', nullable: true })
  visit_date: string | null;

  @Column({ name: 'visit_slot', type: 'time', nullable: true })
  visit_slot: string | null;

  @Column({ type: 'json', nullable: true })
  preferences: any;

  @Column({ name: 'matched_lead_id', nullable: true })
  matched_lead_id: number | null;

  @ManyToOne(() => Lead, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'matched_lead_id' })
  matchedLead: Relation<Lead>;

  @Column({ type: 'varchar', length: 16, default: 'open' })
  status: string;

  @Column({ name: 'resolved_lead_id', nullable: true })
  resolved_lead_id: number | null;

  @ManyToOne(() => Lead, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'resolved_lead_id' })
  resolvedLead: Relation<Lead>;

  @Column({ name: 'decided_by', nullable: true })
  decided_by: number | null;

  @Column({ name: 'decided_at', type: 'datetime', precision: 6, nullable: true })
  decided_at: Date | null;

  @Column({ name: 'migrated_inquiry_id', nullable: true })
  migrated_inquiry_id: number | null;
}
