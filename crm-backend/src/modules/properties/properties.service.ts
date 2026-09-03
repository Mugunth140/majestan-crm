import { Injectable, NotFoundException } from '@nestjs/common';
import { SiteApiService } from './site-api.service';
import { CreatePropertyDto } from './dto/create-property.dto';
import { UpdatePropertyDto } from './dto/update-property.dto';
import { BulkImportPropertyDto } from './dto/bulk-import-property.dto';
import { PropertyQueryDto } from './dto/property-query.dto';

// CRM form keys → site details keys
const RENAMED_DETAILS_KEYS: Record<string, string> = {
  propertyFacing: 'facing',
  builtUpArea: 'buildUpArea',
  industrialPropertyUse: 'propertyUse',
  industrialCeilingHeight: 'ceilingHeightFt',
  industrialCarParking: 'carParking',
  industrialBikeParking: 'bikeParking',
  industrialFireSafety: 'fireSafety',
  industrialPowerBackup: 'powerBackup',
  coworkingPowerBackup: 'powerBackup',
  coworkingHasPantry: 'hasPantry',
};

// Details keys passed through unchanged (numbers coerced, see below)
const NUMERIC_DETAILS_KEYS = new Set([
  'bedrooms', 'bathrooms', 'areaSqft', 'parking', 'balconies', 'totalFloors',
  'carpetArea', 'superBuiltUpArea', 'builtUpArea', 'buildUpArea', 'openSides',
  'plotLength', 'plotWidth', 'plotSizeCents', 'ceilingHeightFt', 'udsArea',
  'numberOfFlats', 'towerNos', 'plotNos', 'noOfLifts', 'conferenceRoom', 'seater',
  'numberOfBays', 'numberOfCabins', 'loadingBays', 'warehouseRacks', 'coveredArea',
  'openArea', 'powerSupplyHp', 'truckParking', 'carParking', 'bikeParking',
  'minSeats', 'rentPerSeat', 'privateCabins', 'meetingRooms', 'availableWorkstations',
  'advanceRent',
]);

const PASSTHROUGH_DETAILS_KEYS = new Set([
  'floorNumber', 'propertyAge', 'possessionStatus', 'waterSupply', 'areaUnit',
  'roadWidth', 'suitableFor', 'floorType', 'furnishingStatus',
  'unitNumber', 'unitType', 'architecturalStyle', 'availablePortion', 'amenities',
  'zoning', 'plotType', 'landType', 'topography', 'soilType', 'irrigation', 'fencing',
  'cropSuitability', 'existingPlantation', 'waterSources', 'sfNumber', 'propertyUse',
  'dimension', 'frontage', 'visitorsParking', 'electricityConnection', 'tenantMix',
  'buildingType', 'workerFacilities', 'nearestHighway', 'nearestRailway', 'nearestPort',
  'nearestAirport', 'labourAvailability', 'leaseTerm', 'incrementalRent',
  'electricityCharges', 'furnitureProvided', 'outdoorSpaces', 'utilitiesProvided',
  'neighborhoodHighlights', 'communityFacilities', 'accessibility',
]);

const BOOLEAN_DETAILS_KEYS = new Set([
  'furnished', 'powerBackup', 'boundaryWall', 'hasPantry', 'hasCentralAc',
  'heavyVehicleAccess', 'hasRestroom', 'guestParking', 'poojaRoom', 'studyRoom',
  'boreWell', 'storageTank', 'outsideParking', 'fireSafety', 'truckTrailerAccess',
  'craneAvailable', 'highSpeedWifi', 'airConditioning', 'cctvSurveillance',
  'elevatorAccess', 'securityStaff',
]);

const CRM_TOP_LEVEL_KEYS = new Set([
  'alternateName', 'alternatePhone', 'alternateEmail', 'transactionType',
  'handoverDate', 'roadName', 'roadAccess', 'tenantOccupied', 'saleType',
  'agentName', 'agencyName', 'commissionTerms', 'lockInPeriod', 'taxes',
  'registrationCharge', 'modeOfPayment', 'timeForRegistration', 'remark',
  'demandArea', 'rentalYield', 'comparativePrice', 'marketPrice',
  'ownershipTitleVerified', 'encumbranceCertificate', 'rentalAgreementDraft',
  'tslrFmb', 'taxReceipt', 'ebReceipt', 'pattaChitta', 'approvals', 'financeFacing',
  'hypothecation', 'deviation', 'attachment1', 'attachment2', 'attachment3',
  'attachment4', 'attachment5', 'attachment6',
]);

const ARRAY_DETAILS_KEYS = new Set([
  'floorsOccupied', 'roomDimensions'
]);

function num(v: any): number | undefined {
  if (v === undefined || v === null || v === '') return undefined;
  const n = Number(v);
  return Number.isNaN(n) ? undefined : n;
}

function str(v: any): string | undefined {
  if (v === undefined || v === null) return undefined;
  const s = String(v).trim();
  return s === '' ? undefined : s;
}

@Injectable()
export class PropertiesService {
  private citiesCache: { at: number; cities: any[]; sublocations: any[]; amenities: any[] } | null = null;

  constructor(private readonly siteApi: SiteApiService) {}

  private async formDataCached(): Promise<{ cities: any[]; sublocations: any[]; amenities: any[] }> {
    if (this.citiesCache && Date.now() - this.citiesCache.at < 5 * 60 * 1000) {
      return this.citiesCache;
    }
    const data = await this.siteApi.get('/properties/form-data');
    const cities = data?.cities ?? [];
    const sublocations = data?.sublocations ?? [];
    const amenities = data?.amenities ?? [];
    this.citiesCache = { at: Date.now(), cities, sublocations, amenities };
    return { cities, sublocations, amenities };
  }

  private cityNameOf(cities: any[], id: number): any | null {
    return cities.find((c) => Number(c.id) === Number(id)) ?? null;
  }

  // ── findAll ────────────────────────────────────────────────────────────────
  async findAll(query: PropertyQueryDto) {
    const page = Number(query.page) || 1;
    const limit = Number(query.limit) || 20;
    const params = new URLSearchParams({
      page: String(page),
      limit: String(limit),
    });
    if (query.search) params.append('search', query.search);
    if (query.propertyType) params.append('propertyType', query.propertyType);
    if (query.listingType) params.append('listingType', query.listingType);
    if (query.status === 'archived') params.append('statusFilter', 'archived');
    else if (query.status) params.append('statusFilter', query.status);
    if (query.cityId) params.append('cityId', String(query.cityId));

    const res = await this.siteApi.get(`/admin/properties/all?${params.toString()}`);
    const items = res?.items ?? [];
    const total = Number(res?.total) || 0;
    return {
      data: items,
      meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
    };
  }

  // ── findFormData ───────────────────────────────────────────────────────────
  async findFormData() {
    const { cities, sublocations, amenities } = await this.formDataCached();
    return {
      amenities,
      cities: cities.map((c: any) => ({
        id: c.id,
        cityName: c.city_name ?? c.cityName,
        stateName: c.state_name ?? c.stateName,
        countryName: c.country_name ?? c.countryName,
        isActive: 1,
      })),
      sublocations: sublocations.map((s: any) => ({
        id: s.id,
        cityId: s.city_id ?? s.cityId,
        localityName: s.locality_name ?? s.localityName,
        isActive: 1,
      })),
    };
  }

  // ── findOne ────────────────────────────────────────────────────────────────
  async findOne(id: number) {
    let record: any;
    try {
      record = await this.siteApi.get(`/admin/properties/by-id/${id}`);
    } catch (e: any) {
      if (e?.status === 404) throw new NotFoundException(`Property #${id} not found`);
      throw e;
    }
    const loc = (record.propertyLocations ?? [])[0] ?? null;
    return {
      ...record,
      propertyDetails: record.propertyDetails ?? null,
      propertyImages: record.propertyImages ?? [],
      propertyLocations: (record.propertyLocations ?? []).map((l: any) => ({
        ...l,
        address: l.address ?? null,
        pincode: l.pincode ?? null,
        latitude: l.latitude ?? null,
        longitude: l.longitude ?? null,
        localityData: l.localityData ?? null,
      })),
      // Flat aliases the CRM form/list historically consumed
      cityId: record.cityId ?? null,
      sublocationId: loc?.locationId ?? loc?.sublocation?.id ?? null,
      locality: loc?.sublocation?.localityName ?? null,
      bedrooms: record.propertyDetails?.bedrooms ?? null,
      bathrooms: record.propertyDetails?.bathrooms ?? null,
      areaSqft: record.propertyDetails?.areaSqft ?? null,
      images: record.propertyImages ?? [],
      documents: (record.propertyFiles ?? []).map((pf: any) => ({
        id: pf.id ?? null,
        fileKey: pf.file?.fileKey ?? null,
        fileUrl: pf.file?.fileUrl ?? null,
        fileName: pf.file?.fileName ?? pf.title ?? null,
        mimeType: pf.file?.mimeType ?? null,
        documentType: pf.documentType ?? 'other',
        title: pf.title ?? null,
      })),
      faqs: record.faqs ?? [],
      amenityIds: (record.propertyAmenities ?? []).map((pa: any) => pa.amenityId),
    };
  }

  // ── presigned upload URL ───────────────────────────────────────────────────
  async presignedUrl(fileName: string, fileType: string) {
    const q = new URLSearchParams({ fileName, fileType });
    return this.siteApi.get(`/properties/presigned-url?${q.toString()}`);
  }

  private async putToR2(file: Express.Multer.File): Promise<string> {
    const q = new URLSearchParams({ fileName: file.originalname, fileType: file.mimetype });
    const presigned = await this.siteApi.get(`/properties/presigned-url?${q.toString()}`);
    const uploadUrl = presigned?.url;
    const fileKey = presigned?.key;
    if (!uploadUrl || !fileKey) {
      throw new Error(`Failed to prepare upload for ${file.originalname}`);
    }
    const put = await fetch(uploadUrl, {
      method: 'PUT',
      headers: { 'Content-Type': file.mimetype },
      body: file.buffer as unknown as BodyInit,
      signal: AbortSignal.timeout(60000),
    });
    if (!put.ok) {
      throw new Error(`Failed to upload ${file.originalname}`);
    }
    return fileKey;
  }

  // ── direct upload: files in → R2 keys out (no URLs for callers to handle) ──
  async uploadImages(files: Express.Multer.File[]): Promise<{ imageKey: string; fileName: string }[]> {
    const allowed = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif']);
    const results: { imageKey: string; fileName: string }[] = [];
    for (const file of files) {
      if (!allowed.has(file.mimetype)) {
        throw new Error(`Unsupported image type: ${file.originalname}`);
      }
      results.push({ imageKey: await this.putToR2(file), fileName: file.originalname });
    }
    return results;
  }

  async uploadDocuments(files: Express.Multer.File[]): Promise<{ fileKey: string; fileName: string; mimeType: string; fileSize: number }[]> {
    const allowed = new Set([
      'application/pdf', 'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'text/plain', 'image/jpeg', 'image/png', 'image/webp',
    ]);
    const results: { fileKey: string; fileName: string; mimeType: string; fileSize: number }[] = [];
    for (const file of files) {
      if (!allowed.has(file.mimetype)) {
        throw new Error(`Unsupported document type: ${file.originalname}`);
      }
      results.push({
        fileKey: await this.putToR2(file),
        fileName: file.originalname,
        mimeType: file.mimetype,
        fileSize: file.size,
      });
    }
    return results;
  }

  private buildDetails(dto: Record<string, any>): Record<string, any> {
    const details: Record<string, any> = {};
    for (const [from, to] of Object.entries(RENAMED_DETAILS_KEYS)) {
      if (dto[from] === undefined) continue;
      details[to] = NUMERIC_DETAILS_KEYS.has(to) ? num(dto[from]) : dto[from];
    }
    for (const key of NUMERIC_DETAILS_KEYS) {
      if (dto[key] === undefined || key in details) continue;
      const v = num(dto[key]);
      if (v !== undefined) details[key] = v;
    }
    for (const key of PASSTHROUGH_DETAILS_KEYS) {
      if (dto[key] === undefined) continue;
      const v = str(dto[key]);
      if (v !== undefined) details[key] = v;
    }
    for (const key of BOOLEAN_DETAILS_KEYS) {
      if (dto[key] === undefined) continue;
      details[key] = dto[key] ?? null;
    }
    for (const key of ARRAY_DETAILS_KEYS) {
      if (dto[key] === undefined) continue;
      details[key] = Array.isArray(dto[key]) ? dto[key] : null;
    }
    return details;
  }

  private async buildSitePayload(dto: Record<string, any>): Promise<Record<string, any>> {
    const { cities } = await this.formDataCached();
    const city = dto.cityId ? this.cityNameOf(cities, Number(dto.cityId)) : null;

    const payload: Record<string, any> = {
      title: dto.title,
      description: dto.description ?? '',
      price: dto.price !== undefined ? String(dto.price) : undefined,
      propertyType: dto.propertyType,
      listingType: dto.listingType === 'Buy' ? 'Sell' : (dto.listingType ?? 'Sell'),
      status: dto.status ?? 'available',
      reraNumber: dto.reraNumber ?? 'Not Applicable',
      builderName: str(dto.builderName),
      projectName: str(dto.projectName),
      propertyCondition: str(dto.propertyCondition),
      ownershipType: str(dto.ownershipType),
      brokerageType: str(dto.brokerageType),
      brokerageValue: str(dto.brokerageValue),
      bookingAmount: str(dto.bookingAmount),
      availableFrom: str(dto.availableFrom),
      availableUntil: str(dto.availableUntil),
      city: city ? (city.city_name ?? city.cityName) : dto.city,
      state: city ? (city.state_name ?? city.stateName) : dto.state,
      country: city ? (city.country_name ?? city.countryName ?? 'India') : (dto.country ?? 'India'),
      cityId: dto.cityId !== undefined ? Number(dto.cityId) : undefined,
      sublocationId: dto.sublocationId !== undefined ? Number(dto.sublocationId) : undefined,
      ownerName: dto.ownerName || undefined,
      ownerEmail: dto.ownerEmail || undefined,
      ownerPhone: dto.ownerPhone || undefined,
      negotiable: dto.negotiable ?? false,
      maintenanceCharges: str(dto.maintenanceCharges),
      securityDeposit: str(dto.securityDeposit),
    };

    for (const key of CRM_TOP_LEVEL_KEYS) {
      if (dto[key] === undefined) continue;
      payload[key] =
        key === 'expectedSalePrice' || key === 'monthlyRent'
          ? (dto[key] != null && dto[key] !== '' ? String(dto[key]) : undefined)
          : (str(dto[key]) ?? null);
    }

    const details = this.buildDetails(dto);
    if (Object.keys(details).length > 0) payload.details = details;

    if (dto.locationData && (dto.locationData.address || dto.locationData.latitude || dto.locationData.longitude || dto.locationData.pincode || dto.locationData.localityData)) {
      payload.location = {
        address: str(dto.locationData.address),
        pincode: str(dto.locationData.pincode),
        latitude: num(dto.locationData.latitude),
        longitude: num(dto.locationData.longitude),
        localityData: dto.locationData.localityData,
      };
    }

    if (dto.imageUrls !== undefined) {
      payload.files = (dto.imageUrls as any[]).map((img) => ({
        fileType: 'IMAGE',
        fileUrl: img.imageKey || img.imageUrl,
        fileKey: img.imageKey || img.imageUrl,
      }));
    }

    if ((dto as any).documents !== undefined) {
      payload.documents = ((dto as any).documents as any[]).map((doc) => ({
        fileKey: doc.fileKey,
        fileName: doc.fileName,
        mimeType: doc.mimeType,
        fileSizeBytes: doc.fileSize,
        documentType: doc.documentType || 'other',
        title: doc.title || doc.fileName,
        isPublic: true,
      }));
    }

    if ((dto as any).amenityIds !== undefined) {
      payload.amenities = ((dto as any).amenityIds as number[]).map(id => ({ amenityId: id }));
    }

    if ((dto as any).faqs !== undefined) {
      payload.faqs = ((dto as any).faqs as any[]).filter(f => f.question && f.answer).map(f => ({
        question: f.question,
        answer: f.answer,
        section: f.section || 'overview',
      }));
    }

    for (const k of Object.keys(payload)) {
      if (payload[k] === undefined) delete payload[k];
    }
    return payload;
  }

  // ── create ─────────────────────────────────────────────────────────────────
  async create(dto: CreatePropertyDto) {
    const payload = await this.buildSitePayload(dto as unknown as Record<string, any>);
    const created = await this.siteApi.post(`/admin/properties/${payload.propertyType}`, payload);
    return this.findOne(created.id);
  }

  // ── update ─────────────────────────────────────────────────────────────────
  async update(id: number, dto: UpdatePropertyDto) {
    const existing = await this.findOne(id);
    // NOTE: property type changes are ignored — the site API keys routes,
    // slugs and detail lookups off the stored type.
    const payload = await this.buildSitePayload(dto as unknown as Record<string, any>);
    delete (payload as any).propertyType;
    await this.siteApi.patch(`/admin/properties/${existing.propertyType}/${id}`, payload);
    return this.findOne(id);
  }

  // ── toggleVisibility ───────────────────────────────────────────────────────
  async toggleVisibility(id: number) {
    const existing = await this.findOne(id);
    const newStatus = existing.status === 'available' ? 'unavailable' : 'available';
    await this.siteApi.patch(
      `/admin/properties/${existing.propertyType}/${id}/status`,
      { status: newStatus },
    );
    return { id, status: newStatus };
  }

  // ── remove ─────────────────────────────────────────────────────────────────
  async remove(id: number) {
    const existing = await this.findOne(id);
    await this.siteApi.del(`/admin/properties/${existing.propertyType}/${id}`);
    return { id, deleted: true };
  }

  // ── bulkImport ─────────────────────────────────────────────────────────────
  async bulkImport(dto: BulkImportPropertyDto): Promise<{ created: number; skipped: number }> {
    let created = 0;
    let skipped = 0;

    const { cities, sublocations } = await this.formDataCached();
    const cityMap = new Map<string, any>();
    for (const c of cities) {
      cityMap.set(String(c.city_name ?? c.cityName ?? '').toLowerCase(), c);
    }
    const subMap = new Map<string, any>();
    for (const s of sublocations) {
      subMap.set(String(s.locality_name ?? s.localityName ?? '').toLowerCase(), s);
    }

    const VALID_PROPERTY_TYPES = new Set([
      'apartment', 'villa', 'plot', 'commercial', 'coworking',
      'farmland', 'industrial', 'individual_portion', 'other',
    ]);

    for (const row of dto.properties as any[]) {
      try {
        const city = cityMap.get(String(row.city ?? '').toLowerCase());
        if (!city) { skipped++; continue; }

        const propertyType = String(row.propertyType ?? '').toLowerCase();
        if (!VALID_PROPERTY_TYPES.has(propertyType)) { skipped++; continue; }

        const sub = row.locality
          ? subMap.get(String(row.locality).toLowerCase())
          : null;

        const payload: Record<string, any> = {
          title: row.title,
          description: row.description || '',
          price: row.price !== undefined ? String(row.price) : undefined,
          propertyType,
          listingType: String(row.listingType ?? '').toLowerCase() === 'rent' ? 'Rent' : 'Sell',
          status: 'available',
          reraNumber: 'Not Applicable',
          city: city.city_name ?? city.cityName,
          state: city.state_name ?? city.stateName,
          country: city.country_name ?? city.countryName ?? 'India',
          cityId: Number(city.id),
          ...(sub ? { sublocationId: Number(sub.id) } : {}),
          ownerName: row.ownerName || undefined,
          ownerPhone: row.ownerPhone || undefined,
          negotiable: false,
          details: {
            bedrooms: num(row.bedrooms) ?? 0,
            bathrooms: num(row.bathrooms) ?? 0,
            areaSqft: num(row.areaSqft) ?? 0,
            parking: 0,
            furnished: false,
          },
        };

        await this.siteApi.post(`/admin/properties/${propertyType}`, payload);
        created++;
      } catch {
        skipped++;
      }
    }

    return { created, skipped };
  }
}
