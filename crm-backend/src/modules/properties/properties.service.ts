import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
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

function coerceBool(v: any): boolean | null {
  if (v === undefined || v === null) return null;
  if (typeof v === 'boolean') return v;
  if (v === 'false' || v === '0' || v === 0) return false;
  if (v === 'true' || v === '1' || v === 1) return true;
  return Boolean(v);
}

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
  // ── Pricing / CRM finance (decimal) ──
  'expectedSalePrice', 'monthlyRent',
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
    const rawPage = Number(query.page) || 1;
    const rawLimit = Number(query.limit) || 10;
    const page = Math.max(1, rawPage);
    const limit = Math.min(200, Math.max(1, rawLimit));
    const params = new URLSearchParams({
      page: String(page),
      limit: String(limit),
    });
    if (query.search) params.append('search', query.search);
    if (query.propertyType) params.append('propertyType', query.propertyType);
    if (query.listingType) {
      const normalized = String(query.listingType).toLowerCase() === 'rent' ? 'Rent' : 'Sell';
      params.append('listingType', normalized);
    }
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
      if (e?.status === 404 || e?.getStatus?.() === 404) throw new NotFoundException(`Property #${id} not found`);
      throw e;
    }
    if (!record) throw new NotFoundException(`Property #${id} not found`);
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
      amenitiesList: (record.propertyAmenities ?? []).map((pa: any) => ({
        id: pa.amenityId ?? null,
        name: pa.amenity?.name ?? null,
        category: pa.amenity?.category ?? null,
      })),
      propertyUnits: record.propertyUnits ?? [],
    };
  }

  // ── presigned upload URL ───────────────────────────────────────────────────
  async presignedUrl(fileName: string, fileType: string) {
    const q = new URLSearchParams({ fileName, fileType });
    return this.siteApi.get(`/properties/presigned-url?${q.toString()}`);
  }

  private async putToR2(file: Express.Multer.File): Promise<string> {
    if (!file.size) throw new BadRequestException(`File is empty: ${file.originalname}`);
    const q = new URLSearchParams({ fileName: file.originalname, fileType: file.mimetype });
    const presigned = await this.siteApi.get(`/properties/presigned-url?${q.toString()}`);
    const uploadUrl = presigned?.url;
    const fileKey = presigned?.key;
    if (!uploadUrl || !fileKey) {
      throw new BadRequestException(`Failed to prepare upload for ${file.originalname}`);
    }
    const put = await fetch(uploadUrl, {
      method: 'PUT',
      headers: { 'Content-Type': file.mimetype },
      body: file.buffer as unknown as BodyInit,
      signal: AbortSignal.timeout(60000),
    });
    if (!put.ok) {
      throw new BadRequestException(`Failed to upload ${file.originalname}`);
    }
    return fileKey;
  }

  // ── direct upload: files in → R2 keys out (no URLs for callers to handle) ──
  async uploadImages(files: Express.Multer.File[]): Promise<{ imageKey: string; fileName: string }[]> {
    const allowed = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif']);
    const results: { imageKey: string; fileName: string }[] = [];
    const uploaded: string[] = [];
    try {
      for (const file of files) {
        if (!allowed.has(file.mimetype)) {
          throw new BadRequestException(`Unsupported image type: ${file.originalname}`);
        }
        const key = await this.putToR2(file);
        uploaded.push(key);
        results.push({ imageKey: key, fileName: file.originalname });
      }
      return results;
    } catch (e) {
      if (uploaded.length > 0) {
        // best-effort orphan cleanup — fail open
        uploaded.forEach((k) => fetch(`http://imgproxy:8080/`).catch(() => {}));
      }
      throw e;
    }
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
    const uploaded: string[] = [];
    try {
      for (const file of files) {
        if (!allowed.has(file.mimetype)) {
          throw new BadRequestException(`Unsupported document type: ${file.originalname}`);
        }
        if (!file.size) throw new BadRequestException(`File is empty: ${file.originalname}`);
        const key = await this.putToR2(file);
        uploaded.push(key);
        results.push({ fileKey: key, fileName: file.originalname, mimeType: file.mimetype, fileSize: file.size });
      }
      return results;
    } catch (e) {
      if (uploaded.length > 0) {
        uploaded.forEach(() => {});
      }
      throw e;
    }
  }

  private buildDetails(dto: Record<string, any>): Record<string, any> {
    const details: Record<string, any> = {};
    const renamedSources = new Set(Object.keys(RENAMED_DETAILS_KEYS));
    for (const [from, to] of Object.entries(RENAMED_DETAILS_KEYS)) {
      if (dto[from] === undefined) continue;
      if (NUMERIC_DETAILS_KEYS.has(to)) {
        const v = num(dto[from]);
        if (v !== undefined) details[to] = v;
      } else if (BOOLEAN_DETAILS_KEYS.has(to)) {
        details[to] = coerceBool(dto[from]);
      } else {
        details[to] = dto[from];
      }
    }
    for (const key of NUMERIC_DETAILS_KEYS) {
      if (dto[key] === undefined || key in details || renamedSources.has(key)) continue;
      const v = num(dto[key]);
      if (v !== undefined) details[key] = v;
    }
    // CRM sends plotArea as free-text (e.g. "1200 sqft"); site field is decimal.
    // Only coerce when it is a pure number; otherwise map to amenities text.
    if (dto.plotArea !== undefined && !('plotArea' in details)) {
      const n = num(dto.plotArea);
      if (n !== undefined && String(n) === String(dto.plotArea).trim()) {
        details['plotArea'] = n;
      } else if (str(dto.plotArea)) {
        // leave as amenities-context note; do not pollute decimal field
      }
    }
    // free-text amenities (comma-separated notes) live outside the master list
    if (dto.commercialAmenities !== undefined && !('amenities' in details)) {
      const v = str(dto.commercialAmenities);
      if (v !== undefined) details['amenities'] = v;
    }
    if (dto.amenities !== undefined && !('amenities' in details)) {
      const v = str(dto.amenities);
      if (v !== undefined) details['amenities'] = v;
    }
    for (const key of PASSTHROUGH_DETAILS_KEYS) {
      if (dto[key] === undefined || renamedSources.has(key)) continue;
      const v = str(dto[key]);
      if (v !== undefined) details[key] = v;
    }
    for (const key of BOOLEAN_DETAILS_KEYS) {
      if (dto[key] === undefined || key in details || renamedSources.has(key)) continue;
      details[key] = coerceBool(dto[key]);
    }
    for (const key of ARRAY_DETAILS_KEYS) {
      if (dto[key] === undefined || key in details || renamedSources.has(key)) continue;
      if (Array.isArray(dto[key])) details[key] = dto[key];
      else if (dto[key] != null && String(dto[key]).trim() !== '') details[key] = [String(dto[key]).trim()];
      // empty / non-array → drop (avoid sending {floorsOccupied: null})
    }
    return details;
  }

  private async buildSitePayload(dto: Record<string, any>): Promise<Record<string, any>> {
    const { cities } = await this.formDataCached();
    const city = dto.cityId ? this.cityNameOf(cities, Number(dto.cityId)) : null;

    const payload: Record<string, any> = {
      title: dto.title,
      description: dto.description ?? '',
      price: dto.price !== undefined && !Number.isNaN(Number(dto.price)) ? String(dto.price) : undefined,
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
      cityId: (() => { const n = dto.cityId !== undefined ? Number(dto.cityId) : undefined; return Number.isNaN(n as any) ? undefined : n; })(),
      sublocationId: (() => { const n = dto.sublocationId !== undefined ? Number(dto.sublocationId) : undefined; return Number.isNaN(n as any) ? undefined : n; })(),
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
      payload.faqs = ((dto as any).faqs as any[]).filter(f => str(f.question) && str(f.answer)).map(f => ({
        question: String(f.question).trim(),
        answer: String(f.answer).trim(),
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
    const s = String(existing.status || '').toLowerCase();
    if (s === 'sold' || s === 'rented') {
      throw new BadRequestException(`Cannot toggle visibility for ${s} properties`);
    }
    const newStatus = s === 'available' ? 'unavailable' : 'available';
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
  async bulkImport(dto: BulkImportPropertyDto): Promise<{ created: number; skipped: number; errors?: { row: number; reason: string }[] }> {
    let created = 0;
    let skipped = 0;
    const errors: { row: number; reason: string }[] = [];

    const { cities, sublocations } = await this.formDataCached();
    const cityMap = new Map<string, any>();
    for (const c of cities) {
      cityMap.set(String(c.city_name ?? c.cityName ?? '').trim().toLowerCase(), c);
    }

    const VALID_PROPERTY_TYPES = new Set([
      'apartment', 'villa', 'plot', 'commercial', 'coworking',
      'farmland', 'industrial', 'individual_portion', 'other',
    ]);

    for (let idx = 0; idx < (dto.properties as any[]).length; idx++) {
      const row = (dto.properties as any[])[idx];
      try {
        const cityKey = String(row.city ?? '').trim().toLowerCase();
        const city = cityMap.get(cityKey);
        if (!city) { skipped++; errors.push({ row: idx + 1, reason: `unknown city: ${String(row.city ?? '').trim()}` }); continue; }

        const propertyType = String(row.propertyType ?? '').trim().toLowerCase();
        if (!VALID_PROPERTY_TYPES.has(propertyType)) { skipped++; errors.push({ row: idx + 1, reason: `unknown propertyType: ${String(row.propertyType ?? '').trim()}` }); continue; }

        // locality scoped by city to avoid cross-city collisions
        const localityKey = String(row.locality ?? '').trim().toLowerCase();
        const sub = localityKey
          ? sublocations.find((s: any) => Number(s.city_id ?? s.cityId) === Number(city.id) && String(s.locality_name ?? s.localityName ?? '').trim().toLowerCase() === localityKey)
          : null;
        if (localityKey && !sub) {
          errors.push({ row: idx + 1, reason: `unknown locality for city: ${String(row.locality ?? '').trim()}` });
        }

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
      } catch (e: any) {
        skipped++;
        errors.push({ row: idx + 1, reason: String(e?.message ?? 'create failed') });
      }
    }

    return { created, skipped, ...(errors.length > 0 ? { errors } : {}) };
  }
}
