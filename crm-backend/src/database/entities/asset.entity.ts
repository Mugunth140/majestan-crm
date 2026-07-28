// fallow-ignore-file circular-dependencies
import type { Relation } from "typeorm";
import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, JoinColumn, ManyToOne, OneToMany, OneToOne } from 'typeorm';
import { User } from './user.entity';
import { AssetLayout } from './asset-layout.entity';
import { AssetDocument } from './asset-document.entity';
import { AssetLocation } from './asset-location.entity';
import { AssetFeature } from './asset-feature.entity';
import { AssetFinancials } from './asset-financials.entity';

@Entity('assets')
export class Asset {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'varchar', nullable: true })
  owner_name: string;

  @Column({ type: 'varchar', nullable: true })
  mobile_number: string;

  @Column({ type: 'varchar', default: 'New' })
  status: string;

  @Column({ type: 'int', default: 0 })
  quality_score: number;

  @Column({ name: 'assigned_staff_id', nullable: true })
  assigned_staff_id: number;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'assigned_staff_id' })
  assigned_staff: Relation<User>;

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;

  @Column({ type: 'varchar', nullable: true })
  display_id: string;

  @Column({ type: 'varchar', nullable: true })
  source: string;

  @Column({ type: 'varchar', nullable: true })
  mediator_name: string;

  @Column({ type: 'varchar', nullable: true })
  cp_reference_name: string;

  @Column({ type: 'date', nullable: true })
  visited_date: Date;

  @Column({ type: 'varchar', nullable: true })
  site_visited_done: string;

  @Column({ type: 'varchar', nullable: true })
  reason_rsv: string;

  @Column({ type: 'varchar', nullable: true })
  photos_taken: string;

  @Column({ type: 'varchar', nullable: true })
  outcome: string;

  @Column({ type: 'text', nullable: true })
  remarks: string;

  @Column({ type: 'varchar', nullable: true })
  checked_by: string;

  @Column({ type: 'varchar', nullable: true })
  approved_by: string;

  @OneToMany(() => AssetLayout, layout => layout.asset)
  layouts: Relation<AssetLayout>[];

  @OneToMany(() => AssetDocument, doc => doc.asset)
  documents: Relation<AssetDocument>[];

  @OneToOne(() => AssetLocation, location => location.asset)
  location: Relation<AssetLocation>;

  @OneToOne(() => AssetFeature, feature => feature.asset)
  feature: Relation<AssetFeature>;

  @OneToOne(() => AssetFinancials, financials => financials.asset)
  financials: Relation<AssetFinancials>;
}
