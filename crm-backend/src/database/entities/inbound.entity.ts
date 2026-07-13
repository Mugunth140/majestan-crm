import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  BeforeInsert,
  BeforeUpdate,
  OneToMany,
} from 'typeorm';

import { InboundFollowUp } from './inbound-follow-up.entity';
import { InboundContactLog } from './inbound-contact-log.entity';

@Entity('inbounds')
export class Inbound {
  @PrimaryGeneratedColumn()
  id: number;

  @OneToMany(() => InboundFollowUp, followUp => followUp.inbound)
  follow_ups: InboundFollowUp[];

  @OneToMany(() => InboundContactLog, log => log.inbound)
  contact_logs: InboundContactLog[];


  @Column({ type: 'varchar', unique: true, nullable: true }) // Set nullable to true since we generate it after insert
  property_id: string;

  @Column({ type: 'varchar', nullable: true })
  property_category: string;

  @Column({ type: 'varchar', nullable: true })
  property_type: string;

  @Column({ type: 'varchar', nullable: true })
  purpose: string;

  @Column({ type: 'varchar', nullable: true })
  property_title: string;

  @Column({ type: 'varchar', nullable: true })
  state: string;

  @Column({ type: 'varchar', nullable: true })
  city: string;

  @Column({ type: 'varchar', nullable: true })
  area: string;

  @Column({ type: 'varchar', nullable: true })
  locality: string;

  @Column({ type: 'varchar', nullable: true })
  landmark: string;

  @Column({ type: 'text', nullable: true })
  google_map_location: string;

  @Column({ type: 'varchar', default: 'New Inbound' })
  status: string;

  // Owner Info
  @Column({ type: 'varchar', nullable: true })
  owner_name: string;

  @Column({ type: 'varchar', nullable: true })
  mobile_number: string;

  @Column({ type: 'varchar', nullable: true })
  whatsapp_number: string;

  @Column({ type: 'varchar', nullable: true })
  email: string;

  @Column({ type: 'text', nullable: true })
  address: string;

  @Column({ type: 'varchar', nullable: true })
  preferred_contact_time: string;

  @Column({ type: 'varchar', nullable: true })
  alternate_contact: string;

  @Column({ type: 'boolean', default: false })
  pan_available: boolean;

  @Column({ type: 'boolean', default: false })
  gst_applicable: boolean;

  // Contact Info
  @Column({ type: 'varchar', nullable: true })
  primary_contact: string;

  @Column({ type: 'varchar', nullable: true })
  building_manager_name: string;

  @Column({ type: 'varchar', nullable: true })
  manager_mobile: string;

  @Column({ type: 'varchar', nullable: true })
  caretaker_name: string;

  @Column({ type: 'varchar', nullable: true })
  caretaker_mobile: string;

  @Column({ type: 'varchar', nullable: true })
  security_contact: string;

  @Column({ type: 'varchar', nullable: true })
  key_available_with: string;

  @Column({ type: 'boolean', default: false })
  prior_appointment_required: boolean;

  // Brokerage
  @Column({ type: 'varchar', nullable: true })
  brokerage_accepted: string;

  @Column({ type: 'simple-array', nullable: true })
  brokerage_paid_by: string[];

  @Column({ type: 'varchar', nullable: true })
  brokerage_type: string;

  @Column({ type: 'decimal', precision: 5, scale: 2, nullable: true })
  percentage: number;

  @Column({ type: 'decimal', precision: 12, scale: 2, nullable: true })
  fixed_amount: number;

  @Column({ type: 'varchar', nullable: true })
  rental_brokerage: string;

  @Column({ type: 'text', nullable: true })
  brokerage_remarks: string;

  // Media
  @Column({ type: 'text', nullable: true })
  image_url: string;

  @Column({ type: 'text', nullable: true })
  video_url: string;

  @Column({ type: 'boolean', default: false })
  documents_collected: boolean;

  @Column({ type: 'boolean', default: false })
  is_exclusive: boolean;

  @Column({ type: 'boolean', default: false })
  is_prime_location: boolean;

  // Platforms
  @Column({ type: 'simple-array', nullable: true })
  listed_on: string[];

  // Score
  @Column({ type: 'int', default: 0 })
  quality_score: number;

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;

  @BeforeInsert()
  @BeforeUpdate()
  calculateQualityScore() {
    let score = 0;
    
    // Base points for owner details
    if (this.owner_name) score += 10;
    if (this.mobile_number) score += 15;
    if (this.email) score += 5;
    
    // Property Details
    if (this.property_category && this.property_type) score += 10;
    if (this.locality || this.area) score += 10;
    if (this.google_map_location) score += 10;

    // Contact details
    if (this.primary_contact) score += 5;

    // Media
    if (this.image_url) score += 10;
    if (this.video_url) score += 5;
    if (this.documents_collected) score += 5;

    // Tags
    if (this.is_exclusive) score += 10;
    if (this.is_prime_location) score += 5;

    this.quality_score = Math.min(score, 100);
  }
}
