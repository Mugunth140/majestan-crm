import type { Relation } from "typeorm";
import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, ManyToOne, JoinColumn, Index } from 'typeorm';
import { Inbound } from './inbound.entity';

@Entity('inbound_units')
@Index('IDX_inbound_units_inbound_id', ['inbound_id'])
export class InboundUnit {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'inbound_id' })
  inbound_id: number;

  @ManyToOne(() => Inbound, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'inbound_id' })
  inbound: Relation<Inbound>;

  // Free label: "Ground Floor", "1st Floor", "Mezzanine", ...
  @Column({ type: 'varchar', length: 100 })
  floor_label: string;

  // Free text: "1200 sqft", "2.5 cents", ...
  @Column({ type: 'varchar', length: 100, nullable: true })
  area: string | null;

  // Rent or sale price for this floor (meaning follows inbound.purpose).
  @Column({ type: 'decimal', precision: 12, scale: 2, nullable: true })
  price: number | null;

  @Column({ type: 'text', nullable: true })
  notes: string | null;

  @CreateDateColumn()
  created_at: Date;
}
