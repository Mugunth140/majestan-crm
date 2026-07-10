// fallow-ignore-file circular-dependencies
import type { Relation } from "typeorm";
import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, ManyToOne, JoinColumn } from 'typeorm';
import { Lead } from './lead.entity';

@Entity('lead_documents')
export class LeadDocument {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'lead_id' })
  lead_id: number;

  @ManyToOne(() => Lead, lead => lead.documents, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'lead_id' })
  lead: Relation<Lead>;

  @Column({ length: 255 })
  file_name: string;

  @Column({ length: 500 })
  file_url: string;

  @Column({ length: 500 })
  file_key: string;

  @CreateDateColumn()
  created_at: Date;
}
