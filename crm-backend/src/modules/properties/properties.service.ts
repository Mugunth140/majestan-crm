import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { InjectDataSource } from '@nestjs/typeorm';

import { Property, PropertyStatus, PropertyType } from '../../database/entities/site/property.entity';
import { PropertyDetails } from '../../database/entities/site/property-details.entity';
import { PropertyImage } from '../../database/entities/site/property-image.entity';
import { PropertyLocation } from '../../database/entities/site/property-location.entity';
import { City } from '../../database/entities/site/city.entity';
import { Sublocation } from '../../database/entities/site/sublocation.entity';

import { CreatePropertyDto } from './dto/create-property.dto';
import { UpdatePropertyDto } from './dto/update-property.dto';
import { BulkImportPropertyDto } from './dto/bulk-import-property.dto';
import { PropertyQueryDto } from './dto/property-query.dto';

@Injectable()
export class PropertiesService {
  constructor(
    @InjectRepository(Property, 'site')
    private readonly propertyRepo: Repository<Property>,

    @InjectRepository(PropertyDetails, 'site')
    private readonly propertyDetailsRepo: Repository<PropertyDetails>,

    @InjectRepository(PropertyImage, 'site')
    private readonly propertyImageRepo: Repository<PropertyImage>,

    @InjectRepository(PropertyLocation, 'site')
    private readonly propertyLocationRepo: Repository<PropertyLocation>,

    @InjectRepository(City, 'site')
    private readonly cityRepo: Repository<City>,

    @InjectRepository(Sublocation, 'site')
    private readonly sublocationRepo: Repository<Sublocation>,

    @InjectDataSource('site')
    private readonly siteDataSource: DataSource,
  ) {}

  // ── Fire-and-forget site notification ─────────────────────────────────────
  private async notifySite(propertyId?: number): Promise<void> {
    const secret = process.env.SITE_REVALIDATE_SECRET || 'majestan-isr-secret';
    const base = process.env.SITE_BACKEND_URL || 'http://localhost:5000';
    const ac = new AbortController();
    setTimeout(() => ac.abort(), 3000);
    try {
      await fetch(`${base}/api/revalidate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: ac.signal,
        body: JSON.stringify({ tag: 'properties', secret }),
      });
    } catch {}
    if (propertyId) {
      const ac2 = new AbortController();
      setTimeout(() => ac2.abort(), 3000);
      try {
        const token = process.env.SITE_SERVICE_TOKEN || '';
        await fetch(`${base}/api/v1/admin/search/reindex`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          signal: ac2.signal,
          body: JSON.stringify({ propertyId }),
        });
      } catch {}
    }
  }

  // ── Slug generation ────────────────────────────────────────────────────────
  private generateSlug(title: string): string {
    return title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '') + '-' + Date.now();
  }

  // ── findAll ────────────────────────────────────────────────────────────────
  async findAll(query: PropertyQueryDto) {
    const page = Number(query.page) || 1;
    const limit = Number(query.limit) || 20;
    const offset = (page - 1) * limit;

    const qb = this.propertyRepo.createQueryBuilder('p')
      .leftJoin('property_locations', 'pl', 'pl.property_id = p.id')
      .leftJoin('sublocations', 'sl', 'sl.id = pl.location_id')
      .leftJoin('cities', 'c', 'c.id = sl.city_id')
      .select([
        'p.id AS id',
        'p.title AS title',
        'p.slug AS slug',
        'p.property_code AS propertyCode',
        'p.price AS price',
        'p.property_type AS propertyType',
        'p.listing_type AS listingType',
        'p.status AS status',
        'p.city AS city',
        'p.owner_name AS ownerName',
        'p.owner_phone AS ownerPhone',
        'p.owner_email AS ownerEmail',
        'p.negotiable AS negotiable',
        'p.created_at AS createdAt',
        'p.updated_at AS updatedAt',
        'c.id AS cityId',
        'c.city_name AS cityName',
        'sl.id AS sublocationId',
        'sl.locality_name AS localityName',
      ]);

    if (query.search) {
      qb.andWhere('(p.title LIKE :search OR p.owner_name LIKE :search)', { search: `%${query.search}%` });
    }
    if (query.propertyType) {
      qb.andWhere('p.property_type = :propertyType', { propertyType: query.propertyType });
    }
    if (query.listingType) {
      qb.andWhere('p.listing_type = :listingType', { listingType: query.listingType });
    }
    if (query.status) {
      qb.andWhere('p.status = :status', { status: query.status });
    }
    if (query.cityId) {
      qb.andWhere('c.id = :cityId', { cityId: Number(query.cityId) });
    }

    const total = await qb.getCount();
    const data = await qb.limit(limit).offset(offset).getRawMany();

    return {
      data,
      meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
    };
  }

  // ── findFormData ───────────────────────────────────────────────────────────
  async findFormData() {
    const [cities, sublocations] = await Promise.all([
      this.cityRepo.find({ where: { isActive: 1 }, order: { cityName: 'ASC' } }),
      this.sublocationRepo.find({ where: { isActive: 1 }, order: { localityName: 'ASC' } }),
    ]);
    return { cities, sublocations };
  }

  // ── findOne ────────────────────────────────────────────────────────────────
  async findOne(id: number) {
    const property = await this.propertyRepo.findOne({
      where: { id },
      relations: { propertyDetails: true, propertyImages: true, propertyLocations: true },
    });
    if (!property) throw new NotFoundException(`Property #${id} not found`);
    // Explicitly spread relations so they appear as clean keys (not __relation__)
    return {
      ...property,
      propertyDetails: (property as any).propertyDetails ?? (property as any).__propertyDetails__ ?? null,
      propertyImages: (property as any).propertyImages ?? (property as any).__propertyImages__ ?? [],
      propertyLocations: (property as any).propertyLocations ?? (property as any).__propertyLocations__ ?? [],
    };
  }

  // ── create ─────────────────────────────────────────────────────────────────
  async create(dto: CreatePropertyDto) {
    // Resolve city name from cityId
    const city = await this.cityRepo.findOne({ where: { id: dto.cityId } });
    const cityName = city?.cityName || '';
    const stateName = city?.stateName || '';
    const countryName = city?.countryName || 'India';

    let createdId: number;

    await this.siteDataSource.transaction(async (em) => {
      const property = em.create(Property, {
        title: dto.title,
        slug: this.generateSlug(dto.title),
        description: dto.description || '',
        price: dto.price !== undefined ? String(dto.price) : null,
        propertyType: dto.propertyType as PropertyType,
        listingType: dto.listingType,
        status: (dto.status as PropertyStatus) || PropertyStatus.AVAILABLE,
        city: cityName,
        state: stateName,
        country: countryName,
        ownerName: dto.ownerName || null,
        ownerEmail: dto.ownerEmail || null,
        ownerPhone: dto.ownerPhone || null,
        negotiable: dto.negotiable ?? false,
        verificationStatus: 'Pending',
        approvalStatus: 'Pending',
        alternateName: dto.alternateName ?? null,
        alternatePhone: dto.alternatePhone ?? null,
        alternateEmail: dto.alternateEmail ?? null,
        transactionType: dto.transactionType ?? null,
        handoverDate: dto.handoverDate ?? null,
        roadName: dto.roadName ?? null,
        roadAccess: dto.roadAccess ?? null,
        tenantOccupied: dto.tenantOccupied ?? null,
        saleType: dto.saleType ?? null,
        agentName: dto.agentName ?? null,
        agencyName: dto.agencyName ?? null,
        commissionTerms: dto.commissionTerms ?? null,
        expectedSalePrice: dto.expectedSalePrice != null ? String(dto.expectedSalePrice) : null,
        monthlyRent: dto.monthlyRent != null ? String(dto.monthlyRent) : null,
        lockInPeriod: dto.lockInPeriod ?? null,
        taxes: dto.taxes ?? null,
        registrationCharge: dto.registrationCharge ?? null,
        modeOfPayment: dto.modeOfPayment ?? null,
        timeForRegistration: dto.timeForRegistration ?? null,
        remark: dto.remark ?? null,
        demandArea: dto.demandArea ?? null,
        rentalYield: dto.rentalYield ?? null,
        comparativePrice: dto.comparativePrice ?? null,
        marketPrice: dto.marketPrice ?? null,
        ownershipTitleVerified: dto.ownershipTitleVerified ?? null,
        encumbranceCertificate: dto.encumbranceCertificate ?? null,
        rentalAgreementDraft: dto.rentalAgreementDraft ?? null,
        tslrFmb: dto.tslrFmb ?? null,
        taxReceipt: dto.taxReceipt ?? null,
        ebReceipt: dto.ebReceipt ?? null,
        pattaChitta: dto.pattaChitta ?? null,
        approvals: dto.approvals ?? null,
        financeFacing: dto.financeFacing ?? null,
        hypothecation: dto.hypothecation ?? null,
        deviation: dto.deviation ?? null,
        attachment1: dto.attachment1 ?? null,
        attachment2: dto.attachment2 ?? null,
        attachment3: dto.attachment3 ?? null,
        attachment4: dto.attachment4 ?? null,
        attachment5: dto.attachment5 ?? null,
        attachment6: dto.attachment6 ?? null,
      });
      const saved = await em.save(Property, property);
      createdId = saved.id;

      // Create PropertyDetails
      const details = em.create(PropertyDetails, {
        propertyId: saved.id as any,
        bedrooms: dto.bedrooms ?? 0,
        bathrooms: dto.bathrooms ?? 0,
        areaSqft: dto.areaSqft !== undefined ? String(dto.areaSqft) : '0',
        parking: 0,
        furnished: false,
        udsArea: dto.udsArea != null ? String(dto.udsArea) : null,
        unitNumber: dto.unitNumber ?? null,
        unitType: dto.unitType ?? null,
        numberOfFlats: dto.numberOfFlats ?? null,
        towerNos: dto.towerNos ?? null,
        poojaRoom: dto.poojaRoom ?? null,
        studyRoom: dto.studyRoom ?? null,
        architecturalStyle: dto.architecturalStyle ?? null,
        availablePortion: dto.availablePortion ?? null,
        amenities: dto.amenities ?? null,
        plotNos: dto.plotNos ?? null,
        zoning: dto.zoning ?? null,
        plotType: dto.plotType ?? null,
        landType: dto.landType ?? null,
        topography: dto.topography ?? null,
        soilType: dto.soilType ?? null,
        irrigation: dto.irrigation ?? null,
        fencing: dto.fencing ?? null,
        cropSuitability: dto.cropSuitability ?? null,
        existingPlantation: dto.existingPlantation ?? null,
        boreWell: dto.boreWell ?? null,
        storageTank: dto.storageTank ?? null,
        waterSources: dto.waterSources ?? null,
        sfNumber: dto.sfNumber ?? null,
        propertyUse: dto.propertyUse ?? null,
        noOfLifts: dto.noOfLifts ?? null,
        dimension: dto.dimension ?? null,
        frontage: dto.frontage ?? null,
        outsideParking: dto.outsideParking ?? null,
        visitorsParking: dto.visitorsParking ?? null,
        fireSafety: dto.fireSafety ?? null,
        electricityConnection: dto.electricityConnection ?? null,
        conferenceRoom: dto.conferenceRoom ?? null,
        seater: dto.seater ?? null,
        tenantMix: dto.tenantMix ?? null,
        buildingType: dto.buildingType ?? null,
        numberOfBays: dto.numberOfBays ?? null,
        numberOfCabins: dto.numberOfCabins ?? null,
        loadingBays: dto.loadingBays ?? null,
        warehouseRacks: dto.warehouseRacks ?? null,
        truckTrailerAccess: dto.truckTrailerAccess ?? null,
        craneAvailable: dto.craneAvailable ?? null,
        workerFacilities: dto.workerFacilities ?? null,
        nearestHighway: dto.nearestHighway ?? null,
        nearestRailway: dto.nearestRailway ?? null,
        nearestPort: dto.nearestPort ?? null,
        nearestAirport: dto.nearestAirport ?? null,
        labourAvailability: dto.labourAvailability ?? null,
        advanceRent: dto.advanceRent != null ? String(dto.advanceRent) : null,
        leaseTerm: dto.leaseTerm ?? null,
        incrementalRent: dto.incrementalRent ?? null,
        electricityCharges: dto.electricityCharges ?? null,
        highSpeedWifi: dto.highSpeedWifi ?? null,
        airConditioning: dto.airConditioning ?? null,
        cctvSurveillance: dto.cctvSurveillance ?? null,
        elevatorAccess: dto.elevatorAccess ?? null,
        securityStaff: dto.securityStaff ?? null,
        furnitureProvided: dto.furnitureProvided ?? null,
        outdoorSpaces: dto.outdoorSpaces ?? null,
        utilitiesProvided: dto.utilitiesProvided ?? null,
        neighborhoodHighlights: dto.neighborhoodHighlights ?? null,
        communityFacilities: dto.communityFacilities ?? null,
        accessibility: dto.accessibility ?? null,
      });
      await em.save(PropertyDetails, details);

      // Create PropertyLocation if sublocationId provided
      if (dto.sublocationId) {
        const location = em.create(PropertyLocation, {
          propertyId: saved.id,
          locationId: dto.sublocationId,
        });
        await em.save(PropertyLocation, location);
      }

      // Create PropertyImages
      if (dto.imageUrls && dto.imageUrls.length > 0) {
        const images = dto.imageUrls.map((img) =>
          em.create(PropertyImage, {
            propertyId: saved.id,
            imageUrl: img.imageUrl,
            imageKey: img.imageKey,
            isPrimary: img.isPrimary,
          }),
        );
        await em.save(PropertyImage, images);
      }
    });

    // Fire-and-forget after commit
    void this.notifySite(createdId!);

    return this.findOne(createdId!);
  }

  // ── update ─────────────────────────────────────────────────────────────────
  async update(id: number, dto: UpdatePropertyDto) {
    const existing = await this.propertyRepo.findOne({ where: { id } });
    if (!existing) throw new NotFoundException(`Property #${id} not found`);

    let cityName = existing.city;
    let stateName = existing.state;
    let countryName = existing.country;

    if (dto.cityId) {
      const city = await this.cityRepo.findOne({ where: { id: dto.cityId } });
      if (city) {
        cityName = city.cityName;
        stateName = city.stateName;
        countryName = city.countryName;
      }
    }

    await this.siteDataSource.transaction(async (em) => {
      // Update Property
      const updateData: Partial<Property> = {};
      if (dto.title !== undefined) { updateData.title = dto.title; updateData.slug = this.generateSlug(dto.title); }
      if (dto.description !== undefined) updateData.description = dto.description;
      if (dto.price !== undefined) updateData.price = String(dto.price);
      if (dto.propertyType !== undefined) updateData.propertyType = dto.propertyType as PropertyType;
      if (dto.listingType !== undefined) updateData.listingType = dto.listingType;
      if (dto.status !== undefined) updateData.status = dto.status as PropertyStatus;
      if (dto.ownerName !== undefined) updateData.ownerName = dto.ownerName;
      if (dto.ownerEmail !== undefined) updateData.ownerEmail = dto.ownerEmail;
      if (dto.ownerPhone !== undefined) updateData.ownerPhone = dto.ownerPhone;
      if (dto.negotiable !== undefined) updateData.negotiable = dto.negotiable;
      if (dto.cityId) { updateData.city = cityName; updateData.state = stateName; updateData.country = countryName; }
      if (dto.alternateName !== undefined) updateData.alternateName = dto.alternateName ?? null;
      if (dto.alternatePhone !== undefined) updateData.alternatePhone = dto.alternatePhone ?? null;
      if (dto.alternateEmail !== undefined) updateData.alternateEmail = dto.alternateEmail ?? null;
      if (dto.transactionType !== undefined) updateData.transactionType = dto.transactionType ?? null;
      if (dto.handoverDate !== undefined) updateData.handoverDate = dto.handoverDate ?? null;
      if (dto.roadName !== undefined) updateData.roadName = dto.roadName ?? null;
      if (dto.roadAccess !== undefined) updateData.roadAccess = dto.roadAccess ?? null;
      if (dto.tenantOccupied !== undefined) updateData.tenantOccupied = dto.tenantOccupied ?? null;
      if (dto.saleType !== undefined) updateData.saleType = dto.saleType ?? null;
      if (dto.agentName !== undefined) updateData.agentName = dto.agentName ?? null;
      if (dto.agencyName !== undefined) updateData.agencyName = dto.agencyName ?? null;
      if (dto.commissionTerms !== undefined) updateData.commissionTerms = dto.commissionTerms ?? null;
      if (dto.expectedSalePrice !== undefined) updateData.expectedSalePrice = dto.expectedSalePrice != null ? String(dto.expectedSalePrice) : null;
      if (dto.monthlyRent !== undefined) updateData.monthlyRent = dto.monthlyRent != null ? String(dto.monthlyRent) : null;
      if (dto.lockInPeriod !== undefined) updateData.lockInPeriod = dto.lockInPeriod ?? null;
      if (dto.taxes !== undefined) updateData.taxes = dto.taxes ?? null;
      if (dto.registrationCharge !== undefined) updateData.registrationCharge = dto.registrationCharge ?? null;
      if (dto.modeOfPayment !== undefined) updateData.modeOfPayment = dto.modeOfPayment ?? null;
      if (dto.timeForRegistration !== undefined) updateData.timeForRegistration = dto.timeForRegistration ?? null;
      if (dto.remark !== undefined) updateData.remark = dto.remark ?? null;
      if (dto.demandArea !== undefined) updateData.demandArea = dto.demandArea ?? null;
      if (dto.rentalYield !== undefined) updateData.rentalYield = dto.rentalYield ?? null;
      if (dto.comparativePrice !== undefined) updateData.comparativePrice = dto.comparativePrice ?? null;
      if (dto.marketPrice !== undefined) updateData.marketPrice = dto.marketPrice ?? null;
      if (dto.ownershipTitleVerified !== undefined) updateData.ownershipTitleVerified = dto.ownershipTitleVerified ?? null;
      if (dto.encumbranceCertificate !== undefined) updateData.encumbranceCertificate = dto.encumbranceCertificate ?? null;
      if (dto.rentalAgreementDraft !== undefined) updateData.rentalAgreementDraft = dto.rentalAgreementDraft ?? null;
      if (dto.tslrFmb !== undefined) updateData.tslrFmb = dto.tslrFmb ?? null;
      if (dto.taxReceipt !== undefined) updateData.taxReceipt = dto.taxReceipt ?? null;
      if (dto.ebReceipt !== undefined) updateData.ebReceipt = dto.ebReceipt ?? null;
      if (dto.pattaChitta !== undefined) updateData.pattaChitta = dto.pattaChitta ?? null;
      if (dto.approvals !== undefined) updateData.approvals = dto.approvals ?? null;
      if (dto.financeFacing !== undefined) updateData.financeFacing = dto.financeFacing ?? null;
      if (dto.hypothecation !== undefined) updateData.hypothecation = dto.hypothecation ?? null;
      if (dto.deviation !== undefined) updateData.deviation = dto.deviation ?? null;
      if (dto.attachment1 !== undefined) updateData.attachment1 = dto.attachment1 ?? null;
      if (dto.attachment2 !== undefined) updateData.attachment2 = dto.attachment2 ?? null;
      if (dto.attachment3 !== undefined) updateData.attachment3 = dto.attachment3 ?? null;
      if (dto.attachment4 !== undefined) updateData.attachment4 = dto.attachment4 ?? null;
      if (dto.attachment5 !== undefined) updateData.attachment5 = dto.attachment5 ?? null;
      if (dto.attachment6 !== undefined) updateData.attachment6 = dto.attachment6 ?? null;

      await em.update(Property, { id }, updateData);

      // Update PropertyDetails
      const detailsUpdate: Partial<PropertyDetails> = {};
      if (dto.bedrooms !== undefined) detailsUpdate.bedrooms = dto.bedrooms;
      if (dto.bathrooms !== undefined) detailsUpdate.bathrooms = dto.bathrooms;
      if (dto.areaSqft !== undefined) detailsUpdate.areaSqft = String(dto.areaSqft);
      if (dto.udsArea !== undefined) detailsUpdate.udsArea = dto.udsArea != null ? String(dto.udsArea) : null;
      if (dto.unitNumber !== undefined) detailsUpdate.unitNumber = dto.unitNumber ?? null;
      if (dto.unitType !== undefined) detailsUpdate.unitType = dto.unitType ?? null;
      if (dto.numberOfFlats !== undefined) detailsUpdate.numberOfFlats = dto.numberOfFlats ?? null;
      if (dto.towerNos !== undefined) detailsUpdate.towerNos = dto.towerNos ?? null;
      if (dto.poojaRoom !== undefined) detailsUpdate.poojaRoom = dto.poojaRoom ?? null;
      if (dto.studyRoom !== undefined) detailsUpdate.studyRoom = dto.studyRoom ?? null;
      if (dto.architecturalStyle !== undefined) detailsUpdate.architecturalStyle = dto.architecturalStyle ?? null;
      if (dto.availablePortion !== undefined) detailsUpdate.availablePortion = dto.availablePortion ?? null;
      if (dto.amenities !== undefined) detailsUpdate.amenities = dto.amenities ?? null;
      if (dto.plotNos !== undefined) detailsUpdate.plotNos = dto.plotNos ?? null;
      if (dto.zoning !== undefined) detailsUpdate.zoning = dto.zoning ?? null;
      if (dto.plotType !== undefined) detailsUpdate.plotType = dto.plotType ?? null;
      if (dto.landType !== undefined) detailsUpdate.landType = dto.landType ?? null;
      if (dto.topography !== undefined) detailsUpdate.topography = dto.topography ?? null;
      if (dto.soilType !== undefined) detailsUpdate.soilType = dto.soilType ?? null;
      if (dto.irrigation !== undefined) detailsUpdate.irrigation = dto.irrigation ?? null;
      if (dto.fencing !== undefined) detailsUpdate.fencing = dto.fencing ?? null;
      if (dto.cropSuitability !== undefined) detailsUpdate.cropSuitability = dto.cropSuitability ?? null;
      if (dto.existingPlantation !== undefined) detailsUpdate.existingPlantation = dto.existingPlantation ?? null;
      if (dto.boreWell !== undefined) detailsUpdate.boreWell = dto.boreWell ?? null;
      if (dto.storageTank !== undefined) detailsUpdate.storageTank = dto.storageTank ?? null;
      if (dto.waterSources !== undefined) detailsUpdate.waterSources = dto.waterSources ?? null;
      if (dto.sfNumber !== undefined) detailsUpdate.sfNumber = dto.sfNumber ?? null;
      if (dto.propertyUse !== undefined) detailsUpdate.propertyUse = dto.propertyUse ?? null;
      if (dto.noOfLifts !== undefined) detailsUpdate.noOfLifts = dto.noOfLifts ?? null;
      if (dto.dimension !== undefined) detailsUpdate.dimension = dto.dimension ?? null;
      if (dto.frontage !== undefined) detailsUpdate.frontage = dto.frontage ?? null;
      if (dto.outsideParking !== undefined) detailsUpdate.outsideParking = dto.outsideParking ?? null;
      if (dto.visitorsParking !== undefined) detailsUpdate.visitorsParking = dto.visitorsParking ?? null;
      if (dto.fireSafety !== undefined) detailsUpdate.fireSafety = dto.fireSafety ?? null;
      if (dto.electricityConnection !== undefined) detailsUpdate.electricityConnection = dto.electricityConnection ?? null;
      if (dto.conferenceRoom !== undefined) detailsUpdate.conferenceRoom = dto.conferenceRoom ?? null;
      if (dto.seater !== undefined) detailsUpdate.seater = dto.seater ?? null;
      if (dto.tenantMix !== undefined) detailsUpdate.tenantMix = dto.tenantMix ?? null;
      if (dto.buildingType !== undefined) detailsUpdate.buildingType = dto.buildingType ?? null;
      if (dto.numberOfBays !== undefined) detailsUpdate.numberOfBays = dto.numberOfBays ?? null;
      if (dto.numberOfCabins !== undefined) detailsUpdate.numberOfCabins = dto.numberOfCabins ?? null;
      if (dto.loadingBays !== undefined) detailsUpdate.loadingBays = dto.loadingBays ?? null;
      if (dto.warehouseRacks !== undefined) detailsUpdate.warehouseRacks = dto.warehouseRacks ?? null;
      if (dto.truckTrailerAccess !== undefined) detailsUpdate.truckTrailerAccess = dto.truckTrailerAccess ?? null;
      if (dto.craneAvailable !== undefined) detailsUpdate.craneAvailable = dto.craneAvailable ?? null;
      if (dto.workerFacilities !== undefined) detailsUpdate.workerFacilities = dto.workerFacilities ?? null;
      if (dto.nearestHighway !== undefined) detailsUpdate.nearestHighway = dto.nearestHighway ?? null;
      if (dto.nearestRailway !== undefined) detailsUpdate.nearestRailway = dto.nearestRailway ?? null;
      if (dto.nearestPort !== undefined) detailsUpdate.nearestPort = dto.nearestPort ?? null;
      if (dto.nearestAirport !== undefined) detailsUpdate.nearestAirport = dto.nearestAirport ?? null;
      if (dto.labourAvailability !== undefined) detailsUpdate.labourAvailability = dto.labourAvailability ?? null;
      if (dto.advanceRent !== undefined) detailsUpdate.advanceRent = dto.advanceRent != null ? String(dto.advanceRent) : null;
      if (dto.leaseTerm !== undefined) detailsUpdate.leaseTerm = dto.leaseTerm ?? null;
      if (dto.incrementalRent !== undefined) detailsUpdate.incrementalRent = dto.incrementalRent ?? null;
      if (dto.electricityCharges !== undefined) detailsUpdate.electricityCharges = dto.electricityCharges ?? null;
      if (dto.highSpeedWifi !== undefined) detailsUpdate.highSpeedWifi = dto.highSpeedWifi ?? null;
      if (dto.airConditioning !== undefined) detailsUpdate.airConditioning = dto.airConditioning ?? null;
      if (dto.cctvSurveillance !== undefined) detailsUpdate.cctvSurveillance = dto.cctvSurveillance ?? null;
      if (dto.elevatorAccess !== undefined) detailsUpdate.elevatorAccess = dto.elevatorAccess ?? null;
      if (dto.securityStaff !== undefined) detailsUpdate.securityStaff = dto.securityStaff ?? null;
      if (dto.furnitureProvided !== undefined) detailsUpdate.furnitureProvided = dto.furnitureProvided ?? null;
      if (dto.outdoorSpaces !== undefined) detailsUpdate.outdoorSpaces = dto.outdoorSpaces ?? null;
      if (dto.utilitiesProvided !== undefined) detailsUpdate.utilitiesProvided = dto.utilitiesProvided ?? null;
      if (dto.neighborhoodHighlights !== undefined) detailsUpdate.neighborhoodHighlights = dto.neighborhoodHighlights ?? null;
      if (dto.communityFacilities !== undefined) detailsUpdate.communityFacilities = dto.communityFacilities ?? null;
      if (dto.accessibility !== undefined) detailsUpdate.accessibility = dto.accessibility ?? null;

      if (Object.keys(detailsUpdate).length > 0) {
        await em.update(PropertyDetails, { propertyId: id }, detailsUpdate);
      }

      // Update location if sublocationId provided
      if (dto.sublocationId !== undefined) {
        await em.delete(PropertyLocation, { propertyId: id });
        if (dto.sublocationId) {
          const location = em.create(PropertyLocation, {
            propertyId: id,
            locationId: dto.sublocationId,
          });
          await em.save(PropertyLocation, location);
        }
      }

      // Replace images if imageUrls provided
      if (dto.imageUrls !== undefined) {
        await em.delete(PropertyImage, { propertyId: id });
        if (dto.imageUrls.length > 0) {
          const images = dto.imageUrls.map((img) =>
            em.create(PropertyImage, {
              propertyId: id,
              imageUrl: img.imageUrl,
              imageKey: img.imageKey,
              isPrimary: img.isPrimary,
            }),
          );
          await em.save(PropertyImage, images);
        }
      }
    });

    void this.notifySite(id);
    return this.findOne(id);
  }

  // ── toggleVisibility ───────────────────────────────────────────────────────
  async toggleVisibility(id: number) {
    const property = await this.propertyRepo.findOne({ where: { id } });
    if (!property) throw new NotFoundException(`Property #${id} not found`);

    const newStatus =
      property.status === PropertyStatus.AVAILABLE
        ? PropertyStatus.UNAVAILABLE
        : PropertyStatus.AVAILABLE;

    await this.propertyRepo.update({ id }, { status: newStatus });
    void this.notifySite(id);
    return { id, status: newStatus };
  }

  // ── remove ─────────────────────────────────────────────────────────────────
  async remove(id: number) {
    const property = await this.propertyRepo.findOne({ where: { id } });
    if (!property) throw new NotFoundException(`Property #${id} not found`);
    await this.propertyRepo.delete({ id });
    void this.notifySite();
    return { id, deleted: true };
  }

  // ── bulkImport ─────────────────────────────────────────────────────────────
  async bulkImport(dto: BulkImportPropertyDto): Promise<{ created: number; skipped: number }> {
    let created = 0;
    let skipped = 0;

    // Load all cities and sublocations for lookup
    const allCities = await this.cityRepo.find();
    const allSublocations = await this.sublocationRepo.find();

    const cityMap = new Map<string, City>();
    for (const c of allCities) {
      cityMap.set(c.cityName.toLowerCase(), c);
    }

    const sublocationMap = new Map<string, Sublocation>();
    for (const s of allSublocations) {
      sublocationMap.set(s.localityName.toLowerCase(), s);
    }

    const VALID_PROPERTY_TYPES = new Set([
      'apartment', 'villa', 'plot', 'commercial', 'coworking',
      'farmland', 'industrial', 'individual_portion', 'other',
    ]);

    for (const row of dto.properties) {
      try {
        // Resolve city
        const city = cityMap.get(row.city.toLowerCase());
        if (!city) { skipped++; continue; }

        // Resolve propertyType
        const propertyType = row.propertyType.toLowerCase();
        if (!VALID_PROPERTY_TYPES.has(propertyType)) { skipped++; continue; }

        // Resolve listingType
        const listingType = row.listingType.toLowerCase() === 'rent' ? 'Rent' : 'Sell';

        // Resolve sublocation
        let sublocationId: number | undefined;
        if (row.locality) {
          const sub = sublocationMap.get(row.locality.toLowerCase());
          if (sub) sublocationId = sub.id;
        }

        await this.siteDataSource.transaction(async (em) => {
          const property = em.create(Property, {
            title: row.title,
            slug: this.generateSlug(row.title),
            description: row.description || '',
            price: row.price !== undefined ? String(row.price) : null,
            propertyType: propertyType as PropertyType,
            listingType: listingType as 'Sell' | 'Rent',
            status: PropertyStatus.AVAILABLE,
            city: city.cityName,
            state: city.stateName,
            country: city.countryName,
            ownerName: row.ownerName || null,
            ownerPhone: row.ownerPhone || null,
            negotiable: false,
            verificationStatus: 'Pending',
            approvalStatus: 'Pending',
          });
          const saved = await em.save(Property, property);

          const details = em.create(PropertyDetails, {
            propertyId: saved.id,
            bedrooms: row.bedrooms ?? 0,
            bathrooms: row.bathrooms ?? 0,
            areaSqft: row.areaSqft !== undefined ? String(row.areaSqft) : '0',
            parking: 0,
            furnished: false,
          });
          await em.save(PropertyDetails, details);

          if (sublocationId) {
            const location = em.create(PropertyLocation, {
              propertyId: saved.id,
              locationId: sublocationId,
            });
            await em.save(PropertyLocation, location);
          }
        });

        created++;
      } catch {
        skipped++;
      }
    }

    void this.notifySite();
    return { created, skipped };
  }
}
