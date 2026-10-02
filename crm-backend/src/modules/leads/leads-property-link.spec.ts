jest.mock('bun', () => ({
  S3Client: class {}
}), { virtual: true });

import { pickPropertyLink } from './leads.service';

describe('pickPropertyLink', () => {
  it('returns null when no inquiry carries a link', () => {
    expect(pickPropertyLink([{ id: 1 }, { id: 2, property_id: null }])).toBeNull();
  });

  it('picks the newest linked inquiry', () => {
    const link = pickPropertyLink([
      { id: 1, property_id: 18, property_code: 'AP018', intent: 'enquiry' },
      { id: 2, property_id: 19, property_code: 'VL009', intent: 'site_visit', visit_date: '2026-10-05', visit_slot: '11:00:00' },
    ]);
    expect(link).toEqual(expect.objectContaining({ property_id: 19 }));
  });
});
