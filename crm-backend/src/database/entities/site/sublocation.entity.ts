import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
  Unique,
  UpdateDateColumn,
} from 'typeorm';
import { City } from './city.entity';
import { PropertyLocation } from './property-location.entity';

@Entity('sublocations')
@Unique('uq_sublocations_city_locality', ['cityId', 'localityName'])
@Index('idx_sublocations_is_active', ['isActive'])
export class Sublocation {
  @PrimaryGeneratedColumn({ type: 'int', unsigned: true })
  id!: number;

  @Column({ name: 'city_id', type: 'int', unsigned: true })
  cityId!: number;

  @ManyToOne(() => City, (city) => city.sublocations, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'city_id' })
  city!: City;

  @Column({ name: 'locality_name', type: 'varchar', length: 100 })
  localityName!: string;

  @Column({ name: 'postal_code', type: 'varchar', length: 20, nullable: true })
  postalCode!: string | null;

  @Column({ name: 'latitude', type: 'decimal', precision: 10, scale: 7, nullable: true })
  latitude!: number | null;

  @Column({ name: 'longitude', type: 'decimal', precision: 10, scale: 7, nullable: true })
  longitude!: number | null;

  @Column({ name: 'is_active', type: 'tinyint', default: 1 })
  isActive!: number;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;

  @OneToMany(() => PropertyLocation, (pl) => pl.sublocation)
  propertyLocations!: PropertyLocation[];
}
