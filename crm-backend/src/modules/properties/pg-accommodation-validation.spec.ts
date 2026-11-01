import { ValidationPipe, BadRequestException } from '@nestjs/common';
import { PropertyCurationDto } from './dto/property-curation.dto';
const pipe = new ValidationPipe({ whitelist: true, transform: true });
const parse = (pgDetails: unknown) =>
  pipe.transform(
    { pgDetails },
    { type: 'body', metatype: PropertyCurationDto },
  );
it('accepts PG counts, optional false flags, services and meal schedules', async () => {
  expect(
    await parse({
      roomType: 'Sharing',
      sharingCount: 3,
      attachedBathroom: false,
      weekdayMeals: ['Breakfast', 'Dinner'],
      services: [
        {
          name: 'Wifi',
          status: 'Available for extra charge',
          chargeType: 'Fixed amount',
          amount: 500,
        },
      ],
    }),
  ).toMatchObject({
    pgDetails: {
      roomType: 'Sharing',
      sharingCount: 3,
      attachedBathroom: false,
    },
  });
});
it.each([
  { roomType: 'Hotel' },
  { availableCapacity: -1 },
  { depositMonths: 31 },
  { noticeMonths: 7 },
  { weekdayMeals: ['Brunch'] },
  { services: [null] },
  { commonFurnishings: [{ item: 'TV', count: -1 }] },
  { roomFurnishings: [null] },
  { attachedBathroom: 'false' },
])('rejects malformed PG refinements %j', async (value) => {
  await expect(parse(value)).rejects.toBeInstanceOf(BadRequestException);
});
it('strips unknown nested fields', async () => {
  expect(
    await parse({
      roomType: 'Private',
      privateContact: 'must not be stored here',
    }),
  ).toEqual({ pgDetails: { roomType: 'Private' } });
});
