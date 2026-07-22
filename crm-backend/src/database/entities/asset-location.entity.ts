import { Entity, PrimaryGeneratedColumn, Column, OneToOne, JoinColumn } from 'typeorm';
import { Asset } from './asset.entity';

@Entity('asset_locations')
export class AssetLocation {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'varchar', nullable: true })
  district: string;

  @Column({ type: 'varchar', nullable: true })
  taluk: string;

  @Column({ type: 'varchar', nullable: true })
  village: string;

  @Column({ type: 'varchar', nullable: true })
  road_name: string;

  @Column({ type: 'varchar', nullable: true })
  site_location: string;

  @Column({ type: 'text', nullable: true })
  google_pin: string;

  @Column({ type: 'varchar', nullable: true })
  distance_from_main: string;

  @OneToOne(() => Asset, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'asset_id' })
  asset: Asset;

  @Column({ name: 'asset_id' })
  asset_id: number;
}
