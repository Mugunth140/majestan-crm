// lead-routing.test.ts
import { describe, expect, it } from 'vitest';
import { canTakeLeadFromQueue, canConvertEnquiry } from './lead-routing';

describe('canTakeLeadFromQueue', () => {
  it.each(['Staff', 'Team Lead', 'Manager'])('allows %s to take leads from the queue', (role) => {
    expect(canTakeLeadFromQueue(role)).toBe(true);
  });

  it.each(['Admin', 'Super Admin', '', undefined])('denies %s self-claim from the queue', (role) => {
    expect(canTakeLeadFromQueue(role)).toBe(false);
  });
});

describe('canConvertEnquiry', () => {
  it.each(['Staff', 'Team Lead', 'Manager', 'Admin'])('allows %s to convert enquiries', (role) => {
    expect(canConvertEnquiry(role)).toBe(true);
  });

  it.each(['', undefined, 'Viewer', 'Super Admin'])('denies %s from converting enquiries', (role) => {
    expect(canConvertEnquiry(role)).toBe(false);
  });
});
