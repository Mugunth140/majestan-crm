import { describe, expect, it } from 'vitest';
import { coordinateErrors } from './property-coordinates';

describe('Property form coordinate validation', () => {
  it.each([['', ''], ['0', '0'], ['-90', '180'], ['90', '-180'], ['13.0827', '80.2707']])('allows valid or optional coordinates %s,%s', (lat, lng) => {
    expect(coordinateErrors(lat, lng)).toEqual([]);
  });
  it.each([['13000', '80', 'latitude'], ['13', '80000', 'longitude'], ['-90.1', '80', 'latitude'], ['13', '180.1', 'longitude'], ['13north', '80', 'latitude'], ['Infinity', '80', 'latitude']])('identifies the invalid %s,%s field', (lat, lng, field) => {
    expect(coordinateErrors(lat, lng)).toEqual([expect.objectContaining({ field })]);
  });
});
