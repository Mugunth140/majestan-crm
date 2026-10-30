import { describe, expect, it } from 'vitest';
import { formatProjectArea } from './project-area';

describe('project detail area', () => {
  it('shows an area entered as 2.24 acres in acres after sqft storage', () => {
    expect(formatProjectArea(Math.round(2.24 * 43560 * 100) / 100)).toBe('2.24 acres');
    expect(formatProjectArea('97574.40')).toBe('2.24 acres');
  });
  it('handles one acre and larger projects', () => {
    expect(formatProjectArea(43560)).toBe('1 acre');
    expect(formatProjectArea(87120)).toBe('2 acres');
  });
  it('keeps smaller areas in square feet without labeling them as cents', () => {
    expect(formatProjectArea(2400)).toBe('2,400 sqft');
    expect(formatProjectArea(17424)).toBe('17,424 sqft');
  });
  it.each([null, undefined, '', 'bad', 0, -10, Infinity])('omits invalid or absent area %s', (value) => {
    expect(formatProjectArea(value)).toBeUndefined();
  });
});
