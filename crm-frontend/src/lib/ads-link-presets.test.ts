import { describe, expect, it } from 'vitest';
import { getPlacement } from './ads-link-presets';

describe('listing advertisement creative sizes', () => {
  it('guides desktop and mobile uploads to the website listing ratios', () => {
    const listing = getPlacement('listing_feed');
    expect(listing.desktop.ratio).toEqual([3, 1]);
    expect(listing.desktop.example).toBe('1800×600');
    expect(listing.mobile?.ratio).toEqual([4, 5]);
    expect(listing.mobile?.example).toBe('1080×1350');
    expect(listing.mobile?.required).toBe(false);
  });
});
