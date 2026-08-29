import {
  Column,
  Entity,
  Index,
  JoinColumn,
  OneToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { Property } from './property.entity';

@Entity('property_details')
@Index('uq_property_details_property_id', ['propertyId'], { unique: true })
export class PropertyDetails {
  @PrimaryGeneratedColumn({ type: 'int', unsigned: true })
  id!: number;

  @Column({
    name: 'property_id',
    type: 'int',
    unsigned: true,
    nullable: false,
    unique: true,
  })
  propertyId!: number;

  @Column({ name: 'bedrooms', type: 'int', nullable: false })
  bedrooms!: number;

  @Column({ name: 'bathrooms', type: 'int', nullable: false })
  bathrooms!: number;

  @Column({
    name: 'area_sqft',
    type: 'decimal',
    precision: 12,
    scale: 2,
    nullable: false,
  })
  areaSqft!: string;

  @Column({ name: 'parking', type: 'int', nullable: false })
  parking!: number;

  @Column({ name: 'furnished', type: 'boolean', nullable: false })
  furnished!: boolean;

  @Column({ name: 'balconies', type: 'int', default: 0 })
  balconies!: number;

  @Column({ name: 'floor_number', type: 'varchar', length: 50, nullable: true })
  floorNumber!: string | null;

  @Column({ name: 'total_floors', type: 'int', default: 0 })
  totalFloors!: number;

  @Column({ name: 'built_up_area', type: 'decimal', precision: 12, scale: 2, nullable: true })
  builtUpArea!: string | null;

  @Column({ name: 'carpet_area', type: 'decimal', precision: 12, scale: 2, nullable: true })
  carpetArea!: string | null;

  @Column({ name: 'super_built_up_area', type: 'decimal', precision: 12, scale: 2, nullable: true })
  superBuiltUpArea!: string | null;

  @Column({ name: 'plot_area', type: 'decimal', precision: 12, scale: 2, nullable: true })
  plotArea!: string | null;

  @Column({ name: 'area_unit', type: 'varchar', length: 50, default: 'Sq Ft' })
  areaUnit!: string;

  @Column({ name: 'property_facing', type: 'varchar', length: 50, nullable: true })
  propertyFacing!: string | null;

  @Column({ name: 'property_age', type: 'varchar', length: 50, nullable: true })
  propertyAge!: string | null;

  @Column({ name: 'possession_status', type: 'varchar', length: 50, nullable: true })
  possessionStatus!: string | null;

  @Column({ name: 'water_supply', type: 'varchar', length: 255, nullable: true })
  waterSupply!: string | null;

  @Column({ name: 'power_backup', type: 'boolean', nullable: true })
  powerBackup!: boolean | null;

  @Column({ name: 'road_width', type: 'varchar', length: 100, nullable: true })
  roadWidth!: string | null;

  @Column({ name: 'open_sides', type: 'int', default: 0 })
  openSides!: number;

  @Column({ name: 'plot_length', type: 'decimal', precision: 12, scale: 2, nullable: true })
  plotLength!: string | null;

  @Column({ name: 'plot_width', type: 'decimal', precision: 12, scale: 2, nullable: true })
  plotWidth!: string | null;

  @Column({ name: 'boundary_wall', type: 'boolean', nullable: true })
  boundaryWall!: boolean | null;

  @Column({ name: 'suitable_for', type: 'varchar', length: 255, nullable: true })
  suitableFor!: string | null;

  @Column({ name: 'has_pantry', type: 'boolean', nullable: true })
  hasPantry!: boolean | null;

  @Column({ name: 'has_central_ac', type: 'boolean', nullable: true })
  hasCentralAc!: boolean | null;

  @Column({ name: 'ceiling_height_ft', type: 'decimal', precision: 12, scale: 2, nullable: true })
  ceilingHeightFt!: string | null;

  @Column({ name: 'heavy_vehicle_access', type: 'boolean', nullable: true })
  heavyVehicleAccess!: boolean | null;

  @Column({ name: 'plot_size_cents', type: 'decimal', precision: 12, scale: 4, nullable: true })
  plotSizeCents!: string | null;

  @Column({ name: 'min_seats', type: 'int', nullable: true })
  minSeats!: number | null;

  @Column({ name: 'rent_per_seat', type: 'decimal', precision: 12, scale: 2, nullable: true })
  rentPerSeat!: string | null;

  @Column({ name: 'private_cabins', type: 'int', nullable: true })
  privateCabins!: number | null;

  @Column({ name: 'meeting_rooms', type: 'int', nullable: true })
  meetingRooms!: number | null;

  @Column({ name: 'available_workstations', type: 'int', nullable: true })
  availableWorkstations!: number | null;

  @Column({ name: 'has_restroom', type: 'boolean', nullable: true })
  hasRestroom!: boolean | null;

  @Column({ name: 'floors_occupied', type: 'simple-json', nullable: true })
  floorsOccupied!: string[] | null;

  @Column({ name: 'truck_parking', type: 'int', nullable: true })
  truckParking!: number | null;

  @Column({ name: 'car_parking', type: 'int', nullable: true })
  carParking!: number | null;

  @Column({ name: 'bike_parking', type: 'int', nullable: true })
  bikeParking!: number | null;

  @Column({ name: 'covered_area', type: 'decimal', precision: 12, scale: 2, nullable: true })
  coveredArea!: string | null;

  @Column({ name: 'open_area', type: 'decimal', precision: 12, scale: 2, nullable: true })
  openArea!: string | null;

  @Column({ name: 'floor_type', type: 'varchar', length: 100, nullable: true })
  floorType!: string | null;

  @Column({ name: 'power_supply_hp', type: 'decimal', precision: 10, scale: 2, nullable: true })
  powerSupplyHp!: string | null;

  @Column({ name: 'guest_parking', type: 'boolean', nullable: true })
  guestParking!: boolean | null;

  @Column({ name: 'room_dimensions', type: 'simple-json', nullable: true })
  roomDimensions!: { name: string; dimensions: string }[] | null;

  @Column({ name: 'floor_plan_images', type: 'simple-json', nullable: true })
  floorPlanImages!: { title: string; imageUrl: string; imageKey: string }[] | null;

  @OneToOne(() => Property, (property) => property.propertyDetails, {
    lazy: true,
    nullable: false,
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'property_id', referencedColumnName: 'id' })
  property!: Promise<Property>;
}
