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

    const [data, total] = await Promise.all([
      qb.limit(limit).offset(offset).getRawMany(),
      qb.getCount(),
    ]);

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
    return property;
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
      });
      const saved = await em.save(Property, property);
      createdId = saved.id;

      // Create PropertyDetails
      const details = em.create(PropertyDetails, {
        propertyId: saved.id,
        bedrooms: dto.bedrooms ?? 0,
        bathrooms: dto.bathrooms ?? 0,
        areaSqft: dto.areaSqft !== undefined ? String(dto.areaSqft) : '0',
        parking: 0,
        furnished: false,
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

      await em.update(Property, { id }, updateData);

      // Update PropertyDetails
      const detailsUpdate: Partial<PropertyDetails> = {};
      if (dto.bedrooms !== undefined) detailsUpdate.bedrooms = dto.bedrooms;
      if (dto.bathrooms !== undefined) detailsUpdate.bathrooms = dto.bathrooms;
      if (dto.areaSqft !== undefined) detailsUpdate.areaSqft = String(dto.areaSqft);

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
