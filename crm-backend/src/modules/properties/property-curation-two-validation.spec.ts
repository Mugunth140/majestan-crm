import { BadRequestException, ValidationPipe } from '@nestjs/common';
import {
  PropertyCurationDto,
  PropertyContactDetailsDto,
} from './dto/property-curation.dto';
const pipe = new ValidationPipe({ whitelist: true, transform: true });
const parse = (value: unknown) =>
  pipe.transform(value, { type: 'body', metatype: PropertyCurationDto });
it('preserves structured counts, parking, multi-selects and explicit false', async () => {
  const value = {
    individualBathrooms: 2,
    attachedBathrooms: 1,
    portions: [
      { bhk: '3 BHK', count: 2 },
      { bhk: '2 BHK', count: 1 },
    ],
    parkingSpaces: [{ vehicle: 'Car', type: 'Covered', count: 1 }],
    passengerLifts: 2,
    serviceLifts: 1,
    hasCanteen: false,
    propertyUses: ['Corporate Office', 'Retail Showroom'],
  };
  expect(await parse(value)).toMatchObject(value);
});
it.each([
  { individualBathrooms: -1 },
  { portions: [null] },
  { parkingSpaces: [null] },
  { attachedBathrooms: 1.5 },
  { passengerLifts: -1 },
  { portions: [{ bhk: '3 BHK', count: 0 }] },
  { parkingSpaces: [{ vehicle: 'Truck', type: 'Open', count: 1 }] },
  {
    parkingSpaces: [
      { vehicle: 'Car', type: 'Open', count: 1 },
      { vehicle: 'Car', type: 'Open', count: 2 },
    ],
  },
  { propertyUses: 'Corporate Office' },
])('rejects invalid nested curation data %j', async (value) => {
  await expect(parse(value)).rejects.toBeInstanceOf(BadRequestException);
});
it('strips unknown public specification keys', async () => {
  expect(
    await parse({
      hasCanteen: true,
      ownerPhone: 'synthetic-private',
      arbitrary: 'no',
    }),
  ).toEqual({ hasCanteen: true });
});
it('validates at most two role-based owner alternatives', async () => {
  const parseContact = (value: unknown) =>
    pipe.transform(value, {
      type: 'body',
      metatype: PropertyContactDetailsDto,
    });
  await expect(
    parseContact({
      ownerAlternatives: [
        { role: 'Care Taker', name: 'Synthetic' },
        { role: 'Manager', phone: 'synthetic' },
      ],
      agentPhone: 'synthetic',
      agentAlternative: { email: 'synthetic@example.invalid' },
    }),
  ).resolves.toBeDefined();
  await expect(
    parseContact({ ownerAlternatives: [{}, {}, {}] }),
  ).rejects.toThrow();
  await expect(
    parseContact({ ownerAlternatives: [{ role: 'Unknown role' }] }),
  ).rejects.toThrow();
});
