import { ValidationPipe } from '@nestjs/common';
import type { DataSource } from 'typeorm';
import type { PermissionsService } from '../permissions/permissions.service';
import { CreatePropertyDto } from './dto/create-property.dto';
import { UpdatePropertyDto } from './dto/update-property.dto';
import { PropertiesService } from './properties.service';
import type { SiteApiService } from './site-api.service';

const pipe = new ValidationPipe({ whitelist: true, transform: true });
async function validateUpdate(
  body: Record<string, unknown>,
): Promise<UpdatePropertyDto> {
  return (await pipe.transform(body, {
    type: 'body',
    metatype: UpdatePropertyDto,
  })) as UpdatePropertyDto;
}

function make() {
  let storedIds = [1];
  const record = () => ({
    id: 7,
    propertyType: 'apartment',
    status: 'available',
    propertyFurnishings: storedIds.map((id) => ({
      propertyId: 7,
      furnishingItemId: id,
      furnishingItem: { id, name: `Item ${id}` },
    })),
  });
  const siteApi = {
    get: jest.fn(async (path: string) =>
      path === '/properties/form-data' ? { cities: [] } : record(),
    ),
    patch: jest.fn(
      async (
        _path: string,
        body: { furnishingItems?: { furnishingItemId: number }[] },
      ) => {
        if (body.furnishingItems !== undefined)
          storedIds = body.furnishingItems.map((item) => item.furnishingItemId);
        return { id: 7 };
      },
    ),
  };
  const service = new PropertiesService(
    siteApi as unknown as SiteApiService,
    {} as PermissionsService,
    {} as DataSource,
  );
  return { service, siteApi };
}

describe('Property furnishing selections through CRM validation and updates', () => {
  it('keeps furnishing IDs in create requests instead of stripping them', async () => {
    const dto: unknown = await pipe.transform(
      {
        title: 'Apartment',
        listingType: 'Sell',
        propertyType: 'apartment',
        furnishingItemIds: [2, 5],
      },
      { type: 'body', metatype: CreatePropertyDto },
    );
    expect(dto).toMatchObject({ furnishingItemIds: [2, 5] });
  });

  it('saves selected IDs after validation and returns them when the property is reloaded', async () => {
    const { service, siteApi } = make();
    const updated = await service.update(
      7,
      await validateUpdate({ furnishingItemIds: [2, 5] }),
    );
    expect(siteApi.patch).toHaveBeenCalledWith(
      '/admin/properties/apartment/7',
      expect.objectContaining({
        furnishingItems: [{ furnishingItemId: 2 }, { furnishingItemId: 5 }],
      }),
    );
    expect(updated.furnishingItemIds).toEqual([2, 5]);
    expect((await service.findOne(7)).furnishingItemIds).toEqual([2, 5]);
  });

  it('clears saved items when all selections are unchecked', async () => {
    const { service, siteApi } = make();
    const updated = await service.update(
      7,
      await validateUpdate({ furnishingItemIds: [] }),
    );
    expect(siteApi.patch).toHaveBeenCalledWith(
      '/admin/properties/apartment/7',
      expect.objectContaining({ furnishingItems: [] }),
    );
    expect(updated.furnishingItemIds).toEqual([]);
  });

  it('preserves saved items when a partial update omits furnishing', async () => {
    const { service, siteApi } = make();
    const updated = await service.update(
      7,
      await validateUpdate({ title: 'Updated apartment' }),
    );
    expect(siteApi.patch.mock.calls[0][1]).not.toHaveProperty(
      'furnishingItems',
    );
    expect(updated.furnishingItemIds).toEqual([1]);
  });

  it.each([
    { furnishingItemIds: [-1] },
    { furnishingItemIds: [1.5] },
    { furnishingItemIds: ['invalid'] },
    { furnishingItemIds: '2' },
  ])(
    'rejects malformed furnishing selections: $furnishingItemIds',
    async ({ furnishingItemIds }) => {
      await expect(validateUpdate({ furnishingItemIds })).rejects.toThrow();
    },
  );

  it('treats an optional null list as omitted rather than crashing', async () => {
    const { service, siteApi } = make();
    const updated = await service.update(
      7,
      await validateUpdate({ furnishingItemIds: null }),
    );
    expect(siteApi.patch.mock.calls[0][1]).not.toHaveProperty(
      'furnishingItems',
    );
    expect(updated.furnishingItemIds).toEqual([1]);
  });
});
