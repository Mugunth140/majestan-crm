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

  it('accepts a minimal payload (mobile only)', async () => {
    const errors = await pipeValidate(CreateInboundDto, { mobile_number: '+91 98765 43210' });
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
});
