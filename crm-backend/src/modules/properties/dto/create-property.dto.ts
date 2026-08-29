import {
  IsBoolean,
  IsNumber,
  IsOptional,
  IsString,
} from 'class-validator';
import { Type } from 'class-transformer';

export class CreatePropertyDto {
  title!: string;
  listingType!: 'Sell' | 'Rent';
  propertyType!: 'apartment' | 'villa' | 'plot' | 'commercial' | 'coworking' | 'farmland' | 'industrial' | 'individual_portion';
  price!: number;
  cityId!: number;
  sublocationId?: number;
  bedrooms?: number;
  bathrooms?: number;
  areaSqft?: number;
  ownerName?: string;
  ownerPhone?: string;
  ownerEmail?: string;
  description?: string;
  status?: 'available' | 'sold' | 'rented' | 'unavailable';
  negotiable?: boolean;
  imageUrls?: { imageUrl: string; imageKey: string; isPrimary: boolean }[];

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
}
