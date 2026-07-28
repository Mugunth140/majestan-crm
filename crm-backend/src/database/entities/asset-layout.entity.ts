import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn, CreateDateColumn } from 'typeorm';
import { Asset } from './asset.entity';

@Entity('asset_layouts')
export class AssetLayout {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'asset_id' })
  asset_id: number;

  @ManyToOne(() => Asset, asset => asset.layouts, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'asset_id' })
  asset: Asset;

  @Column({ type: 'varchar', nullable: true })
  layout_no: string;

  @Column({ type: 'varchar', nullable: true })
  name: string;

  @Column({ type: 'decimal', precision: 15, scale: 2, nullable: true })
  price: number;

  @Column({ type: 'varchar', nullable: true })
  duration: string;

  @Column({ type: 'int', nullable: true })
  no_of_plots: number;

  @CreateDateColumn()
  created_at: Date;
}
