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
