import { availabilityRoute, isSourcingDepartment } from './inbound-availability';

describe('inbound availability routing', () => {
  it('queues available inbounds nobody has picked up', () => {
    expect(availabilityRoute('available', { status: 'New Inbound', assigned_staff_id: null })).toEqual({ is_queued: true });
    expect(availabilityRoute('available', { status: 'Follow Up', assigned_staff_id: 7 })).toEqual({ is_queued: false });
  });

  it('closes inbounds that are not available or already verified', () => {
    for (const next of ['not_available', 'verification_done']) {
      expect(availabilityRoute(next, { status: 'New Inbound', assigned_staff_id: null })).toEqual({ status: 'Closed', is_queued: false });
    }
  });

  it('takes fixed verification out of the inbound Queue', () => {
    expect(availabilityRoute('fixed_verification', { status: 'New Inbound', assigned_staff_id: null })).toEqual({ is_queued: false });
  });

  it('reopens a closed inbound that comes back', () => {
    expect(availabilityRoute('available', { status: 'Closed', assigned_staff_id: null })).toEqual({ status: 'New Inbound', is_queued: true });
    expect(availabilityRoute('fixed_verification', { status: 'Closed' })).toEqual({ status: 'New Inbound', is_queued: false });
  });

  it('leaves the inbound alone without an availability', () => {
    expect(availabilityRoute(null, { status: 'Closed' })).toEqual({});
    expect(availabilityRoute('', { status: 'New Inbound' })).toEqual({});
  });

  it('knows the sourcing department by name', () => {
    expect(isSourcingDepartment('Sourcing Department')).toBe(true);
    expect(isSourcingDepartment('Sales Department')).toBe(false);
    expect(isSourcingDepartment(null)).toBe(false);
  });
});
