// fallow-ignore-file circular-dependencies
import type { Relation } from "typeorm";
import { Entity, PrimaryGeneratedColumn, Column, OneToOne, JoinColumn } from 'typeorm';
import { Asset } from './asset.entity';

@Entity('asset_features')
export class AssetFeature {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'varchar', nullable: true })
  extent: string;

  @Column({ type: 'varchar', nullable: true })
  soil_type: string;

  @Column({ type: 'varchar', nullable: true })
  water_source: string;

  @Column({ type: 'varchar', nullable: true })
  near_railway: string;

  @Column({ type: 'varchar', nullable: true })
  near_water_body: string;

  @Column({ type: 'varchar', nullable: true })
  near_burial_ground: string;

  @Column({ type: 'varchar', nullable: true })
  classification_type: string;

  @Column({ type: 'varchar', nullable: true })
  classified_area: string;

  @Column({ type: 'varchar', nullable: true })
  saleable_area: string;

  @Column({ type: 'varchar', nullable: true })
  tslr: string;

  @Column({ type: 'varchar', nullable: true })
  water_depth: string;

  @Column({ type: 'varchar', nullable: true })
  high_voltage_line: string;

  @Column({ type: 'varchar', nullable: true })
  canal: string;

  @Column({ type: 'varchar', nullable: true })
  presence_of_well: string;

  @Column({ type: 'varchar', nullable: true })
  borewell: string;

  @OneToOne('Asset', { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'asset_id' })
  asset: Relation<any>;

  @Column({ name: 'asset_id' })
  asset_id: number;
}
