import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, ManyToOne, JoinColumn } from 'typeorm';
import { Lead } from './lead.entity';
import { User } from './user.entity';

@Entity('contact_logs')
export class ContactLog {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'lead_id' })
  lead_id: number;

  @ManyToOne(() => Lead, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'lead_id' })
  lead: Lead;

  // email | sms | whatsapp | call
  @Column()
  contact_type: string;

  // Optional subject/message preview stored for reference
  @Column({ type: 'varchar', nullable: true })
  subject: string | null;

  @Column({ type: 'text', nullable: true })
  message: string | null;

  @Column({ type: 'int', name: 'sent_by_id', nullable: true })
  sent_by_id: number | null;

  @ManyToOne(() => User, { nullable: true })
  @JoinColumn({ name: 'sent_by_id' })
  sent_by: User;

  @CreateDateColumn()
  created_at: Date;
}
