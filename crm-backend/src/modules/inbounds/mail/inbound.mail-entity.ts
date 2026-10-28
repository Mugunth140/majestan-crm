import { Inbound } from '../../../database/entities/inbound.entity';
import { User } from '../../../database/entities/user.entity';
import { defineMailEntity, type MailContext } from '../../mail/core/mail-event';
import { detailsCard } from '../../mail/render/blocks';
import { COMPANY } from '../../mail/render/layout';

/**
 * What listings@ emails may show the property owner: their own property and
 * our contact. Never brokerage terms, other contacts or internal notes.
 */
export interface InboundMailData {
  id: number;
  reference: string;
  ownerName: string;
  email: string | null;
  status: string;
  /** available | not_available | fixed_verification | null */
  availability: string | null;
  property: string;
  purpose: string | null;
  location: string | null;
  price: string | null;
  advisor: { name: string; phone: string | null } | null;
  createdAt: Date;
}

/** "training_centre" → "Training Centre"; values are stored as form slugs or labels. */
export function humanize(value: string | null | undefined): string {
  return (value ?? '')
    .replace(/[_-]+/g, ' ')
    .trim()
    .replace(/\s+/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

const rupees = (value: number | string | null | undefined): string | null => {
  const n = Number(value);
  return value !== null && value !== undefined && value !== '' && Number.isFinite(n) && n > 0
    ? `₹${new Intl.NumberFormat('en-IN', { maximumFractionDigits: 0 }).format(n)}`
    : null;
};

/** "3 BHK Apartment", or the title the owner gave it. */
export function propertyLabel(i: Pick<Inbound, 'property_title' | 'bhk' | 'property_type' | 'property_category'>): string {
  const title = i.property_title?.trim();
  if (title) return title;
  const type = humanize(i.property_type) || humanize(i.property_category);
  const bhk = i.bhk?.trim() ? `${i.bhk.trim().replace(/\s*bhk$/i, '')} BHK` : '';
  return [bhk, type].filter(Boolean).join(' ') || 'your property';
}

export function askingPrice(i: Pick<Inbound, 'purpose' | 'sale_price' | 'total_rent'>): string | null {
  const isSale = /sale/i.test(i.purpose ?? '');
  if (isSale) return rupees(i.sale_price);
  const rent = rupees(i.total_rent);
  return rent ? `${rent} per month` : rupees(i.sale_price);
}

export async function loadInboundMailData(id: number, ctx: MailContext): Promise<InboundMailData | null> {
  const i = await ctx.dataSource.getRepository(Inbound).findOne({ where: { id } });
  if (!i) return null;
  const advisor = i.assigned_staff_id
    ? await ctx.dataSource.getRepository(User).findOne({ where: { id: i.assigned_staff_id }, select: { id: true, name: true, phone: true } })
    : null;
  const place = [i.locality, i.area, i.city].map((v) => v?.trim()).filter(Boolean);
  return {
    id: i.id,
    reference: i.property_id || `I${String(i.id).padStart(5, '0')}`,
    ownerName: (i.owner_name || '').trim(),
    email: i.email?.trim() || null,
    status: i.status,
    availability: i.inbound_status ?? null,
    property: propertyLabel(i),
    purpose: i.purpose?.trim() || null,
    location: [...new Set(place)].join(', ') || null,
    price: askingPrice(i),
    advisor: advisor ? { name: advisor.name, phone: advisor.phone ?? null } : null,
    createdAt: i.created_at,
  };
}

/** Inbounds (properties offered by owners): the record behind every listings@ email. */
export const inboundMailEntity = defineMailEntity<InboundMailData>({
  entityType: 'inbound',
  module: 'listings',
  identity: 'listings',
  label: 'Inbound',
  load: loadInboundMailData,
  recipients: (d) => ({ to: [d.email ?? ''] }),
  variables: (d) => {
    const owner = d.ownerName || 'Property owner';
    const purpose = d.purpose ? (/sale/i.test(d.purpose) ? 'For sale' : `For ${d.purpose.toLowerCase()}`) : null;
    return {
      'owner.name': owner,
      'owner.first_name': d.ownerName ? d.ownerName.split(/\s+/)[0] : 'Sir/Madam',
      'listing.reference': d.reference,
      'listing.property': d.property,
      'listing.purpose': purpose ?? '',
      'listing.location': d.location ?? '',
      'listing.price': d.price ?? '',
      'advisor.name': d.advisor?.name ?? 'Our listings team',
      'advisor.phone': d.advisor?.phone ?? COMPANY.phone,
      listing_details: detailsCard([
        ['Reference', d.reference],
        ['Property', d.property],
        ['Purpose', purpose],
        ['Location', d.location],
        [/sale/i.test(d.purpose ?? '') ? 'Asking price' : 'Expected rent', d.price],
        ['Your contact', d.advisor ? `${d.advisor.name}${d.advisor.phone ? ` · ${d.advisor.phone}` : ''}` : null],
      ]),
    };
  },
  variableDocs: [
    { key: 'owner.name', label: 'Owner full name', sample: 'Lakshmi Narayanan' },
    { key: 'owner.first_name', label: 'Owner first name (or "Sir/Madam")', sample: 'Lakshmi' },
    { key: 'listing.reference', label: 'Property reference', sample: 'I00042' },
    { key: 'listing.property', label: 'Property, e.g. "3 BHK Apartment"', sample: '3 BHK Apartment' },
    { key: 'listing.purpose', label: '"For sale" / "For rent"', sample: 'For rent' },
    { key: 'listing.location', label: 'Locality, area and city', sample: 'Saravanampatti, Coimbatore' },
    { key: 'listing.price', label: 'Asking price or expected rent', sample: '₹25,000 per month' },
    { key: 'advisor.name', label: 'Assigned staff name', sample: 'Priya Raman' },
    { key: 'advisor.phone', label: 'Assigned staff phone', sample: '+91 98765 43210' },
    { key: 'listing_details', label: 'Property details card', sample: '[reference, property, purpose, location, price, contact]', block: true },
  ],
});
