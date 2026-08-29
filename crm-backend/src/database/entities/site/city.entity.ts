import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
  Unique,
} from 'typeorm';
import { Sublocation } from './sublocation.entity';

@Entity('cities')
@Index('idx_cities_is_active', ['isActive'])
@Unique('uq_cities_name_state_country', ['cityName', 'stateName', 'countryCode'])
export class City {
  @PrimaryGeneratedColumn({ type: 'int', unsigned: true })
  id!: number;

  @Column({ name: 'country_code', type: 'char', length: 2, default: 'IN' })
  countryCode!: string;

  @Column({ name: 'country_name', type: 'varchar', length: 100, default: 'India' })
  countryName!: string;

  @Column({ name: 'state_name', type: 'varchar', length: 50, nullable: false })
  stateName!: string;

  @Column({ name: 'city_name', type: 'varchar', length: 50, nullable: false })
  cityName!: string;

  @Column({ name: 'is_active', type: 'tinyint', default: 1 })
  isActive!: number;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;

  @OneToMany(() => Sublocation, (sublocation) => sublocation.city)
  sublocations!: Sublocation[];
}
