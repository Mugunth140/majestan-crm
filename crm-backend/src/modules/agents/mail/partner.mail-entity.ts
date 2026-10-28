import { Agent } from '../../../database/entities/agent.entity';
import { User } from '../../../database/entities/user.entity';
import { defineMailEntity, type MailContext } from '../../mail/core/mail-event';
import { detailsCard } from '../../mail/render/blocks';
import { COMPANY } from '../../mail/render/layout';
import { humanize } from '../../inbounds/mail/inbound.mail-entity';

/** What partners@ emails may show the partner: their own terms and our contact. Never remarks. */
export interface PartnerMailData {
  id: number;
  name: string;
  company: string | null;
  email: string | null;
  status: string;
  partnerType: string | null;
  city: string | null;
  /** e.g. "2% per closed deal"; null when no commission was agreed. */
  commission: string | null;
  manager: { name: string; phone: string | null } | null;
}

/** "2" + percentage → "2%"; "50000" + fixed_amount → "₹50,000"; anything else as typed. */
export function commissionTerms(a: Pick<Agent, 'commission_accepted' | 'commission_type' | 'commission_value'>): string | null {
  const value = String(a.commission_value ?? '').trim();
  if (!a.commission_accepted || !value) return null;
  const n = Number(value.replace(/[,%₹\s]/g, ''));
  if (Number.isFinite(n) && n > 0) {
    if (a.commission_type === 'percentage') return `${n}%`;
    if (a.commission_type === 'fixed_amount') return `₹${new Intl.NumberFormat('en-IN', { maximumFractionDigits: 0 }).format(n)}`;
  }
  return value;
}

export async function loadPartnerMailData(id: number, ctx: MailContext): Promise<PartnerMailData | null> {
  const a = await ctx.dataSource.getRepository(Agent).findOne({ where: { id } });
  if (!a) return null;
  const manager = a.assigned_staff_id
    ? await ctx.dataSource.getRepository(User).findOne({ where: { id: a.assigned_staff_id }, select: { id: true, name: true, phone: true } })
    : null;
  return {
    id: a.id,
    name: (a.name || '').trim(),
    company: a.company_name?.trim() || null,
    email: a.email?.trim() || null,
    status: a.status,
    partnerType: humanize(a.partner_type) || null,
    city: a.city?.trim() || null,
    commission: commissionTerms(a),
    manager: manager ? { name: manager.name, phone: manager.phone ?? null } : null,
  };
}

/** Agent network (brokers, referral partners, builders): the record behind every partners@ email. */
export const partnerMailEntity = defineMailEntity<PartnerMailData>({
  entityType: 'agent',
  module: 'partners',
  identity: 'partners',
  label: 'Partner',
  load: loadPartnerMailData,
  recipients: (d) => ({ to: [d.email ?? ''] }),
  variables: (d) => ({
    'partner.name': d.name || 'Partner',
    'partner.first_name': d.name ? d.name.split(/\s+/)[0] : 'Sir/Madam',
    'partner.company': d.company ?? '',
    'partner.type': d.partnerType ?? '',
    'partner.city': d.city ?? '',
    'partner.commission': d.commission ?? '',
    'manager.name': d.manager?.name ?? 'Our partnerships team',
    'manager.phone': d.manager?.phone ?? COMPANY.phone,
    partner_details: detailsCard([
      ['Partner', d.company ? `${d.name} · ${d.company}` : d.name],
      ['Partner type', d.partnerType],
      ['City', d.city],
      ['Commission', d.commission],
      ['Your contact', d.manager ? `${d.manager.name}${d.manager.phone ? ` · ${d.manager.phone}` : ''}` : null],
    ]),
  }),
  variableDocs: [
    { key: 'partner.name', label: 'Partner full name', sample: 'Suresh Babu' },
    { key: 'partner.first_name', label: 'Partner first name (or "Sir/Madam")', sample: 'Suresh' },
    { key: 'partner.company', label: 'Company name', sample: 'SB Realtors' },
    { key: 'partner.type', label: 'Partner type', sample: 'Individual Broker' },
    { key: 'partner.city', label: 'City', sample: 'Coimbatore' },
    { key: 'partner.commission', label: 'Agreed commission (blank if none)', sample: '2%' },
    { key: 'manager.name', label: 'Assigned staff name', sample: 'Priya Raman' },
    { key: 'manager.phone', label: 'Assigned staff phone', sample: '+91 98765 43210' },
    { key: 'partner_details', label: 'Partner details card', sample: '[partner, type, city, commission, contact]', block: true },
  ],
});
