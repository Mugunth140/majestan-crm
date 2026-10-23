/**
 * Website lead sources that wait in the enquiry queue (website_enquiry_events)
 * for staff to convert, attach or acknowledge, instead of creating a lead
 * straight away. Labels must match what the site backend sends exactly,
 * en dash included (site: leads.service.ts ENQUIRY_SOURCE_LABELS).
 *
 * The WhatsApp popup is deliberately not here: it still creates a lead
 * directly.
 */
export const PROJECT_PAGE_SOURCE = 'Website – Project page';
export const PROPERTY_PAGE_SOURCE = 'Website – Property page';

export const QUEUED_WEBSITE_SOURCES: ReadonlySet<string> = new Set([
  PROPERTY_PAGE_SOURCE,
  PROJECT_PAGE_SOURCE,
  'Website – Liaisoning page',
  'Website – Property Management page',
  'Website – Brokerage page',
  'Website – NRI Services page',
  'Website – Financial Assistance page',
  'Website – Contact page',
  'Website – Enquiry form',
]);

export function isQueuedWebsiteSource(source: unknown): source is string {
  return typeof source === 'string' && QUEUED_WEBSITE_SOURCES.has(source);
}
