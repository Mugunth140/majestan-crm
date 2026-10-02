// fallow-ignore-file circular-dependencies
import type { Relation } from "typeorm";
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
  lead: Relation<Lead>;

  @Column({ nullable: true })
  project_list: string;

  @Column({ nullable: true })
  purchase_type: string;

  @Column({ nullable: true })
  property_type: string;

  @Column({ nullable: true })
  property_category: string;

  // Property-page enquiry link. Plain columns, no FK: `properties` lives in the
  // separate site database, so it cannot be joined relationally. Mirrors
  // migration infra/migrations/024_add_inquiry_property_link.sql — because
  // synchronize is false, the migration is the authority and these must agree
  // with it name for name.
  @Column({ name: 'property_id', type: 'int', unsigned: true, nullable: true })
  property_id: number | null;

  @Column({ name: 'property_code', type: 'varchar', length: 64, nullable: true })
  property_code: string | null;

  @Column({ name: 'property_slug', type: 'varchar', length: 512, nullable: true })
  property_slug: string | null;

  @Column({ name: 'intent', type: 'varchar', length: 16, nullable: true, default: 'enquiry' })
  intent: string | null;

  @Column({ name: 'visit_date', type: 'date', nullable: true })
  visit_date: string | null;

  @Column({ name: 'visit_slot', type: 'time', nullable: true })
  visit_slot: string | null;

  // Website-enquiry provenance + queue state. Mirrors migration
  // infra/migrations/025_add_inquiry_source_and_ack.sql — synchronize is
  // false, so the migration is the authority and these must agree with it
  // name for name. `source` is 'website' only for public-website forwards;
  // manual edits and Excel imports leave it NULL and never enter the queue.
  @Column({ name: 'source', type: 'varchar', length: 32, nullable: true })
  source: string | null;

  @Column({ name: 'is_new_lead', type: 'boolean', default: false })
  is_new_lead: boolean;

  @Column({ name: 'acknowledged_at', type: 'datetime', precision: 6, nullable: true })
  acknowledged_at: Date | null;

  @Column({ nullable: true })
  funder: string;

  @Column({ type: 'json', nullable: true })
  preferences: any;

  // Buyer Qualification fields
  @Column({ type: 'int', unsigned: true, nullable: true })
  city_id: number | null;

  @Column({ type: 'json', nullable: true })
  sub_locations: string[] | null;

  @Column({ type: 'varchar', length: 100, nullable: true })
  purchase_timeline: string | null;

  @Column({ type: 'varchar', length: 255, nullable: true })
  qualification_purpose: string | null;

  @Column({ type: 'varchar', length: 255, nullable: true })
  decision_maker: string | null;

  @CreateDateColumn()
  created_at: Date;
}
