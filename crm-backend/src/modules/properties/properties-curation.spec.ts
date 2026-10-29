import type { DataSource } from 'typeorm';
import type { PermissionsService } from '../permissions/permissions.service';
import { PropertiesService } from './properties.service';
import type { SiteApiService } from './site-api.service';

function setup(propertyType: string, propertyDetails: Record<string, unknown>) {
  const siteApi = {
    get: jest.fn(async (path: string) => path === '/properties/form-data'
      ? { cities: [] }
      : { id: 7, propertyType, listingType: propertyType === 'pg_service_apartment' ? 'Rent' : 'Sell', status: 'available', propertyDetails }),
    post: jest.fn(async (_path: string, _body: Record<string, unknown>) => ({ id: 7 })),
    patch: jest.fn(async (_path: string, _body: Record<string, unknown>) => ({ id: 7 })),
  };
  const service = new PropertiesService(
    siteApi as unknown as SiteApiService,
    {} as PermissionsService,
    {} as DataSource,
  );
  return { service, siteApi };
}

describe('Curated property edits', () => {
  it('preserves omitted imported details while applying explicit changes', async () => {
    const { service, siteApi } = setup('commercial', {
      bedrooms: 3, builtUpArea: '1400', propertyFacing: 'East',
      furnished: true, sharedWashrooms: 2, roomDimensions: [{ name: 'Old room', dimensions: '10x10' }],
    });
    await service.update(7, { areaSqft: 1600, furnished: false });
    expect(siteApi.patch).toHaveBeenCalledWith('/admin/properties/commercial/7', expect.objectContaining({
      details: expect.objectContaining({
        bedrooms: 3, buildUpArea: 1400, facing: 'East', areaSqft: 1600,
        furnished: false, sharedWashrooms: 2,
        roomDimensions: [{ name: 'Old room', dimensions: '10x10' }],
      }),
    }));
  });

  it('keeps farmland soil and irrigation when an edit omits them', async () => {
    const { service, siteApi } = setup('farmland', { soilType: 'Red', irrigation: 'Canal', boreWell: true });
    await service.update(7, { areaSqft: 20000 });
    expect(siteApi.patch).toHaveBeenCalledWith('/admin/properties/farmland/7', expect.objectContaining({
      details: expect.objectContaining({ soilType: 'Red', irrigation: 'Canal', boreWell: true, areaSqft: 20000 }),
    }));
  });

  it('uses the stored type for mappings even if a client sends another type', async () => {
    const { service, siteApi } = setup('industrial', { powerSupply2: 'Three phase' });
    await service.update(7, { propertyType: 'apartment', powerSupply3: 'Backup' });
    expect(siteApi.patch).toHaveBeenCalledWith('/admin/properties/industrial/7', expect.objectContaining({
      details: expect.objectContaining({ powerSupply2: 'Three phase', powerSupply3: 'Backup' }),
    }));
    expect(siteApi.patch.mock.calls[0][1]).not.toHaveProperty('propertyType');
  });
});

describe('Investment Property requests', () => {
  it('saves Independent House details under the new type', async () => {
    const { service, siteApi } = setup('investment_property', {});
    const result = await service.create({ title: 'Investment home', propertyType: 'investment_property', listingType: 'Sell', cityId: 1, price: 8000000, builtUpArea: 1500, bedrooms: 3, plotArea: '2400', availablePortion: 'Ground floor' });
    expect(result.propertyType).toBe('investment_property');
    expect(siteApi.post).toHaveBeenCalledWith('/admin/properties/investment_property', expect.objectContaining({
      propertyType: 'investment_property', listingType: 'Sell',
      details: expect.objectContaining({ buildUpArea: 1500, bedrooms: 3, plotArea: 2400, availablePortion: 'Ground floor' }),
    }));
  });
  it('rejects rental creates and edits', async () => {
    const { service, siteApi } = setup('investment_property', {});
    await expect(service.create({ title: 'Rental', propertyType: 'investment_property', listingType: 'Rent', cityId: 1, price: 10000 })).rejects.toThrow('Buy only');
    await expect(service.update(7, { listingType: 'Rent' })).rejects.toThrow('Buy only');
    expect(siteApi.post).not.toHaveBeenCalled();
    expect(siteApi.patch).not.toHaveBeenCalled();
  });
});

describe('PG / Service Apartment requests', () => {
  it('keeps Rent on partial edits that omit listing type', async () => {
    const { service, siteApi } = setup('pg_service_apartment', { bedrooms: 2 });
    await service.update(7, { areaSqft: 1200 });
    expect(siteApi.patch).toHaveBeenCalledWith('/admin/properties/pg_service_apartment/7', expect.objectContaining({ listingType: 'Rent', details: expect.objectContaining({ bedrooms: 2, areaSqft: 1200 }) }));
  });
  it('saves Apartment rental details under the new type', async () => {
    const { service, siteApi } = setup('pg_service_apartment', {});
    const result = await service.create({ title: 'Service apartment', propertyType: 'pg_service_apartment', listingType: 'Rent', cityId: 1, price: 25000, builtUpArea: 1200, bedrooms: 2, unitType: '2BHK', securityDeposit: '3 Months' });
    expect(result.propertyType).toBe('pg_service_apartment');
    expect(siteApi.post).toHaveBeenCalledWith('/admin/properties/pg_service_apartment', expect.objectContaining({
      propertyType: 'pg_service_apartment', listingType: 'Rent', securityDeposit: '3 Months',
      details: expect.objectContaining({ buildUpArea: 1200, bedrooms: 2, unitType: '2BHK' }),
    }));
  });
  it('rejects sale creates and edits', async () => {
    const { service, siteApi } = setup('pg_service_apartment', {});
    await expect(service.create({ title: 'Sale', propertyType: 'pg_service_apartment', listingType: 'Sell', cityId: 1, price: 100000 })).rejects.toThrow('Rent only');
    await expect(service.update(7, { listingType: 'Sell' })).rejects.toThrow('Rent only');
    expect(siteApi.post).not.toHaveBeenCalled();
    expect(siteApi.patch).not.toHaveBeenCalled();
  });
});

describe('Sqft Price', () => {
  it('forwards the per-square-foot rate independently of the total sale price', async () => {
    const { service, siteApi } = setup('commercial', {});
    await service.update(7, { pricePerSqft: 6500.5 });
    const payload = siteApi.patch.mock.calls[0][1];
    expect(payload.pricePerSqft).toBe('6500.5');
    expect(payload.expectedSalePrice).toBeUndefined();
  });
});
