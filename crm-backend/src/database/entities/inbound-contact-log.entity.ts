// fallow-ignore-file circular-dependencies
import type { Relation } from "typeorm";
import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, ManyToOne, JoinColumn } from 'typeorm';
import { Inbound } from './inbound.entity';
import { User } from './user.entity';

@Entity('inbound_contact_logs')
export class InboundContactLog {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'inbound_id' })
  inbound_id: number;

  @ManyToOne(() => Inbound, inbound => inbound.contact_logs, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'inbound_id' })
  inbound: Relation<Inbound>;

  @Column()
  contact_type: string;

  @Column({ nullable: true })
  subject: string;

  @Column({ type: 'text', nullable: true })
  message: string;

  @Column({ name: 'sent_by_id', nullable: true })
  sent_by_id: number;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'sent_by_id' })
  sent_by: User;

  @CreateDateColumn()
  created_at: Date;
}
