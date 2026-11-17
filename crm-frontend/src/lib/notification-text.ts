// How a notification reads and where it leads, shared by the sidebar panel,
// the phone Inbox and the pop-up alert.

export interface NotificationLike {
  title?: string;
  message?: string;
  type?: string;
  entity_id?: number | null;
  entity_type?: string | null;
  lead_id?: number;
}

const ROUTES: Record<string, string> = {
  lead: "leads",
  leads: "leads",
  inbound: "inbound",
  agent: "agent-network",
  hr: "hr",
};

/** Notifications about a page rather than one record. */
const PAGES: Record<string, string> = {
  first_contact_digest: "/leads?waiting=1",
  queue_new: "/lead-routing",
  targets_set: "/tasks",
  pace_alert: "/tasks",
  pace_team: "/tasks",
  lost_leads_digest: "/leads",
};

/** Where a notification leads: its record, its page, or the module list when it covers several records. */
export function notificationHref(n: NotificationLike): string | null {
  if (n.type && PAGES[n.type]) return PAGES[n.type];
  const route = ROUTES[n.entity_type || "lead"];
  const id = n.entity_id || n.lead_id;
  if (id) return route ? `/${route}/${id}` : null;
  // "5 leads were assigned to you": open that module's list.
  return route && n.entity_type ? `/${route}` : null;
}

/** A follow-up reminder's parts, from its "Name · Module · 2:30 PM" message. */
export function reminderParts(n: NotificationLike): { name: string; module: string; time: string } | null {
  if (n.type !== "followup_reminder" || !n.message) return null;
  const [name, module, time] = n.message.split(" · ");
  return name && module && time ? { name, module, time } : null;
}

/** One line for an alert: "Follow-up with Pam Beesly (Lead) is due at 2:30 PM". */
export function notificationSentence(n: NotificationLike): string {
  const r = reminderParts(n);
  if (r) return `Follow-up with ${r.name} (${r.module}) is due at ${r.time}`;
  return n.message || n.title || "";
}
