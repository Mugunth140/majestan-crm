import { Lead } from '../../../database/entities/lead.entity';
import { LeadInquiry } from '../../../database/entities/lead-inquiry.entity';
import { User } from '../../../database/entities/user.entity';
import { defineMailEntity, type MailContext } from '../../mail/core/mail-event';
import { button, detailsCard, link, mapsUrl } from '../../mail/render/blocks';
import { COMPANY } from '../../mail/render/layout';
import { formatLongDate, formatTime, toDateOnly, toTimeOnly } from '../../hr/mail/candidate-mail-data';

export interface LeadProject {
  name: string;
  url: string | null;
  brochureUrl: string | null;
  address: string | null;
  mapsUrl: string | null;
}

/** What sales@ emails may show. Never commission, referral or internal notes. */
export interface LeadMailData {
  id: number;
  name: string;
  email: string | null;
  status: string;
  advisor: { name: string; phone: string | null } | null;
  /** Project from the website, matched by the enquiry's link or name. */
  project: LeadProject | null;
  /** Free-text project name from the enquiry when no website project matched. */
  projectText: string | null;
  propertyUrl: string | null;
  visit: { date: string; time: string | null; location: string | null } | null;
}

const WEBSITE = 'https://www.majestanrealty.com';
const SLUG = /^[a-z0-9][a-z0-9-]{0,200}$/;

function cdnUrl(key: string | null | undefined): string | null {
  if (!key) return null;
  if (/^https?:\/\//.test(key)) return key;
  if (key.startsWith('local')) return null; // stored on the site server, not public
  const base = (process.env.R2_PUBLIC_URL || 'https://cdn.majestanrealty.com').replace(/\/$/, '');
  return `${base}/${key.replace(/^\//, '')}`;
}

/** The website's projects live in the site database on the same MySQL server. */
async function findProject(ctx: MailContext, slug: string | null, name: string | null): Promise<LeadProject | null> {
  const db = (process.env.SITE_DB_NAME || 'majestan').replace(/[^a-zA-Z0-9_]/g, '');
  if (!slug && !name) return null;
  const rows: any[] = await ctx.dataSource.query(
    `SELECT name, canonical_slug, brochure_key, address, sublocation, city, latitude, longitude
       FROM \`${db}\`.projects
      WHERE status IN ('published', 'booked') AND (slug = ? OR canonical_slug = ? OR LOWER(name) = LOWER(?))
      ORDER BY (slug = ? OR canonical_slug = ?) DESC
      LIMIT 1`,
    [slug ?? '', slug ?? '', name ?? '', slug ?? '', slug ?? ''],
  );
  const p = rows[0];
  if (!p) return null;
  const address = [p.address, p.sublocation, p.city].map((v: string | null) => v?.trim()).filter(Boolean).join(', ') || null;
  const coordinates = p.latitude && p.longitude && Number(p.latitude) !== 0 ? `${p.latitude},${p.longitude}` : null;
  return {
    name: p.name,
    url: SLUG.test(p.canonical_slug ?? '') ? `${WEBSITE}/${p.canonical_slug}` : null,
    brochureUrl: cdnUrl(p.brochure_key),
    address,
    mapsUrl: mapsUrl(coordinates ?? address),
  };
}

export async function loadLeadMailData(id: number, ctx: MailContext): Promise<LeadMailData | null> {
  const lead = await ctx.dataSource.getRepository(Lead).findOne({ where: { id } });
  if (!lead) return null;
  const inquiries = await ctx.dataSource.getRepository(LeadInquiry).find({ where: { lead_id: id }, order: { id: 'DESC' }, take: 10 });
  const latest = inquiries[0] ?? null;
  const visited = inquiries.find((i) => i.visit_date) ?? null;
  const advisor = lead.assigned_staff_id
    ? await ctx.dataSource.getRepository(User).findOne({ where: { id: lead.assigned_staff_id }, select: { id: true, name: true, phone: true } })
    : null;
  const source = visited ?? latest;
  const slug = source?.property_slug && SLUG.test(source.property_slug) ? source.property_slug : null;
  const projectText = source?.project_list?.trim() || null;
  const date = toDateOnly(visited?.visit_date ?? null);
  return {
    id: lead.id,
    name: (lead.name || '').trim(),
    email: lead.email?.trim() || null,
    status: lead.status,
    advisor: advisor ? { name: advisor.name, phone: advisor.phone ?? null } : null,
    project: await findProject(ctx, slug, projectText),
    projectText,
    propertyUrl: slug ? `${WEBSITE}/${slug}` : null,
    visit: date ? { date, time: toTimeOnly(visited?.visit_slot ?? null), location: visited?.visit_location?.trim() || null } : null,
  };
}

const projectTitle = (d: LeadMailData) => d.project?.name ?? d.projectText ?? null;

/** Leads: the record behind every sales@ email. */
export const leadMailEntity = defineMailEntity<LeadMailData>({
  entityType: 'lead',
  module: 'sales',
  contactLog: { table: 'contact_logs', column: 'lead_id' },
  identity: 'sales',
  label: 'Lead',
  load: loadLeadMailData,
  recipients: (d) => ({ to: [d.email ?? ''] }),
  variables: (d) => {
    const title = projectTitle(d);
    const when = d.visit ? formatLongDate(d.visit.date) : null;
    const time = d.visit?.time ? `${formatTime(d.visit.time)} (IST)` : null;
    const meetAt = d.visit?.location ?? d.project?.address ?? null;
    const directions = d.visit?.location ? mapsUrl(d.visit.location) : (d.project?.mapsUrl ?? null);
    const pageUrl = d.project?.url ?? d.propertyUrl;
    const advisorName = d.advisor?.name ?? 'Our property advisor';
    const advisorPhone = d.advisor?.phone ?? COMPANY.phone;
    return {
      'lead.name': d.name,
      'lead.first_name': d.name.split(/\s+/)[0] || d.name,
      'project.name': title ?? '',
      'project.title': title ?? COMPANY.name,
      'project.interest': title ? `your interest in ${title}` : 'your interest in our properties',
      'project.url': pageUrl ?? '',
      'project.location': d.project?.address ?? '',
      'visit.date': when ?? '',
      'visit.time': time ?? '',
      'visit.location': meetAt ?? '',
      'advisor.name': advisorName,
      'advisor.phone': advisorPhone,
      visit_details: detailsCard([
        ['Project', title ? (pageUrl ? link(title, pageUrl) : title) : null],
        ['Date', when],
        ['Time', time],
        ['Meeting point', meetAt],
        ['Your advisor', d.advisor ? `${d.advisor.name}${d.advisor.phone ? ` · ${d.advisor.phone}` : ''}` : null],
      ]),
      map_button: button('Open in Google Maps', directions),
      project_button: button(title ? `View ${title}` : 'View property', pageUrl),
      brochure_button: button('Download brochure', d.project?.brochureUrl),
    };
  },
  variableDocs: [
    { key: 'lead.name', label: 'Customer full name', sample: 'Karthik Subramanian' },
    { key: 'lead.first_name', label: 'Customer first name', sample: 'Karthik' },
    { key: 'project.name', label: 'Project name (blank if unknown)', sample: 'Emerald Heights' },
    { key: 'project.title', label: 'Project name, or "Majestan Realty"', sample: 'Emerald Heights' },
    { key: 'project.interest', label: '"your interest in …" phrase', sample: 'your interest in Emerald Heights' },
    { key: 'project.url', label: 'Project page link', sample: 'https://www.majestanrealty.com/emerald-heights-coimbatore-pa0006' },
    { key: 'project.location', label: 'Project address', sample: 'Kgisl Campus, Saravanampatti, Coimbatore' },
    { key: 'visit.date', label: 'Site visit date', sample: 'Saturday, 7 November 2026' },
    { key: 'visit.time', label: 'Site visit time', sample: '10:30 AM (IST)' },
    { key: 'visit.location', label: 'Meeting point', sample: 'Emerald Heights site office' },
    { key: 'advisor.name', label: 'Assigned advisor name', sample: 'Priya Raman' },
    { key: 'advisor.phone', label: 'Assigned advisor phone', sample: '+91 98765 43210' },
    { key: 'visit_details', label: 'Site visit details card', sample: '[project, date, time, meeting point, advisor]', block: true },
    { key: 'map_button', label: 'Directions button', sample: '[Open in Google Maps]', block: true },
    { key: 'project_button', label: 'Project page button', sample: '[View Emerald Heights]', block: true },
    { key: 'brochure_button', label: 'Brochure download button', sample: '[Download brochure]', block: true },
  ],
});
