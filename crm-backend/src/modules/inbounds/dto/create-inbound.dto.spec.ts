import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { CreateInboundDto } from './create-inbound.dto';
import { UpdateInboundDto } from './update-inbound.dto';

// Mirrors the global pipe in main.ts: whitelist + transform.
async function pipeValidate(dtoClass: any, payload: any) {
  const dto = plainToInstance(dtoClass, payload);
  return validate(dto as object, { whitelist: true });
}

// Realistic payload as built by inbound/new/page.tsx handleSubmit for a
// Staff user creating a Rent apartment inbound. Untouched controlled
// selects arrive as null; advance arrives as a number for Rent.
function staffRentPayload(assignedStaffId: any) {
  return {
    property_title: '2 BHK Apartment in Saibaba Colony',
    property_category: 'residential',
    property_type: 'apartment',
    purpose: 'Rent',
    special_purpose: null,
    locality: 'Saibaba Colony',
    bhk: '2',
    advance: 3,
    total_rent: 15000,
    rent_per_sqft: 12.5,
    floor_number: null,
    status: 'New Inbound',
    state: 'Tamil Nadu',
    city: 'Coimbatore',
    area: '1200 sqft',
    landmark: '',
    google_map_location: null,
    owner_name: 'Ravi Kumar',
    mobile_number: '+91 98765 43210',
    whatsapp_number: '',
    email: '',
    alternate_contact: '',
    address: '',
    preferred_contact_time: null,
    pan_available: false,
    gst_applicable: false,
    primary_contact: 'Owner',
    key_available_with: 'Owner',
    brokerage_accepted: 'Yes',
    brokerage_paid_by: ['Owner', 'Tenant'],
    brokerage_type: 'Percentage',
    percentage: 2,
    fixed_amount: null,
    brokerage_days: null,
    brokerage_remarks: '',
    prior_appointment_required: false,
    is_exclusive: false,
    is_prime_location: false,
    documents_collected: false,
    assigned_staff_id: assignedStaffId,
  };
}

describe('CreateInboundDto (inbound form contract)', () => {
  it('accepts free-text alternative contact on create and edit without changing the alternate number', async () => {
    for (const dtoClass of [CreateInboundDto, UpdateInboundDto]) {
      const dto = plainToInstance(dtoClass, { property_category: 'commercial', mobile_number: '9876543210',
        alternate_contact: '8765432109', alternative_contact: '  Kavya, owner’s sister — call after 6 pm  ' });
      expect(await validate(dto, { whitelist: true })).toEqual([]);
      expect(dto.alternative_contact).toBe('Kavya, owner’s sister — call after 6 pm');
      expect(dto.alternate_contact).toBe('8765432109');
    }
  });
  it.each([null, ''])('allows clearing the optional alternative contact: %s', async alternative_contact => {
    expect(await pipeValidate(UpdateInboundDto, { alternative_contact })).toEqual([]);
  });
  it.each([123, {}, 'x'.repeat(1001)])('rejects invalid alternative contact values', async alternative_contact => {
    expect((await pipeValidate(UpdateInboundDto, { alternative_contact })).some(error => error.property === 'alternative_contact')).toBe(true);
  });

  it.each(['available', 'not_available', 'fixed_verification'])('accepts inbound status %s and an alternate contact', async (inbound_status) => {
    const dto = plainToInstance(CreateInboundDto, { property_category: 'commercial', mobile_number: '9876543210', inbound_status, alternate_contact: '8765432109' });
    expect(await validate(dto, { whitelist: true })).toEqual([]);
    expect(dto.inbound_status).toBe(inbound_status);
    expect(dto.alternate_contact).toBe('8765432109');
  });
  it('rejects an unknown inbound status', async () => {
    const errors = await pipeValidate(CreateInboundDto, { property_category: 'commercial', mobile_number: '9876543210', inbound_status: 'invalid' });
    expect(errors.some(error => error.property === 'inbound_status')).toBe(true);
  });

  it.each([undefined, null, '', '   '])('requires a category on new submissions: %s', async (property_category) => {
    const errors = await pipeValidate(CreateInboundDto, { property_category, mobile_number: '9876543210' });
    expect(errors.some(e => e.property === 'property_category')).toBe(true);
  });

  it.each([undefined, '', '   ', '123', 'abcdefghij', '1234567890123456'])('requires a valid mobile number: %s', async (mobile_number) => {
    const errors = await pipeValidate(CreateInboundDto, { property_category: 'commercial', mobile_number });
    expect(errors.some(e => e.property === 'mobile_number')).toBe(true);
  });
  it('allows the same mobile number on multiple submissions', async () => {
    const payload = { property_category: 'commercial', mobile_number: '+91 98765 43210' };
    expect(await pipeValidate(CreateInboundDto, payload)).toEqual([]);
    expect(await pipeValidate(CreateInboundDto, payload)).toEqual([]);
  });

  it.each([
    { property_category: 'commercial' },
    { property_category: 'industrial', latitude: null, longitude: null },
    { property_category: 'residential', latitude: 0, longitude: 0 },
    { property_category: 'agricultural', latitude: -33.86, longitude: 151.2 },
  ])('accepts quick capture with optional coordinates: %o', async (payload) => {
    expect(await pipeValidate(CreateInboundDto, { mobile_number: '9876543210', ...payload })).toEqual([]);
  });

  it.each([
    { latitude: 91 }, { latitude: -91 }, { longitude: 181 },
    { longitude: -181 }, { latitude: 'invalid' }, { longitude: Infinity },
  ])('rejects invalid coordinates on create and update: %o', async (payload) => {
    expect((await pipeValidate(CreateInboundDto, payload)).length).toBeGreaterThan(0);
    expect((await pipeValidate(UpdateInboundDto, payload)).length).toBeGreaterThan(0);
  });

  it('accepts a full Staff Rent payload with string staff id', async () => {
    const payload = staffRentPayload('7');
    const errors = await pipeValidate(CreateInboundDto, payload);
    expect(errors).toEqual([]);
    // Rent advance arrives as months (number) — normalized to varchar.
    const dto: any = plainToInstance(CreateInboundDto, payload);
    expect(dto.advance).toEqual('3');
  });

  it('accepts a full Staff Rent payload with numeric staff id', async () => {
    const errors = await pipeValidate(CreateInboundDto, staffRentPayload(7));
    expect(errors).toEqual([]);
  });

  it('accepts a minimal payload with category and mobile number', async () => {
    const errors = await pipeValidate(CreateInboundDto, { property_category: 'commercial', mobile_number: '+91 98765 43210' });
    expect(errors).toEqual([]);
  });

  it('strips unknown underscore-prefixed form keys instead of failing', async () => {
    const dto: any = plainToInstance(CreateInboundDto, {
      ...staffRentPayload(7),
      _property_category: 'residential',
      _bhk: '2',
    });
    const errors = await validate(dto, { whitelist: true });
    expect(errors).toEqual([]);
    expect(dto._property_category).toBeUndefined();
    expect(dto.property_category).toEqual('residential');
  });

  it('UpdateInboundDto accepts partial payloads', async () => {
    const errors = await pipeValidate(UpdateInboundDto, { status: 'Approved' });
    expect(errors).toEqual([]);
  });

  it('accepts per-floor unit rows', async () => {
    const errors = await pipeValidate(CreateInboundDto, {
      ...staffRentPayload(7),
      property_category: 'commercial',
      property_type: 'shop',
      units: [
        { floor_label: 'Ground Floor', area: '1200 sqft', price: 80000, notes: 'Main road facing' },
        { floor_label: 'First Floor', area: '1000 sqft', price: 70000 },
      ],
    });
    expect(errors).toEqual([]);
  });

  it('rejects unit rows with a non-numeric price', async () => {
    const errors = await pipeValidate(CreateInboundDto, {
      mobile_number: '+91 98765 43210',
      units: [{ floor_label: 'Ground Floor', price: 'not-a-number' }],
    });
    expect(errors.some((e) => e.property === 'units')).toBe(true);
  });

  it('accepts a residential sale payload with a numeric sale_price', async () => {
    const errors = await pipeValidate(CreateInboundDto, {
      ...staffRentPayload(7),
      purpose: 'Sale',
      sale_price: 8500000,
    });
    expect(errors).toEqual([]);
  });

  it('rejects a non-numeric sale_price', async () => {
    const errors = await pipeValidate(CreateInboundDto, {
      mobile_number: '+91 98765 43210',
      sale_price: 'eighty-five lakhs',
    });
    expect(errors.some((e) => e.property === 'sale_price')).toBe(true);
  });
});
