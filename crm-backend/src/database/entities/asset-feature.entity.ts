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

  @Column({ type: 'boolean', default: false })
  near_railway: boolean;

  @Column({ type: 'boolean', default: false })
  near_water_body: boolean;

  @Column({ type: 'boolean', default: false })
  near_burial_ground: boolean;

  @OneToOne(() => Asset, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'asset_id' })
  asset: Asset;

  @Column({ name: 'asset_id' })
  asset_id: number;
}
