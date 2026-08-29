import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { Property } from './property.entity';

@Entity('property_images')
@Index('idx_property_images_property_id', ['propertyId'])
export class PropertyImage {
  @PrimaryGeneratedColumn({ type: 'int', unsigned: true })
  id!: number;

  @Column({ name: 'property_id', type: 'int', unsigned: true, nullable: false })
  propertyId!: number;

  @Column({ name: 'image_url', type: 'varchar', length: 1024, nullable: false })
  imageUrl!: string;

  @Column({ name: 'image_key', type: 'varchar', length: 1024, nullable: false })
  imageKey!: string;

  @Column({
    name: 'is_primary',
    type: 'boolean',
    nullable: false,
    default: false,
  })
  isPrimary!: boolean;

  @CreateDateColumn({
    name: 'created_at',
    type: 'timestamp',
    nullable: false,
    default: () => 'CURRENT_TIMESTAMP(6)',
  })
  createdAt!: Date;

  @ManyToOne(() => Property, (property) => property.propertyImages, {
    lazy: true,
    nullable: false,
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'property_id', referencedColumnName: 'id' })
  property!: Promise<Property>;
}
