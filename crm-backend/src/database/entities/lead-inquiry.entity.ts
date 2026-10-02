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
