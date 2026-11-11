import { Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';

export type WebsiteUserLead = { id: number; displayId: string; status: string; staff: string | null };
export type WebsiteUser = {
  id: number;
  name: string | null;
  email: string | null;
  phone: string | null;
  verified: boolean;
  registeredAt: string;
  wishlistCount: number;
  enquiryCount: number;
  lastEnquiryAt: string | null;
  lead: WebsiteUserLead | null;
};
export type WebsiteUserQuery = { search?: string; lead?: string; page?: number; limit?: number };

/** The last 10 digits: how a website phone and a CRM mobile are compared. */
export const phoneKey = (v: unknown) => String(v ?? '').replace(/\D/g, '').slice(-10);

/**
 * People who registered on the website (not admins), each with the CRM lead
 * that has the same mobile. The site has tens to low thousands of accounts,
 * so the list is joined and filtered in memory, then paged.
 */
@Injectable()
export class WebsiteUsersService {
  constructor(
    @InjectDataSource() private readonly crm: DataSource,
    @InjectDataSource('site') private readonly site: DataSource,
  ) {}

  async list(query: WebsiteUserQuery) {
    const page = Math.max(1, Number(query.page) || 1);
    const limit = Math.min(1000, Math.max(1, Number(query.limit) || 25));
    const users = await this.allUsers();

    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const summary = {
      total: users.length,
      leads: users.filter((u) => u.lead).length,
      notLeads: users.filter((u) => !u.lead).length,
      thisMonth: users.filter((u) => new Date(u.registeredAt) >= monthStart).length,
    };

    const needle = String(query.search ?? '').trim().toLowerCase();
    const digits = phoneKey(needle);
    const filtered = users.filter((u) => {
      if (query.lead === 'linked' && !u.lead) return false;
      if (query.lead === 'none' && u.lead) return false;
      if (!needle) return true;
      return [u.name, u.email, u.lead?.displayId].some((v) => v?.toLowerCase().includes(needle))
        || (digits.length >= 3 && phoneKey(u.phone).includes(digits));
    });

    return {
      data: filtered.slice((page - 1) * limit, page * limit),
      meta: { total: filtered.length, page, limit, totalPages: Math.max(1, Math.ceil(filtered.length / limit)) },
      summary,
    };
  }

  private async allUsers(): Promise<WebsiteUser[]> {
    const rows: any[] = await this.site.query(`
      SELECT u.id, u.name, u.email, u.phone, u.is_verified AS verified, u.created_at AS registeredAt,
        (SELECT COUNT(*) FROM wishlists w WHERE w.user_id = u.id) AS wishlistCount,
        (SELECT COUNT(*) FROM leads l WHERE l.user_id = u.id) AS enquiryCount,
        (SELECT MAX(l.created_at) FROM leads l WHERE l.user_id = u.id) AS lastEnquiryAt
      FROM users u
      WHERE u.role <> 'admin'
      ORDER BY u.created_at DESC, u.id DESC`);

    const keys = [...new Set(rows.map((r) => phoneKey(r.phone)).filter((k) => k.length === 10))];
    const leads = new Map<string, WebsiteUserLead>();
    if (keys.length) {
      const found: any[] = await this.crm.query(`
        SELECT l.id, l.status, s.name AS staff, RIGHT(REGEXP_REPLACE(l.mobile_number, '[^0-9]', ''), 10) AS mkey
        FROM leads l LEFT JOIN users s ON s.id = l.assigned_staff_id
        WHERE RIGHT(REGEXP_REPLACE(l.mobile_number, '[^0-9]', ''), 10) IN (?)
        ORDER BY l.id DESC`, [keys]);
      // Newest lead wins when a number has more than one.
      for (const f of found) if (!leads.has(f.mkey)) {
        leads.set(f.mkey, { id: Number(f.id), displayId: `L${String(f.id).padStart(5, '0')}`, status: f.status ?? 'New Lead', staff: f.staff ?? null });
      }
    }

    return rows.map((r) => ({
      id: Number(r.id),
      name: r.name || null,
      email: r.email || null,
      phone: r.phone || null,
      verified: Boolean(Number(r.verified)),
      registeredAt: new Date(r.registeredAt).toISOString(),
      wishlistCount: Number(r.wishlistCount) || 0,
      enquiryCount: Number(r.enquiryCount) || 0,
      lastEnquiryAt: r.lastEnquiryAt ? new Date(r.lastEnquiryAt).toISOString() : null,
      lead: leads.get(phoneKey(r.phone)) ?? null,
    }));
  }
}
