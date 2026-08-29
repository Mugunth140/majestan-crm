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

  @Column({ name: 'alternate_name', type: 'varchar', length: 255, nullable: true })
  alternateName!: string | null;

  @Column({ name: 'alternate_phone', type: 'varchar', length: 50, nullable: true })
  alternatePhone!: string | null;

  @Column({ name: 'alternate_email', type: 'varchar', length: 255, nullable: true })
  alternateEmail!: string | null;

  @Column({ name: 'transaction_type', type: 'varchar', length: 100, nullable: true })
  transactionType!: string | null;

  @Column({ name: 'handover_date', type: 'varchar', length: 100, nullable: true })
  handoverDate!: string | null;

  @Column({ name: 'road_name', type: 'varchar', length: 255, nullable: true })
  roadName!: string | null;

  @Column({ name: 'road_access', type: 'varchar', length: 100, nullable: true })
  roadAccess!: string | null;

  @Column({ name: 'tenant_occupied', type: 'varchar', length: 100, nullable: true })
  tenantOccupied!: string | null;

  @Column({ name: 'sale_type', type: 'varchar', length: 50, nullable: true })
  saleType!: string | null;

  @Column({ name: 'agent_name', type: 'varchar', length: 255, nullable: true })
  agentName!: string | null;

  @Column({ name: 'agency_name', type: 'varchar', length: 255, nullable: true })
  agencyName!: string | null;

  @Column({ name: 'commission_terms', type: 'varchar', length: 255, nullable: true })
  commissionTerms!: string | null;

  @Column({ name: 'expected_sale_price', type: 'decimal', precision: 12, scale: 2, nullable: true })
  expectedSalePrice!: string | null;

  @Column({ name: 'monthly_rent', type: 'decimal', precision: 12, scale: 2, nullable: true })
  monthlyRent!: string | null;

  @Column({ name: 'lock_in_period', type: 'varchar', length: 100, nullable: true })
  lockInPeriod!: string | null;

  @Column({ name: 'taxes', type: 'varchar', length: 255, nullable: true })
  taxes!: string | null;

  @Column({ name: 'registration_charge', type: 'varchar', length: 255, nullable: true })
  registrationCharge!: string | null;

  @Column({ name: 'mode_of_payment', type: 'varchar', length: 255, nullable: true })
  modeOfPayment!: string | null;

  @Column({ name: 'time_for_registration', type: 'varchar', length: 100, nullable: true })
  timeForRegistration!: string | null;

  @Column({ name: 'remark', type: 'text', nullable: true })
  remark!: string | null;

  @Column({ name: 'demand_area', type: 'varchar', length: 100, nullable: true })
  demandArea!: string | null;

  @Column({ name: 'rental_yield', type: 'varchar', length: 100, nullable: true })
  rentalYield!: string | null;

  @Column({ name: 'comparative_price', type: 'varchar', length: 100, nullable: true })
  comparativePrice!: string | null;

  @Column({ name: 'market_price', type: 'varchar', length: 100, nullable: true })
  marketPrice!: string | null;

  @Column({ name: 'ownership_title_verified', type: 'varchar', length: 50, nullable: true })
  ownershipTitleVerified!: string | null;

  @Column({ name: 'encumbrance_certificate', type: 'varchar', length: 50, nullable: true })
  encumbranceCertificate!: string | null;

  @Column({ name: 'rental_agreement_draft', type: 'varchar', length: 50, nullable: true })
  rentalAgreementDraft!: string | null;

  @Column({ name: 'tslr_fmb', type: 'varchar', length: 50, nullable: true })
  tslrFmb!: string | null;

  @Column({ name: 'tax_receipt', type: 'varchar', length: 50, nullable: true })
  taxReceipt!: string | null;

  @Column({ name: 'eb_receipt', type: 'varchar', length: 50, nullable: true })
  ebReceipt!: string | null;

  @Column({ name: 'patta_chitta', type: 'varchar', length: 50, nullable: true })
  pattaChitta!: string | null;

  @Column({ name: 'approvals', type: 'varchar', length: 255, nullable: true })
  approvals!: string | null;

  @Column({ name: 'finance_facing', type: 'varchar', length: 50, nullable: true })
  financeFacing!: string | null;

  @Column({ name: 'hypothecation', type: 'varchar', length: 50, nullable: true })
  hypothecation!: string | null;

  @Column({ name: 'deviation', type: 'varchar', length: 50, nullable: true })
  deviation!: string | null;

  @Column({ name: 'attachment1', type: 'varchar', length: 1024, nullable: true })
  attachment1!: string | null;

  @Column({ name: 'attachment2', type: 'varchar', length: 1024, nullable: true })
  attachment2!: string | null;

  @Column({ name: 'attachment3', type: 'varchar', length: 1024, nullable: true })
  attachment3!: string | null;

  @Column({ name: 'attachment4', type: 'varchar', length: 1024, nullable: true })
  attachment4!: string | null;

  @Column({ name: 'attachment5', type: 'varchar', length: 1024, nullable: true })
  attachment5!: string | null;

  @Column({ name: 'attachment6', type: 'varchar', length: 1024, nullable: true })
  attachment6!: string | null;

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
