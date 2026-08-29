import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryColumn,
  UpdateDateColumn,
} from 'typeorm';
import { Property } from './property.entity';
import { Sublocation } from './sublocation.entity';

@Entity('property_locations')
export class PropertyLocation {
  @PrimaryColumn({ name: 'property_id', type: 'int', unsigned: true })
  propertyId!: number;

  @PrimaryColumn({ name: 'location_id', type: 'int', unsigned: true })
  locationId!: number;

  @ManyToOne(() => Property, (property) => property.propertyLocations, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'property_id' })
  property!: Property;

  @ManyToOne(() => Sublocation, (sublocation) => sublocation.propertyLocations, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'location_id' })
  sublocation!: Sublocation;

  @Column({ name: 'landmark', type: 'varchar', length: 255, nullable: true })
  landmark!: string | null;

  @Column({ name: 'address', type: 'text', nullable: true })
  address!: string | null;

  @Column({ name: 'pincode', type: 'varchar', length: 20, nullable: true })
  pincode!: string | null;

  @Column({ name: 'latitude', type: 'decimal', precision: 10, scale: 7, nullable: true })
  latitude!: number | null;

  @Column({ name: 'longitude', type: 'decimal', precision: 10, scale: 7, nullable: true })
  longitude!: number | null;

  @Column({ name: 'locality_data', type: 'json', nullable: true })
  localityData!: any | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;
}
