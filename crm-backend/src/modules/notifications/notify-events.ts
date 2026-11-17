/**
 * Events other modules emit so the notifications module can tell the right
 * people. Emitting never waits on, or fails because of, a notification.
 */

export type RecordModule = 'lead' | 'inbound' | 'agent' | 'hr';

/** Records changed owner. `from` and `to` are user ids (null = unassigned). */
export const NOTIFY_ASSIGNED = 'notify.assigned';
export interface AssignedEvent {
  module: RecordModule;
  changes: { id: number; from: number | null; to: number | null }[];
  actorId: number | null;
  /** The new owner was already told by the caller (lead routing's own message). */
  newOwnerTold?: boolean;
}

/** Leads that came in again: from an import, the New Lead form or an integration. */
export const NOTIFY_LEAD_REPEAT = 'notify.lead.repeat';
export interface LeadRepeatEvent {
  leads: { id: number; ownerId: number | null }[];
  via: 'import' | 'entry';
  source?: string | null;
  actorId: number | null;
}

/** New, unowned leads or website enquiries waiting in the routing queue. */
export const NOTIFY_QUEUE = 'notify.queue';
export interface QueueEvent {
  leadIds?: number[];
  enquiry?: { label: string; leadId?: number | null };
  source?: string | null;
  actorId: number | null;
}

/** Monthly targets were set or changed for these people. */
export const NOTIFY_TARGETS = 'notify.targets';
export interface TargetsEvent {
  userIds: number[];
  month: string;
  changed: boolean;
  actorId: number | null;
}

/** Statuses a team lead and admins hear about the moment a lead reaches them. */
export const MILESTONE_STATUSES = [
  'Booking Advance',
  'Agreement',
  'Closed Won',
];

/** Statuses that end a lead; team leads get them in the evening summary. */
export const LOST_STATUSES = ['Not Interested', 'Lost', 'Dropped'];
