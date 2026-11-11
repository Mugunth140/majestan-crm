jest.mock('bun', () => ({
  S3Client: class {}
}), { virtual: true });

import { inquiryProjectId, pickPropertyLink } from './leads.service';

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

describe('project links', () => {
  it('picks a project enquiry, whose project is in preferences', () => {
    const link = pickPropertyLink([
      { id: 1, property_id: 18 },
      { id: 2, property_id: null, preferences: { source: 'project_page', projectId: 131, projectCode: 'PV0131' } },
    ]);
    expect(link).toEqual(expect.objectContaining({ id: 2 }));
    expect(inquiryProjectId(link)).toBe(131);
  });

  it('reads preferences stored as JSON text and ignores ones without a project', () => {
    expect(inquiryProjectId({ preferences: '{"projectId": 7}' })).toBe(7);
    expect(inquiryProjectId({ preferences: { bhk: '2' } })).toBeNull();
    expect(pickPropertyLink([{ id: 3, preferences: { bhk: '2' } }])).toBeNull();
  });
});
