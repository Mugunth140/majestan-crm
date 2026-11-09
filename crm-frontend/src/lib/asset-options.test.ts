import { describe, expect, it } from 'vitest';
import { fromLayout, lakhs, loPriceText, toLayoutsPayload, toLoPrice, toNumber } from './asset-options';

describe('asset options', () => {
  it('sends every layout column, drops blank rows, and numbers the numbers', () => {
    expect(toLayoutsPayload([
      { layout_no: 'L-12', name: 'Green Meadows', price: '450000', duration: '18 months', no_of_plots: '40' },
      { layout_no: '', name: '', price: '', duration: '', no_of_plots: '' },
    ])).toEqual([{ layout_no: 'L-12', name: 'Green Meadows', price: 450000, duration: '18 months', no_of_plots: 40 }]);
  });

  it('reads saved layouts with decimals tidied', () => {
    expect(fromLayout({ layout_no: 'L-1', name: null, price: '450000.00', duration: null, no_of_plots: 40 }))
      .toEqual({ layout_no: 'L-1', name: '', price: '450000', duration: '', no_of_plots: '40' });
  });

  it('shows the LO price the way it is typed, and reads it back', () => {
    expect(loPriceText('8000000.00')).toBe('80 L');
    expect(toLoPrice(loPriceText('8000000.00'))).toBe(8000000);
    expect(toLoPrice('1.2Cr')).toBe(12000000);
    expect(toLoPrice('  ')).toBeNull();
  });

  it('formats lakhs and empty numbers', () => {
    expect(lakhs('120.00')).toBe('120 Lakhs');
    expect(lakhs(null)).toBeNull();
    expect(toNumber('')).toBeNull();
    expect(toNumber('2.5')).toBe(2.5);
  });
});
