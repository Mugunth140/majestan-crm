// fallow-ignore-file circular-dependencies
import type { Relation } from 'typeorm';
import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, ManyToOne, JoinColumn, Index } from 'typeorm';
import { User } from './user.entity';

@Entity('notifications')
export class Notification {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'user_id' })
  @Index()
  user_id: number;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user: Relation<User>;

  @Column({ type: 'varchar', length: 255 })
  title: string;

  @Column({ type: 'text' })
  message: string;

  // Lead routing: lead_assigned, lead_claimed, lead_claimed_team, lead_transferred, rnr5_unassigned, lead_converted,
  //   lead_enquiry_attached, lead_enquiry_acknowledged, queue_new
  // Any module: record_assigned, record_reassigned (entity_type says which), followup_due, followup_reminder, followup_missed
  // Leads: first_contact_reminder, first_contact_escalation, first_contact_digest, lead_repeat, lead_repeat_team,
  //   lead_milestone, lost_leads_digest, whatsapp_message, whatsapp_unowned
  // Targets: targets_set, pace_alert, pace_team. Account: security
  @Column({ type: 'varchar', length: 50 })
  type: string;

  @Column({ type: 'int', nullable: true })
  entity_id: number | null;

  @Column({ type: 'varchar', length: 50, nullable: true })
  entity_type: string | null; // 'lead'

  @Column({ type: 'boolean', default: false })
  is_read: boolean;

  @CreateDateColumn()
  @Index()
  created_at: Date;
}
