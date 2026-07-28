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

  @Column({ type: 'varchar', nullable: true })
  zone: string;

  @Column({ type: 'varchar', nullable: true })
  junction_name: string;

  @Column({ type: 'varchar', nullable: true })
  distance_from_airport: string;

  @Column({ type: 'varchar', nullable: true })
  firka_range: string;

  @Column({ type: 'varchar', nullable: true })
  haca_range: string;

  @Column({ type: 'varchar', nullable: true })
  adjacent_layout: string;

  @Column({ type: 'varchar', nullable: true })
  approached_roads: string;

  @Column({ type: 'varchar', nullable: true })
  approached_road_width: string;

  @Column({ type: 'decimal', precision: 10, scale: 7, nullable: true })
  latitude: number;

  @Column({ type: 'decimal', precision: 10, scale: 7, nullable: true })
  longitude: number;

  @OneToOne(() => Asset, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'asset_id' })
  asset: Asset;

  @Column({ name: 'asset_id' })
  asset_id: number;
}
