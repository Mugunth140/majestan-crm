import {
  IsArray,
  IsBoolean,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  ArrayMaxSize,
  ValidateNested,
} from 'class-validator';
import { Type, Transform } from 'class-transformer';

const toTrimmedString = ({ value }: { value: any }) => {
  if (value == null) return undefined;
  const s = String(value).trim();
  return s === '' ? undefined : s;
};

const toNumber = ({ value }: { value: any }) => {
  if (value == null || value === '') return undefined;
  const n = Number(value);
  return Number.isNaN(n) ? undefined : n;
};

export class BulkPropertyRowDto {
  @IsNotEmpty()
  @IsString()
  title!: string;

  @IsNotEmpty()
  @IsString()
  listingType!: string;

  @IsNotEmpty()
  @IsString()
  propertyType!: string;

  @IsNotEmpty()
  @Transform(toNumber)
  @IsNumber()
  price!: number;

  @IsNotEmpty()
  @IsString()
  city!: string;

  @IsOptional()
  @Transform(toTrimmedString)
  @IsString()
  locality?: string;

  @IsOptional()
  @Transform(toNumber)
  @IsNumber()
  bedrooms?: number;

  @IsOptional()
  @Transform(toNumber)
  @IsNumber()
  bathrooms?: number;

  @IsOptional()
  @Transform(toNumber)
  @IsNumber()
  areaSqft?: number;

  @IsOptional()
  @Transform(toTrimmedString)
  @IsString()
  ownerName?: string;

  @IsOptional()
  @Transform(toTrimmedString)
  @IsString()
  ownerPhone?: string;

  @IsOptional()
  @Transform(toTrimmedString)
  @IsString()
  description?: string;

  // ── Property table: alternate contact ──────────────────────────────────────
  @IsOptional() @Transform(toTrimmedString) @IsString()
  alternateName?: string;

  @IsOptional() @Transform(toTrimmedString) @IsString()
  alternatePhone?: string;

  @IsOptional() @Transform(toTrimmedString) @IsString()
  alternateEmail?: string;

  // ── Property table: transaction info ──────────────────────────────────────
  @IsOptional() @Transform(toTrimmedString) @IsString()
  transactionType?: string;

  @IsOptional() @Transform(toTrimmedString) @IsString()
  handoverDate?: string;

  @IsOptional() @Transform(toTrimmedString) @IsString()
  roadName?: string;

  @IsOptional() @Transform(toTrimmedString) @IsString()
  roadAccess?: string;

  @IsOptional() @Transform(toTrimmedString) @IsString()
  tenantOccupied?: string;

  @IsOptional() @Transform(toTrimmedString) @IsString()
  saleType?: string;

  // ── Property table: agent info ─────────────────────────────────────────────
  @IsOptional() @Transform(toTrimmedString) @IsString()
  agentName?: string;

  @IsOptional() @Transform(toTrimmedString) @IsString()
  agencyName?: string;

  @IsOptional() @Transform(toTrimmedString) @IsString()
  commissionTerms?: string;

  // ── Property table: pricing ────────────────────────────────────────────────
  @IsOptional() @Transform(toNumber) @IsNumber()
  expectedSalePrice?: number;

  @IsOptional() @Transform(toNumber) @IsNumber()
  monthlyRent?: number;

  // ── Property table: legal / payment ───────────────────────────────────────
  @IsOptional() @Transform(toTrimmedString) @IsString()
  lockInPeriod?: string;

  @IsOptional() @Transform(toTrimmedString) @IsString()
  taxes?: string;

  @IsOptional() @Transform(toTrimmedString) @IsString()
  registrationCharge?: string;

  @IsOptional() @Transform(toTrimmedString) @IsString()
  modeOfPayment?: string;

  @IsOptional() @Transform(toTrimmedString) @IsString()
  timeForRegistration?: string;

  // ── Property table: remarks / market ──────────────────────────────────────
  @IsOptional() @Transform(toTrimmedString) @IsString()
  remark?: string;

  @IsOptional() @Transform(toTrimmedString) @IsString()
  demandArea?: string;

  @IsOptional() @Transform(toTrimmedString) @IsString()
  rentalYield?: string;

  @IsOptional() @Transform(toTrimmedString) @IsString()
  comparativePrice?: string;

  @IsOptional() @Transform(toTrimmedString) @IsString()
  marketPrice?: string;

  // ── Property table: documents ──────────────────────────────────────────────
  @IsOptional() @Transform(toTrimmedString) @IsString()
  ownershipTitleVerified?: string;

  @IsOptional() @Transform(toTrimmedString) @IsString()
  encumbranceCertificate?: string;

  @IsOptional() @Transform(toTrimmedString) @IsString()
  rentalAgreementDraft?: string;

  @IsOptional() @Transform(toTrimmedString) @IsString()
  tslrFmb?: string;

  @IsOptional() @Transform(toTrimmedString) @IsString()
  taxReceipt?: string;

  @IsOptional() @Transform(toTrimmedString) @IsString()
  ebReceipt?: string;

  @IsOptional() @Transform(toTrimmedString) @IsString()
  pattaChitta?: string;

  // ── Property table: compliance ─────────────────────────────────────────────
  @IsOptional() @Transform(toTrimmedString) @IsString()
  approvals?: string;

  @IsOptional() @Transform(toTrimmedString) @IsString()
  financeFacing?: string;

  @IsOptional() @Transform(toTrimmedString) @IsString()
  hypothecation?: string;

  @IsOptional() @Transform(toTrimmedString) @IsString()
  deviation?: string;

  // ── Property table: attachments ────────────────────────────────────────────
  @IsOptional() @Transform(toTrimmedString) @IsString()
  attachment1?: string;

  @IsOptional() @Transform(toTrimmedString) @IsString()
  attachment2?: string;

  @IsOptional() @Transform(toTrimmedString) @IsString()
  attachment3?: string;

  @IsOptional() @Transform(toTrimmedString) @IsString()
  attachment4?: string;

  @IsOptional() @Transform(toTrimmedString) @IsString()
  attachment5?: string;

  @IsOptional() @Transform(toTrimmedString) @IsString()
  attachment6?: string;

  // ── PropertyDetails: unit info ─────────────────────────────────────────────
  @IsOptional() @Transform(toNumber) @IsNumber()
  udsArea?: number;

  @IsOptional() @Transform(toTrimmedString) @IsString()
  unitNumber?: string;

  @IsOptional() @Transform(toTrimmedString) @IsString()
  unitType?: string;

  @IsOptional() @Transform(toNumber) @IsNumber()
  numberOfFlats?: number;

  @IsOptional() @Transform(toNumber) @IsNumber()
  towerNos?: number;

  @IsOptional() @IsBoolean()
  poojaRoom?: boolean;

  @IsOptional() @IsBoolean()
  studyRoom?: boolean;

  @IsOptional() @Transform(toTrimmedString) @IsString()
  architecturalStyle?: string;

  @IsOptional() @Transform(toTrimmedString) @IsString()
  availablePortion?: string;

  @IsOptional() @Transform(toTrimmedString) @IsString()
  amenities?: string;

  // ── PropertyDetails: plot / land ───────────────────────────────────────────
  @IsOptional() @Transform(toNumber) @IsNumber()
  plotNos?: number;

  @IsOptional() @Transform(toTrimmedString) @IsString()
  zoning?: string;

  @IsOptional() @Transform(toTrimmedString) @IsString()
  plotType?: string;

  @IsOptional() @Transform(toTrimmedString) @IsString()
  landType?: string;

  @IsOptional() @Transform(toTrimmedString) @IsString()
  topography?: string;

  @IsOptional() @Transform(toTrimmedString) @IsString()
  soilType?: string;

  @IsOptional() @Transform(toTrimmedString) @IsString()
  irrigation?: string;

  @IsOptional() @Transform(toTrimmedString) @IsString()
  fencing?: string;

  @IsOptional() @Transform(toTrimmedString) @IsString()
  cropSuitability?: string;

  @IsOptional() @Transform(toTrimmedString) @IsString()
  existingPlantation?: string;

  @IsOptional() @IsBoolean()
  boreWell?: boolean;

  @IsOptional() @IsBoolean()
  storageTank?: boolean;

  @IsOptional() @Transform(toTrimmedString) @IsString()
  waterSources?: string;

  @IsOptional() @Transform(toTrimmedString) @IsString()
  sfNumber?: string;

  // ── PropertyDetails: commercial / building ─────────────────────────────────
  @IsOptional() @Transform(toTrimmedString) @IsString()
  propertyUse?: string;

  @IsOptional() @Transform(toNumber) @IsNumber()
  noOfLifts?: number;

  @IsOptional() @Transform(toTrimmedString) @IsString()
  dimension?: string;

  @IsOptional() @Transform(toTrimmedString) @IsString()
  frontage?: string;

  @IsOptional() @IsBoolean()
  outsideParking?: boolean;

  @IsOptional() @Transform(toTrimmedString) @IsString()
  visitorsParking?: string;

  @IsOptional() @IsBoolean()
  fireSafety?: boolean;

  @IsOptional() @Transform(toTrimmedString) @IsString()
  electricityConnection?: string;

  @IsOptional() @Transform(toNumber) @IsNumber()
  conferenceRoom?: number;

  @IsOptional() @Transform(toNumber) @IsNumber()
  seater?: number;

  @IsOptional() @Transform(toTrimmedString) @IsString()
  tenantMix?: string;

  // ── PropertyDetails: industrial / warehouse ────────────────────────────────
  @IsOptional() @Transform(toTrimmedString) @IsString()
  buildingType?: string;

  @IsOptional() @Transform(toNumber) @IsNumber()
  numberOfBays?: number;

  @IsOptional() @Transform(toNumber) @IsNumber()
  numberOfCabins?: number;

  @IsOptional() @Transform(toNumber) @IsNumber()
  loadingBays?: number;

  @IsOptional() @Transform(toNumber) @IsNumber()
  warehouseRacks?: number;

  @IsOptional() @IsBoolean()
  truckTrailerAccess?: boolean;

  @IsOptional() @IsBoolean()
  craneAvailable?: boolean;

  @IsOptional() @Transform(toTrimmedString) @IsString()
  workerFacilities?: string;

  // ── PropertyDetails: location proximity ───────────────────────────────────
  @IsOptional() @Transform(toTrimmedString) @IsString()
  nearestHighway?: string;

  @IsOptional() @Transform(toTrimmedString) @IsString()
  nearestRailway?: string;

  @IsOptional() @Transform(toTrimmedString) @IsString()
  nearestPort?: string;

  @IsOptional() @Transform(toTrimmedString) @IsString()
  nearestAirport?: string;

  @IsOptional() @Transform(toTrimmedString) @IsString()
  labourAvailability?: string;

  // ── PropertyDetails: lease / rent terms ───────────────────────────────────
  @IsOptional() @Transform(toNumber) @IsNumber()
  advanceRent?: number;

  @IsOptional() @Transform(toTrimmedString) @IsString()
  leaseTerm?: string;

  @IsOptional() @Transform(toTrimmedString) @IsString()
  incrementalRent?: string;

  @IsOptional() @Transform(toTrimmedString) @IsString()
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

  @IsOptional() @Transform(toTrimmedString) @IsString()
  furnitureProvided?: string;

  @IsOptional() @Transform(toTrimmedString) @IsString()
  outdoorSpaces?: string;

  @IsOptional() @Transform(toTrimmedString) @IsString()
  utilitiesProvided?: string;

  @IsOptional() @Transform(toTrimmedString) @IsString()
  neighborhoodHighlights?: string;

  @IsOptional() @Transform(toTrimmedString) @IsString()
  communityFacilities?: string;

  @IsOptional() @Transform(toTrimmedString) @IsString()
  accessibility?: string;
}

export class BulkImportPropertyDto {
  @IsArray()
  @ArrayMaxSize(2000)
  @ValidateNested({ each: true })
  @Type(() => BulkPropertyRowDto)
  properties!: BulkPropertyRowDto[];
}
