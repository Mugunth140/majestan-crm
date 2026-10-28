import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { UpdateInboundLocationDto } from './update-inbound-location.dto';
describe('background inbound location validation', () => {
  it('accepts zero and signed coordinates', async () => {
    expect(await validate(plainToInstance(UpdateInboundLocationDto, { latitude: 0, longitude: -76.95 }))).toEqual([]);
  });
  it.each([{}, { latitude: 10 }, { latitude: 91, longitude: 20 }, { latitude: 10, longitude: 181 }, { latitude: '10', longitude: 20 }])('rejects an invalid coordinate pair: %o', async value => {
    expect((await validate(plainToInstance(UpdateInboundLocationDto, value))).length).toBeGreaterThan(0);
  });
});
