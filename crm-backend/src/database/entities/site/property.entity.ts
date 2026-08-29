import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  OneToMany,
  OneToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { PropertyDetails } from './property-details.entity';
import { PropertyImage } from './property-image.entity';
import { PropertyLocation } from './property-location.entity';

export enum PropertyType {
  APARTMENT = 'apartment',
  VILLA = 'villa',
  PLOT = 'plot',
  COMMERCIAL = 'commercial',
  COWORKING = 'coworking',
  FARMLAND = 'farmland',
  INDUSTRIAL = 'industrial',
  OTHER = 'other',
  INDIVIDUAL_PORTION = 'individual_portion',
}

export enum PropertyStatus {
  AVAILABLE = 'available',
  SOLD = 'sold',
  RENTED = 'rented',
  UNAVAILABLE = 'unavailable',
}

@Entity('properties')
@Index('idx_properties_city', ['city'])
@Index('idx_properties_price', ['price'])
@Index('idx_properties_status', ['status'])
@Index('idx_properties_owner_id', ['ownerId'])
@Index('idx_properties_property_code', ['propertyCode'], { unique: true })
@Index('idx_properties_slug', ['slug'], { unique: true })
export class Property {
  @PrimaryGeneratedColumn({ type: 'int', unsigned: true })
  id!: number;

  @Column({
    name: 'property_code',
    type: 'varchar',
    length: 64,
    nullable: true,
  })
  propertyCode!: string | null;

  @Column({ name: 'slug', type: 'varchar', length: 512, nullable: true })
  slug!: string | null;

  @Column({ name: 'title', type: 'varchar', length: 255, nullable: false })
  title!: string;

  @Column({ name: 'description', type: 'text', nullable: false })
  description!: string;

  @Column({
    name: 'price',
    type: 'decimal',
    precision: 12,
    scale: 2,
    nullable: true,
  })
  price!: string | null;

  @Column({
    name: 'property_type',
    type: 'enum',
    enum: PropertyType,
    nullable: false,
  })
  propertyType!: PropertyType;

  @Column({
    name: 'listing_type',
    type: 'enum',
    enum: ['Sell', 'Rent'],
    nullable: false,
    default: 'Sell',
  })
  listingType!: 'Sell' | 'Rent';

  @Column({
    name: 'status',
    type: 'enum',
    enum: PropertyStatus,
    nullable: false,
  })
  status!: PropertyStatus;

  @Column({ name: 'owner_id', type: 'int', unsigned: true, nullable: true })
  ownerId!: number | null;

  @Column({ name: 'builder_name', type: 'varchar', length: 255, nullable: true })
  builderName!: string | null;

  @Column({ name: 'city', type: 'varchar', length: 255, nullable: false })
  city!: string;

  @Column({ name: 'state', type: 'varchar', length: 255, nullable: false })
  state!: string;

  @Column({ name: 'country', type: 'varchar', length: 255, nullable: false })
  country!: string;

  @Column({ name: 'property_condition', type: 'varchar', length: 50, nullable: true })
  propertyCondition!: string | null;

  @Column({ name: 'ownership_type', type: 'varchar', length: 50, nullable: true })
  ownershipType!: string | null;

  @Column({ name: 'rera_number', type: 'varchar', length: 100, nullable: true })
  reraNumber!: string | null;

  @Column({ name: 'project_name', type: 'varchar', length: 255, nullable: true })
  projectName!: string | null;

  @Column({ name: 'negotiable', type: 'boolean', default: false })
  negotiable!: boolean;

  @Column({ name: 'maintenance_charges', type: 'varchar', length: 100, nullable: true })
  maintenanceCharges!: string | null;

  @Column({ name: 'security_deposit', type: 'varchar', length: 100, nullable: true })
  securityDeposit!: string | null;

  @Column({ name: 'booking_amount', type: 'varchar', length: 100, nullable: true })
  bookingAmount!: string | null;

  @Column({ name: 'brokerage_type', type: 'varchar', length: 50, nullable: true, default: 'no_brokerage' })
  brokerageType!: string | null;

  @Column({ name: 'brokerage_value', type: 'varchar', length: 100, nullable: true })
  brokerageValue!: string | null;

  @Column({ name: 'available_from', type: 'date', nullable: true })
  availableFrom!: Date | null;

  @Column({ name: 'available_until', type: 'date', nullable: true })
  availableUntil!: Date | null;

  @Column({ name: 'verification_status', type: 'varchar', length: 50, default: 'Pending' })
  verificationStatus!: string;

  @Column({ name: 'approval_status', type: 'varchar', length: 50, default: 'Pending' })
  approvalStatus!: string;

  @Column({ name: 'owner_name', type: 'varchar', length: 255, nullable: true })
  ownerName!: string | null;

  @Column({ name: 'owner_email', type: 'varchar', length: 255, nullable: true })
  ownerEmail!: string | null;

  @Column({ name: 'owner_phone', type: 'varchar', length: 50, nullable: true })
  ownerPhone!: string | null;

  @CreateDateColumn({
    name: 'created_at',
    type: 'timestamp',
    nullable: false,
    default: () => 'CURRENT_TIMESTAMP(6)',
  })
  createdAt!: Date;

  @UpdateDateColumn({
    name: 'updated_at',
    type: 'timestamp',
    nullable: false,
    default: () => 'CURRENT_TIMESTAMP(6)',
    onUpdate: 'CURRENT_TIMESTAMP(6)',
  })
  updatedAt!: Date;

  @OneToOne(
    'PropertyDetails',
    (propertyDetails: any) => propertyDetails.property,
    { lazy: true },
  )
  propertyDetails!: Promise<PropertyDetails>;

  @OneToMany('PropertyImage', (propertyImage: any) => propertyImage.property, {
    lazy: true,
  })
  propertyImages!: Promise<PropertyImage[]>;

  @OneToMany('PropertyLocation', (propertyLocation: any) => propertyLocation.property, { lazy: true })
  propertyLocations!: Promise<PropertyLocation[]>;
}
