import 'reflect-metadata';
import { ValidationPipe } from '@nestjs/common';
import { PropertyLocationDataDto } from './create-property.dto';

const pipe = new ValidationPipe({ whitelist: true, transform: true, transformOptions: { enableImplicitConversion: true } });
const parse = (value: unknown) => pipe.transform(value, { type: 'body', metatype: PropertyLocationDataDto });

describe('CRM property coordinates', () => {
  it.each([{ latitude: 0, longitude: 0 }, { latitude: 90, longitude: -180 }, { latitude: -90, longitude: 180 }, { latitude: 13.0827, longitude: 80.2707 }, {}])('accepts valid or omitted coordinates %j', async value => {
    await expect(parse(value)).resolves.toMatchObject(value);
  });
  it.each([{ latitude: 13000 }, { longitude: 80000 }, { latitude: -90.1 }, { longitude: 180.1 }, { latitude: Infinity }, { longitude: NaN }])('rejects invalid coordinates before forwarding %j', async value => {
    await expect(parse(value)).rejects.toThrow();
  });
  it('preserves the address, pincode, and locality metadata through nested DTO whitelisting', async () => {
    const value = { address: 'Example address', pincode: '641004', localityData: { source: 'manual' }, latitude: 11, longitude: 77 };
    await expect(parse(value)).resolves.toMatchObject(value);
  });
});
