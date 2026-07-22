import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, ManyToOne, JoinColumn } from 'typeorm';
import { Asset } from './asset.entity';

@Entity('asset_documents')
export class AssetDocument {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'asset_id' })
  asset_id: number;

  @ManyToOne(() => Asset, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'asset_id' })
  asset: Asset;

  @Column({ length: 255 })
  file_name: string;

  @Column({ length: 500 })
  file_url: string;

  @Column({ length: 500 })
  file_key: string;

  @Column({ length: 50, default: 'image' }) // 'image' or 'document'
  file_type: string;

  @CreateDateColumn()
  created_at: Date;
}
