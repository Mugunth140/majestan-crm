import type { Inbound } from '../../database/entities/inbound.entity';

// The availability staff set on an inbound decides where it goes next:
//   available            → the inbound Queue (unless someone already has it)
//   fixed_verification   → Routing › Verification Queue, out of the inbound Queue
//   not_available        → Closed
//   verification_done    → Closed

export const INBOUND_AVAILABILITY = ['available', 'not_available', 'fixed_verification', 'verification_done'] as const;
export type InboundAvailability = (typeof INBOUND_AVAILABILITY)[number];

const CLOSED = 'Closed';
const REOPENED = 'New Inbound';

/** Fields to set when an inbound's availability becomes `next`. */
export function availabilityRoute(
  next: string | null | undefined,
  current: { status?: string | null; assigned_staff_id?: number | null },
): Partial<Pick<Inbound, 'status' | 'is_queued'>> {
  const reopen = current.status === CLOSED ? { status: REOPENED } : {};
  switch (next) {
    case 'available':
      return { ...reopen, is_queued: !current.assigned_staff_id };
    case 'fixed_verification':
      return { ...reopen, is_queued: false };
    case 'not_available':
    case 'verification_done':
      return { status: CLOSED, is_queued: false };
    default:
      return {};
  }
}

/** Sourcing staff work the Verification Queue. */
export const isSourcingDepartment = (name?: string | null) => /sourcing/i.test(name ?? '');
