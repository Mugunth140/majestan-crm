import { BadRequestException, ValidationPipe } from '@nestjs/common';
import { WebsiteLeadDto } from './website-lead.dto';

// Mirrors the global pipe configured in src/main.ts.
const pipe = new ValidationPipe({ whitelist: true, transform: true });

const run = (payload: Record<string, unknown>) =>
  pipe.transform(payload, { type: 'body', metatype: WebsiteLeadDto }) as Promise<any>;

// Nest 11 flattens validation errors to string[], each prefixed with the
// offending property. Returns null when the payload is accepted.
const captureErrors = async (payload: Record<string, unknown>): Promise<string[] | null> => {
  try {
    await run(payload);
    return null;
  } catch (e) {
    return ((e as BadRequestException).getResponse() as any).message;
  }
};

describe('WebsiteLeadDto whitelist', () => {
  it('keeps every property-link and visit field the public site forwards', async () => {
    const result = await run({
      name: 'Rahul',
      mobile: '9876543210',
      source: 'Website – Property page',
      propertyId: 18,
      propertyCode: 'AP018',
      propertySlug: 'some-villa-ap018',
      intent: 'site_visit',
      visitDate: '2026-10-05',
      visitSlot: '11:00',
    });

    expect(result.propertyId).toBe(18);
    expect(result.propertyCode).toBe('AP018');
    expect(result.propertySlug).toBe('some-villa-ap018');
    expect(result.intent).toBe('site_visit');
    expect(result.visitDate).toBe('2026-10-05');
    expect(result.visitSlot).toBe('11:00');
  });

  it('still enforces the declared constraints on those fields', async () => {
    const errors = await captureErrors({
      name: 'R',
      mobile: '9876543210',
      propertyId: 0,
      propertyCode: 'X'.repeat(65),
      propertySlug: 'y'.repeat(513),
      intent: 'callback',
      visitDate: 'not-a-date',
      visitSlot: '25:99',
    });

    expect(errors).not.toBeNull();
    expect(errors).toEqual(
      expect.arrayContaining([
        expect.stringContaining('propertyId'),
        expect.stringContaining('propertyCode'),
        expect.stringContaining('propertySlug'),
        expect.stringContaining('intent'),
        expect.stringContaining('visitDate'),
        expect.stringContaining('visitSlot'),
      ]),
    );
  });

  // Guards the two tests above from passing vacuously: if an undeclared key
  // survived the pipe, "declared fields survive" would prove nothing.
  it('strips a key the DTO does not declare', async () => {
    const result = await run({
      name: 'Rahul',
      mobile: '9876543210',
      totallyUndeclared: 'should not reach the service',
    });

    expect('totallyUndeclared' in result).toBe(false);
  });
});