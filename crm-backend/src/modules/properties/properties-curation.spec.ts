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

describe('Hidden rental registration fields', () => {
  it('does not reset omitted RERA while editing a rental', async () => {
    const { service, siteApi } = setup('commercial', {});
    await service.update(7, { listingType: 'Rent', price: 30000 });
    expect(siteApi.patch.mock.calls[0][1]).not.toHaveProperty('reraNumber');
    expect(siteApi.patch.mock.calls[0][1].builderName).toBeUndefined();
    expect(siteApi.patch.mock.calls[0][1].projectName).toBeUndefined();
  });
  it('still applies explicitly submitted RERA changes', async () => {
    const { service, siteApi } = setup('apartment', {});
    await service.update(7, { reraNumber: 'Registered' });
    expect(siteApi.patch.mock.calls[0][1].reraNumber).toBe('Registered');
  });
});

describe('Fine-grained property specifications', () => {
  it('saves new counts, ground-floor flag, plot facing, units and funding source', async () => {
    const { service, siteApi } = setup('villa', { measurementUnits: { carpetArea: 'Sq M' } });
    await service.update(7, { builtUpArea: 4356, measurementUnits: { builtUpArea: 'Cents' }, plotFacing: 'East', hasGroundFloor: false, numberOfPortions: 3, fundedBy: 'Bank', parking: 2, noOfLifts: 1 });
    expect(siteApi.patch).toHaveBeenCalledWith('/admin/properties/villa/7', expect.objectContaining({
      details: expect.objectContaining({ buildUpArea: 4356, measurementUnits: { carpetArea: 'Sq M', builtUpArea: 'Cents' }, plotFacing: 'East', hasGroundFloor: false, numberOfPortions: 3, fundedBy: 'Bank', parking: 2, noOfLifts: 1 }),
    }));
  });
  it('retains saved specification additions on unrelated partial edits', async () => {
    const { service, siteApi } = setup('individual_portion', { numberOfPortions: 4, hasGroundFloor: true, plotFacing: 'West', fundedBy: 'NDFC', measurementUnits: { plotArea: 'Acres' } });
    await service.update(7, { bedrooms: 3 });
    expect(siteApi.patch.mock.calls[0][1].details).toMatchObject({ numberOfPortions: 4, hasGroundFloor: true, plotFacing: 'West', fundedBy: 'NDFC', measurementUnits: { plotArea: 'Acres' } });
  });
});

describe('Industrial and land field persistence', () => {
  it('preserves long multi-select values, industrial counts and rate units', async () => {
    const { service, siteApi } = setup('industrial', {});
    const certificates = 'DTCP / Local Planning Approved Plan, TNPCB CTO (Consent to Operate), PESO License (Chemicals & Explosives)';
    await service.update(7, { propertyUse: 'General Warehousing, Logistics & Distribution', buildingApprovalCert: certificates, containerAccess: '40 ft', laborRooms: 3, toilets: 4, plotArea: '4800', builtUpArea: 2400, carpetArea: 2100, measurementUnits: { openArea: 'Grounds', pricePerSqft: 'Acres' } });
    expect(siteApi.patch.mock.calls[0][1].details).toMatchObject({ propertyUse: 'General Warehousing, Logistics & Distribution', buildingApprovalCert: certificates, containerAccess: '40 ft', laborRooms: 3, toilets: 4, plotArea: 4800, buildUpArea: 2400, carpetArea: 2100, measurementUnits: { openArea: 'Grounds', pricePerSqft: 'Acres' } });
  });
  it('keeps four boundary directions and nullable lengths through mapping', async () => {
    const { service, siteApi } = setup('plot', {});
    const boundaries = ['North East', 'East', 'South', 'West'].map((direction, index) => ({ direction, length: index === 0 ? 42.5 : null, unit: 'ft' }));
    await service.update(7, { plotBoundaries: boundaries, pricePerSqft: 100, measurementUnits: { pricePerSqft: 'Grounds' } });
    expect(siteApi.patch.mock.calls[0][1].details).toMatchObject({ plotBoundaries: boundaries, measurementUnits: { pricePerSqft: 'Grounds' } });
    expect(siteApi.patch.mock.calls[0][1].pricePerSqft).toBe('100');
  });
  it('saves combined Farm House fields and rejects rental creates and edits', async () => {
    const { service, siteApi } = setup('farm_house', {});
    await service.create({ title: 'Farm home', listingType: 'Sell', propertyType: 'farm_house', cityId: 1, price: 9000000, bedrooms: 3, cropSuitability: 'Coconut', boreWell: true, boreWellCount: 2 });
    expect(siteApi.post).toHaveBeenCalledWith('/admin/properties/farm_house', expect.objectContaining({ details: expect.objectContaining({ bedrooms: 3, cropSuitability: 'Coconut', boreWell: true, boreWellCount: 2 }) }));
    await expect(service.update(7, { listingType: 'Rent' })).rejects.toThrow('Buy only');
    await expect(service.create({ title: 'Farm rent', listingType: 'Rent', propertyType: 'farm_house', cityId: 1, price: 10000 })).rejects.toThrow('Buy only');
  });
});

describe('Commercial rental classification', () => {
  it('saves separate use, special purpose and accessibility values', async () => {
    const { service, siteApi } = setup('commercial', {});
    await service.update(7, { listingType: 'Rent', propertyUse: 'Corporate Office', specialPurpose: 'Gym / Fitness Center', accessibility: 'On Road', furnishingStatus: 'SEMI FURNISHED', conferenceRoom: 2, privateCabins: 3, seater: 20 });
    expect(siteApi.patch.mock.calls[0][1].details).toMatchObject({ propertyUse: 'Corporate Office', specialPurpose: 'Gym / Fitness Center', accessibility: 'On Road', conferenceRoom: 2, privateCabins: 3, seater: 20 });
  });
  it('preserves classification values on a partial update', async () => {
    const { service, siteApi } = setup('commercial', { specialPurpose: 'Cafe / Coffee Shop', accessibility: 'Inside Colony' });
    const result = await service.update(7, { price: 30000 });
    expect(siteApi.patch.mock.calls[0][1]).not.toHaveProperty('details');
    expect(result.propertyDetails).toMatchObject({ specialPurpose: 'Cafe / Coffee Shop', accessibility: 'Inside Colony' });
  });
});

describe('Explicit curation removals', () => {
  it('clears visible multi selections without clearing omitted legacy details', async () => {
    const { service, siteApi } = setup('industrial', { propertyUse: 'Warehousing', buildingApprovalCert: 'Fire NOC', soilType: 'Imported' });
    await service.update(7, { propertyUse: '', buildingApprovalCert: '', approvals: '', hypothecation: 'No' });
    expect(siteApi.patch.mock.calls[0][1]).toMatchObject({
      approvals: null, hypothecation: 'No',
      details: { propertyUse: '', buildingApprovalCert: '', soilType: 'Imported' },
    });
  });
  it('does not default document visibility to public', async () => {
    const { service, siteApi } = setup('apartment', {});
    await service.update(7, { documents: [{ fileKey: 'private.pdf', fileName: 'Private' }] });
    expect(siteApi.patch.mock.calls[0][1].documents[0]).not.toHaveProperty('isPublic');
  });
});
