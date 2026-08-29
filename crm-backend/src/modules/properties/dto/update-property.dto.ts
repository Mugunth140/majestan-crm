import { CreatePropertyDto } from './create-property.dto';

export class UpdatePropertyDto implements Partial<CreatePropertyDto> {
  title?: string;
  listingType?: 'Sell' | 'Rent';
  propertyType?: 'apartment' | 'villa' | 'plot' | 'commercial' | 'coworking' | 'farmland' | 'industrial' | 'individual_portion';
  price?: number;
  cityId?: number;
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
  alternateName?: string;
  alternatePhone?: string;
  alternateEmail?: string;

  // ── Property table: transaction info ──────────────────────────────────────
  transactionType?: string;
  handoverDate?: string;
  roadName?: string;
  roadAccess?: string;
  tenantOccupied?: string;
  saleType?: string;

  // ── Property table: agent info ─────────────────────────────────────────────
  agentName?: string;
  agencyName?: string;
  commissionTerms?: string;

  // ── Property table: pricing ────────────────────────────────────────────────
  expectedSalePrice?: number;
  monthlyRent?: number;

  // ── Property table: legal / payment ───────────────────────────────────────
  lockInPeriod?: string;
  taxes?: string;
  registrationCharge?: string;
  modeOfPayment?: string;
  timeForRegistration?: string;

  // ── Property table: remarks / market ──────────────────────────────────────
  remark?: string;
  demandArea?: string;
  rentalYield?: string;
  comparativePrice?: string;
  marketPrice?: string;

  // ── Property table: documents ──────────────────────────────────────────────
  ownershipTitleVerified?: string;
  encumbranceCertificate?: string;
  rentalAgreementDraft?: string;
  tslrFmb?: string;
  taxReceipt?: string;
  ebReceipt?: string;
  pattaChitta?: string;

  // ── Property table: compliance ─────────────────────────────────────────────
  approvals?: string;
  financeFacing?: string;
  hypothecation?: string;
  deviation?: string;

  // ── Property table: attachments ────────────────────────────────────────────
  attachment1?: string;
  attachment2?: string;
  attachment3?: string;
  attachment4?: string;
  attachment5?: string;
  attachment6?: string;

  // ── PropertyDetails: unit info ─────────────────────────────────────────────
  udsArea?: number;
  unitNumber?: string;
  unitType?: string;
  numberOfFlats?: number;
  towerNos?: number;
  poojaRoom?: boolean;
  studyRoom?: boolean;
  architecturalStyle?: string;
  availablePortion?: string;
  amenities?: string;

  // ── PropertyDetails: plot / land ───────────────────────────────────────────
  plotNos?: number;
  zoning?: string;
  plotType?: string;
  landType?: string;
  topography?: string;
  soilType?: string;
  irrigation?: string;
  fencing?: string;
  cropSuitability?: string;
  existingPlantation?: string;
  boreWell?: boolean;
  storageTank?: boolean;
  waterSources?: string;
  sfNumber?: string;

  // ── PropertyDetails: commercial / building ─────────────────────────────────
  propertyUse?: string;
  noOfLifts?: number;
  dimension?: string;
  frontage?: string;
  outsideParking?: boolean;
  visitorsParking?: string;
  fireSafety?: boolean;
  electricityConnection?: string;
  conferenceRoom?: number;
  seater?: number;
  tenantMix?: string;

  // ── PropertyDetails: industrial / warehouse ────────────────────────────────
  buildingType?: string;
  numberOfBays?: number;
  numberOfCabins?: number;
  loadingBays?: number;
  warehouseRacks?: number;
  truckTrailerAccess?: boolean;
  craneAvailable?: boolean;
  workerFacilities?: string;

  // ── PropertyDetails: location proximity ───────────────────────────────────
  nearestHighway?: string;
  nearestRailway?: string;
  nearestPort?: string;
  nearestAirport?: string;
  labourAvailability?: string;

  // ── PropertyDetails: lease / rent terms ───────────────────────────────────
  advanceRent?: number;
  leaseTerm?: string;
  incrementalRent?: string;
  electricityCharges?: string;

  // ── PropertyDetails: amenities / facilities ────────────────────────────────
  highSpeedWifi?: boolean;
  airConditioning?: boolean;
  cctvSurveillance?: boolean;
  elevatorAccess?: boolean;
  securityStaff?: boolean;
  furnitureProvided?: string;
  outdoorSpaces?: string;
  utilitiesProvided?: string;
  neighborhoodHighlights?: string;
  communityFacilities?: string;
  accessibility?: string;
}
