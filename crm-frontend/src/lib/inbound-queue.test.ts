import { describe, expect, it } from 'vitest';
import { formatInboundCreated, matchesInboundSearch } from './inbound-queue';
describe('Inbound Queue display and search', () => {
  it.each([['2026-10-02T12:00:00Z', '2nd Oct 5:30 pm'], ['2026-10-11T00:00:00Z','11th Oct 5:30 am'],['2026-10-21T00:00:00Z','21st Oct 5:30 am']])('formats India dates with ordinal days', (date, label) => {
    expect(formatInboundCreated(date)).toBe(label);
  });
  it('handles missing or invalid dates', () => { expect(formatInboundCreated()).toBe('—'); expect(formatInboundCreated('bad')).toBe('—'); });
  it('searches normalized phone numbers and alternate numbers', () => {
    expect(matchesInboundSearch({mobile_number:'+91 98765 43210'},'9876543210')).toBe(true);
    expect(matchesInboundSearch({alternate_contact:'8765432109'},'87654')).toBe(true);
    expect(matchesInboundSearch({},'9876543210')).toBe(false);
  });
  it('retains ID, type and title search', () => {
    expect(matchesInboundSearch({property_id:'I00001'},'i00001')).toBe(true);
    expect(matchesInboundSearch({property_title:'Coimbatore Office'},'office')).toBe(true);
  });
});
