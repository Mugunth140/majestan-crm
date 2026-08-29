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

  @Column({ name: 'uds_area', type: 'decimal', precision: 12, scale: 2, nullable: true })
  udsArea!: string | null;

  @Column({ name: 'unit_number', type: 'varchar', length: 100, nullable: true })
  unitNumber!: string | null;

  @Column({ name: 'unit_type', type: 'varchar', length: 50, nullable: true })
  unitType!: string | null;

  @Column({ name: 'number_of_flats', type: 'int', nullable: true })
  numberOfFlats!: number | null;

  @Column({ name: 'tower_nos', type: 'int', nullable: true })
  towerNos!: number | null;

  @Column({ name: 'pooja_room', type: 'boolean', nullable: true })
  poojaRoom!: boolean | null;

  @Column({ name: 'study_room', type: 'boolean', nullable: true })
  studyRoom!: boolean | null;

  @Column({ name: 'architectural_style', type: 'varchar', length: 100, nullable: true })
  architecturalStyle!: string | null;

  @Column({ name: 'available_portion', type: 'varchar', length: 50, nullable: true })
  availablePortion!: string | null;

  @Column({ name: 'amenities', type: 'text', nullable: true })
  amenities!: string | null;

  @Column({ name: 'plot_nos', type: 'int', nullable: true })
  plotNos!: number | null;

  @Column({ name: 'zoning', type: 'varchar', length: 255, nullable: true })
  zoning!: string | null;

  @Column({ name: 'plot_type', type: 'varchar', length: 100, nullable: true })
  plotType!: string | null;

  @Column({ name: 'land_type', type: 'varchar', length: 100, nullable: true })
  landType!: string | null;

  @Column({ name: 'topography', type: 'varchar', length: 255, nullable: true })
  topography!: string | null;

  @Column({ name: 'soil_type', type: 'varchar', length: 255, nullable: true })
  soilType!: string | null;

  @Column({ name: 'irrigation', type: 'varchar', length: 255, nullable: true })
  irrigation!: string | null;

  @Column({ name: 'fencing', type: 'varchar', length: 255, nullable: true })
  fencing!: string | null;

  @Column({ name: 'crop_suitability', type: 'varchar', length: 255, nullable: true })
  cropSuitability!: string | null;

  @Column({ name: 'existing_plantation', type: 'varchar', length: 255, nullable: true })
  existingPlantation!: string | null;

  @Column({ name: 'bore_well', type: 'boolean', nullable: true })
  boreWell!: boolean | null;

  @Column({ name: 'storage_tank', type: 'boolean', nullable: true })
  storageTank!: boolean | null;

  @Column({ name: 'water_sources', type: 'varchar', length: 255, nullable: true })
  waterSources!: string | null;

  @Column({ name: 'sf_number', type: 'varchar', length: 255, nullable: true })
  sfNumber!: string | null;

  @Column({ name: 'property_use', type: 'varchar', length: 255, nullable: true })
  propertyUse!: string | null;

  @Column({ name: 'no_of_lifts', type: 'int', nullable: true })
  noOfLifts!: number | null;

  @Column({ name: 'dimension', type: 'varchar', length: 255, nullable: true })
  dimension!: string | null;

  @Column({ name: 'frontage', type: 'varchar', length: 100, nullable: true })
  frontage!: string | null;

  @Column({ name: 'outside_parking', type: 'boolean', nullable: true })
  outsideParking!: boolean | null;

  @Column({ name: 'visitors_parking', type: 'varchar', length: 100, nullable: true })
  visitorsParking!: string | null;

  @Column({ name: 'fire_safety', type: 'boolean', nullable: true })
  fireSafety!: boolean | null;

  @Column({ name: 'electricity_connection', type: 'varchar', length: 255, nullable: true })
  electricityConnection!: string | null;

  @Column({ name: 'conference_room', type: 'int', nullable: true })
  conferenceRoom!: number | null;

  @Column({ name: 'seater', type: 'int', nullable: true })
  seater!: number | null;

  @Column({ name: 'tenant_mix', type: 'varchar', length: 255, nullable: true })
  tenantMix!: string | null;

  @Column({ name: 'building_type', type: 'varchar', length: 100, nullable: true })
  buildingType!: string | null;

  @Column({ name: 'number_of_bays', type: 'int', nullable: true })
  numberOfBays!: number | null;

  @Column({ name: 'number_of_cabins', type: 'int', nullable: true })
  numberOfCabins!: number | null;

  @Column({ name: 'loading_bays', type: 'int', nullable: true })
  loadingBays!: number | null;

  @Column({ name: 'warehouse_racks', type: 'int', nullable: true })
  warehouseRacks!: number | null;

  @Column({ name: 'truck_trailer_access', type: 'boolean', nullable: true })
  truckTrailerAccess!: boolean | null;

  @Column({ name: 'crane_available', type: 'boolean', nullable: true })
  craneAvailable!: boolean | null;

  @Column({ name: 'worker_facilities', type: 'text', nullable: true })
  workerFacilities!: string | null;

  @Column({ name: 'nearest_highway', type: 'varchar', length: 255, nullable: true })
  nearestHighway!: string | null;

  @Column({ name: 'nearest_railway', type: 'varchar', length: 255, nullable: true })
  nearestRailway!: string | null;

  @Column({ name: 'nearest_port', type: 'varchar', length: 255, nullable: true })
  nearestPort!: string | null;

  @Column({ name: 'nearest_airport', type: 'varchar', length: 255, nullable: true })
  nearestAirport!: string | null;

  @Column({ name: 'labour_availability', type: 'varchar', length: 255, nullable: true })
  labourAvailability!: string | null;

  @Column({ name: 'advance_rent', type: 'decimal', precision: 12, scale: 2, nullable: true })
  advanceRent!: string | null;

  @Column({ name: 'lease_term', type: 'varchar', length: 100, nullable: true })
  leaseTerm!: string | null;

  @Column({ name: 'incremental_rent', type: 'varchar', length: 100, nullable: true })
  incrementalRent!: string | null;

  @Column({ name: 'electricity_charges', type: 'varchar', length: 100, nullable: true })
  electricityCharges!: string | null;

  @Column({ name: 'high_speed_wifi', type: 'boolean', nullable: true })
  highSpeedWifi!: boolean | null;

  @Column({ name: 'air_conditioning', type: 'boolean', nullable: true })
  airConditioning!: boolean | null;

  @Column({ name: 'cctv_surveillance', type: 'boolean', nullable: true })
  cctvSurveillance!: boolean | null;

  @Column({ name: 'elevator_access', type: 'boolean', nullable: true })
  elevatorAccess!: boolean | null;

  @Column({ name: 'security_staff', type: 'boolean', nullable: true })
  securityStaff!: boolean | null;

  @Column({ name: 'furniture_provided', type: 'text', nullable: true })
  furnitureProvided!: string | null;

  @Column({ name: 'outdoor_spaces', type: 'text', nullable: true })
  outdoorSpaces!: string | null;

  @Column({ name: 'utilities_provided', type: 'text', nullable: true })
  utilitiesProvided!: string | null;

  @Column({ name: 'neighborhood_highlights', type: 'text', nullable: true })
  neighborhoodHighlights!: string | null;

  @Column({ name: 'community_facilities', type: 'text', nullable: true })
  communityFacilities!: string | null;

  @Column({ name: 'accessibility', type: 'text', nullable: true })
  accessibility!: string | null;

  @OneToOne(() => Property, (property) => property.propertyDetails, {
    lazy: true,
    nullable: false,
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'property_id', referencedColumnName: 'id' })
  property!: Promise<Property>;
}
