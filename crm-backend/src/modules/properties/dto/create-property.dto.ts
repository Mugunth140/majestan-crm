import {
  IsArray,
  IsBoolean,
  IsNumber,
  IsObject,
  IsOptional,
  IsString,
} from 'class-validator';
import { Type } from 'class-transformer';

export class CreatePropertyDto {
  @IsString()
  title!: string;

  @IsString()
  listingType!: 'Sell' | 'Rent';

  @IsString()
  propertyType!: 'apartment' | 'villa' | 'plot' | 'commercial' | 'coworking' | 'farmland' | 'industrial' | 'individual_portion';

  @IsOptional() @Type(() => Number) @IsNumber()
  price!: number;

  @IsOptional() @Type(() => Number) @IsNumber()
  cityId!: number;

  @IsOptional() @Type(() => Number) @IsNumber()
  sublocationId?: number;

  @IsOptional() @Type(() => Number) @IsNumber()
  bedrooms?: number;

  @IsOptional() @Type(() => Number) @IsNumber()
  bathrooms?: number;

  @IsOptional() @Type(() => Number) @IsNumber()
  areaSqft?: number;

  @IsOptional() @Type(() => Number) @IsNumber()
  parking?: number;

  @IsOptional() @IsBoolean()
  furnished?: boolean;

  @IsOptional() @IsString()
  furnishingStatus?: string;

  @IsOptional() @IsString()
  propertyFacing?: string;

  @IsOptional() @IsString()
  propertyAge?: string;

  @IsOptional() @IsString()
  floorNumber?: string;

  @IsOptional() @Type(() => Number) @IsNumber()
  totalFloors?: number;

  @IsOptional() @IsString()
  ownerName?: string;

  @IsOptional() @IsString()
  ownerPhone?: string;

  @IsOptional() @IsString()
  ownerEmail?: string;

  @IsOptional() @IsString()
  description?: string;

  @IsOptional() @IsString()
  status?: 'available' | 'sold' | 'rented' | 'unavailable';

  @IsOptional() @IsBoolean()
  negotiable?: boolean;

  @IsOptional() @IsArray()
  imageUrls?: { imageUrl: string; imageKey: string; isPrimary: boolean }[];

  @IsOptional() @IsArray()
  documents?: { fileKey: string; fileName?: string; mimeType?: string; fileSize?: number; documentType?: string; title?: string }[];

  @IsOptional() @IsObject()
  locationData?: { address?: string; latitude?: number; longitude?: number };

  @IsOptional() @IsString()
  maintenanceCharges?: string;

  @IsOptional() @IsString()
  securityDeposit?: string;

  @IsOptional() @IsString()
  reraNumber?: string;

  // ── Property table: alternate contact ──────────────────────────────────────
  @IsOptional() @IsString()
  alternateName?: string;

  @IsOptional() @IsString()
  alternatePhone?: string;

  @IsOptional() @IsString()
  alternateEmail?: string;

  // ── Property table: transaction info ──────────────────────────────────────
  @IsOptional() @IsString()
  transactionType?: string;

  @IsOptional() @IsString()
  handoverDate?: string;

  @IsOptional() @IsString()
  roadName?: string;

  @IsOptional() @IsString()
  roadAccess?: string;

  @IsOptional() @IsString()
  tenantOccupied?: string;

  @IsOptional() @IsString()
  saleType?: string;

  // ── Property table: agent info ─────────────────────────────────────────────
  @IsOptional() @IsString()
  agentName?: string;

  @IsOptional() @IsString()
  agencyName?: string;

  @IsOptional() @IsString()
  commissionTerms?: string;

  // ── Property table: pricing ────────────────────────────────────────────────
  @IsOptional() @IsNumber() @Type(() => Number)
  expectedSalePrice?: number;

  @IsOptional() @IsNumber() @Type(() => Number)
  monthlyRent?: number;

  // ── Property table: legal / payment ───────────────────────────────────────
  @IsOptional() @IsString()
  lockInPeriod?: string;

  @IsOptional() @IsString()
  taxes?: string;

  @IsOptional() @IsString()
  registrationCharge?: string;

  @IsOptional() @IsString()
  modeOfPayment?: string;

  @IsOptional() @IsString()
  timeForRegistration?: string;

  // ── Property table: remarks / market ──────────────────────────────────────
  @IsOptional() @IsString()
  remark?: string;

  @IsOptional() @IsString()
  demandArea?: string;

  @IsOptional() @IsString()
  rentalYield?: string;

  @IsOptional() @IsString()
  comparativePrice?: string;

  @IsOptional() @IsString()
  marketPrice?: string;

  // ── Property table: documents ──────────────────────────────────────────────
  @IsOptional() @IsString()
  ownershipTitleVerified?: string;

  @IsOptional() @IsString()
  encumbranceCertificate?: string;

  @IsOptional() @IsString()
  rentalAgreementDraft?: string;

  @IsOptional() @IsString()
  tslrFmb?: string;

  @IsOptional() @IsString()
  taxReceipt?: string;

  @IsOptional() @IsString()
  ebReceipt?: string;

  @IsOptional() @IsString()
  pattaChitta?: string;

  // ── Property table: compliance ─────────────────────────────────────────────
  @IsOptional() @IsString()
  approvals?: string;

  @IsOptional() @IsString()
  financeFacing?: string;

  @IsOptional() @IsString()
  hypothecation?: string;

  @IsOptional() @IsString()
  deviation?: string;

  // ── Property table: attachments ────────────────────────────────────────────
  @IsOptional() @IsString()
  attachment1?: string;

  @IsOptional() @IsString()
  attachment2?: string;

  @IsOptional() @IsString()
  attachment3?: string;

  @IsOptional() @IsString()
  attachment4?: string;

  @IsOptional() @IsString()
  attachment5?: string;

  @IsOptional() @IsString()
  attachment6?: string;

  // ── PropertyDetails: unit info ─────────────────────────────────────────────
  @IsOptional() @IsNumber() @Type(() => Number)
  udsArea?: number;

  @IsOptional() @IsString()
  unitNumber?: string;

  @IsOptional() @IsString()
  unitType?: string;

  @IsOptional() @IsNumber() @Type(() => Number)
  numberOfFlats?: number;

  @IsOptional() @IsNumber() @Type(() => Number)
  towerNos?: number;

  @IsOptional() @IsBoolean()
  poojaRoom?: boolean;

  @IsOptional() @IsBoolean()
  studyRoom?: boolean;

  @IsOptional() @IsString()
  architecturalStyle?: string;

  @IsOptional() @IsString()
  availablePortion?: string;

  @IsOptional() @IsString()
  amenities?: string;

  // ── PropertyDetails: plot / land ───────────────────────────────────────────
  @IsOptional() @IsNumber() @Type(() => Number)
  plotNos?: number;

  @IsOptional() @IsString()
  zoning?: string;

  @IsOptional() @IsString()
  plotType?: string;

  @IsOptional() @IsString()
  landType?: string;

  @IsOptional() @IsString()
  topography?: string;

  @IsOptional() @IsString()
  soilType?: string;

  @IsOptional() @IsString()
  irrigation?: string;

  @IsOptional() @IsString()
  fencing?: string;

  @IsOptional() @IsString()
  cropSuitability?: string;

  @IsOptional() @IsString()
  existingPlantation?: string;

  @IsOptional() @IsBoolean()
  boreWell?: boolean;

  @IsOptional() @IsBoolean()
  storageTank?: boolean;

  @IsOptional() @IsString()
  waterSources?: string;

  @IsOptional() @IsString()
  sfNumber?: string;

  // ── PropertyDetails: commercial / building ─────────────────────────────────
  @IsOptional() @IsString()
  propertyUse?: string;

  @IsOptional() @IsNumber() @Type(() => Number)
  noOfLifts?: number;

  @IsOptional() @IsString()
  dimension?: string;

  @IsOptional() @IsString()
  frontage?: string;

  @IsOptional() @IsBoolean()
  outsideParking?: boolean;

  @IsOptional() @IsString()
  visitorsParking?: string;

  @IsOptional() @IsBoolean()
  fireSafety?: boolean;

  @IsOptional() @IsString()
  electricityConnection?: string;

  @IsOptional() @IsNumber() @Type(() => Number)
  conferenceRoom?: number;

  @IsOptional() @IsNumber() @Type(() => Number)
  seater?: number;

  @IsOptional() @IsString()
  tenantMix?: string;

  // ── PropertyDetails: industrial / warehouse ────────────────────────────────
  @IsOptional() @IsString()
  buildingType?: string;

  @IsOptional() @IsNumber() @Type(() => Number)
  numberOfBays?: number;

  @IsOptional() @IsNumber() @Type(() => Number)
  numberOfCabins?: number;

  @IsOptional() @IsNumber() @Type(() => Number)
  loadingBays?: number;

  @IsOptional() @IsNumber() @Type(() => Number)
  warehouseRacks?: number;

  @IsOptional() @IsBoolean()
  truckTrailerAccess?: boolean;

  @IsOptional() @IsBoolean()
  craneAvailable?: boolean;

  @IsOptional() @IsString()
  workerFacilities?: string;

  // ── PropertyDetails: location proximity ───────────────────────────────────
  @IsOptional() @IsString()
  nearestHighway?: string;

  @IsOptional() @IsString()
  nearestRailway?: string;

  @IsOptional() @IsString()
  nearestPort?: string;

  @IsOptional() @IsString()
  nearestAirport?: string;

  @IsOptional() @IsString()
  labourAvailability?: string;

  // ── PropertyDetails: lease / rent terms ───────────────────────────────────
  @IsOptional() @IsNumber() @Type(() => Number)
  advanceRent?: number;

  @IsOptional() @IsString()
  leaseTerm?: string;

  @IsOptional() @IsString()
  incrementalRent?: string;

  @IsOptional() @IsString()
  electricityCharges?: string;

  // ── PropertyDetails: amenities / facilities ────────────────────────────────
  @IsOptional() @IsBoolean()
  highSpeedWifi?: boolean;

  @IsOptional() @IsBoolean()
  airConditioning?: boolean;

  @IsOptional() @IsBoolean()
  cctvSurveillance?: boolean;

  @IsOptional() @IsBoolean()
  elevatorAccess?: boolean;

  @IsOptional() @IsBoolean()
  securityStaff?: boolean;

  @IsOptional() @IsString()
  furnitureProvided?: string;

  @IsOptional() @IsString()
  outdoorSpaces?: string;

  @IsOptional() @IsString()
  utilitiesProvided?: string;

  @IsOptional() @IsString()
  neighborhoodHighlights?: string;

  @IsOptional() @IsString()
  communityFacilities?: string;

  @IsOptional() @IsString()
  accessibility?: string;

  // ── Type-specific spec fields (all optional; only the block matching
  // ── propertyType is forwarded by the service) ──────────────────────────
  @IsOptional() @Type(() => Number) @IsNumber()
  builtUpArea?: number;

  @IsOptional() @Type(() => Number) @IsNumber()
  carpetArea?: number;

  @IsOptional() @Type(() => Number) @IsNumber()
  superBuiltUpArea?: number;

  @IsOptional() @IsString()
  plotArea?: string;

  @IsOptional() @Type(() => Number) @IsNumber()
  balconies?: number;

  @IsOptional() @Type(() => Number) @IsNumber()
  plotSizeCents?: number;

  @IsOptional() @Type(() => Number) @IsNumber()
  plotLength?: number;

  @IsOptional() @Type(() => Number) @IsNumber()
  plotWidth?: number;

  @IsOptional() @IsBoolean()
  boundaryWall?: boolean;

  @IsOptional() @Type(() => Number) @IsNumber()
  carParking?: number;

  @IsOptional() @Type(() => Number) @IsNumber()
  bikeParking?: number;

  @IsOptional() @Type(() => Number) @IsNumber()
  ceilingHeightFt?: number;

  @IsOptional() @IsBoolean()
  powerBackup?: boolean;

  @IsOptional() @IsBoolean()
  hasCentralAc?: boolean;

  @IsOptional() @IsBoolean()
  hasPantry?: boolean;

  @IsOptional() @IsString()
  commercialAmenities?: string;

  @IsOptional() @Type(() => Number) @IsNumber()
  availableWorkstations?: number;

  @IsOptional() @Type(() => Number) @IsNumber()
  privateCabins?: number;

  @IsOptional() @Type(() => Number) @IsNumber()
  meetingRooms?: number;

  @IsOptional() @Type(() => Number) @IsNumber()
  minSeats?: number;

  @IsOptional() @Type(() => Number) @IsNumber()
  rentPerSeat?: number;

  @IsOptional() @IsBoolean()
  coworkingPowerBackup?: boolean;

  @IsOptional() @IsBoolean()
  coworkingHasPantry?: boolean;

  @IsOptional() @IsString()
  industrialPropertyUse?: string;

  @IsOptional() @Type(() => Number) @IsNumber()
  coveredArea?: number;

  @IsOptional() @Type(() => Number) @IsNumber()
  openArea?: number;

  @IsOptional() @Type(() => Number) @IsNumber()
  industrialCeilingHeight?: number;

  @IsOptional() @IsString()
  floorType?: string;

  @IsOptional() @Type(() => Number) @IsNumber()
  powerSupplyHp?: number;

  @IsOptional() @IsString()
  waterSupply?: string;

  @IsOptional() @Type(() => Number) @IsNumber()
  truckParking?: number;

  @IsOptional() @Type(() => Number) @IsNumber()
  industrialCarParking?: number;

  @IsOptional() @Type(() => Number) @IsNumber()
  industrialBikeParking?: number;

  @IsOptional() @IsBoolean()
  industrialFireSafety?: boolean;

  @IsOptional() @IsBoolean()
  industrialPowerBackup?: boolean;

  @IsOptional() @IsBoolean()
  heavyVehicleAccess?: boolean;
}
