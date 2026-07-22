import { Entity, PrimaryGeneratedColumn, Column, OneToOne, JoinColumn } from 'typeorm';
import { Asset } from './asset.entity';

@Entity('asset_financials')
export class AssetFinancials {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'decimal', precision: 15, scale: 2, nullable: true })
  land_price: number;

  @Column({ type: 'decimal', precision: 15, scale: 2, nullable: true })
  dtcp_price: number;

  @Column({ type: 'decimal', precision: 15, scale: 2, nullable: true })
  expectation: number;

  @Column({ type: 'varchar', nullable: true })
  payment_options: string;

  @OneToOne(() => Asset, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'asset_id' })
  asset: Asset;

  @Column({ name: 'asset_id' })
  asset_id: number;
}
