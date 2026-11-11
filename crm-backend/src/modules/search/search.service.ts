import { Injectable } from '@nestjs/common';
import { phoneDigits } from './phone-digits';
import { DataSource } from 'typeorm';
import { PermissionsService } from '../permissions/permissions.service';
import type { NavKey } from '../users/nav-access';
import { leadScopeSql } from '../leads/lead-scope';
import { AgentsService } from '../agents/agents.service';
import { InboundsService } from '../inbounds/inbounds.service';
import { AssetsService } from '../assets/assets.service';
import { PropertiesService } from '../properties/properties.service';
import { ProjectsService } from '../projects/projects.service';
import { BuildersService } from '../builders/builders.service';

/** The modules the search looks in, in the order results are shown. */
export const SEARCH_SCOPES = ['leads', 'inbound', 'partners', 'properties', 'projects', 'builders', 'hr', 'assets', 'users'] as const;
export type SearchScope = (typeof SEARCH_SCOPES)[number];

/** The sidebar module that must be on for a user to search a scope. */
const NAV: Record<SearchScope, NavKey> = {
  leads: 'leads',
  inbound: 'inbound',
  partners: 'agent-network',
  properties: 'properties',
  projects: 'projects',
  builders: 'builders',
  hr: 'hr',
  assets: 'asset-inventory',
  users: 'users',
};

export interface SearchHit {
  id: number;
  /** The id as the module shows it: L00025, HRC0012, a property code… */
  code: string;
  title: string;
  /** Short context: phone, status, owner, city… */
  subtitle?: string;
  href: string;
  /** A staff member shown on the row (owner, assignee), for their photo. */
  person?: { id: number | null; name: string } | null;
  avatar?: string | null;
}

export interface SearchGroup {
  scope: SearchScope;
  items: SearchHit[];
}

/** What was typed, read once for every module. */
export interface SearchTerm {
  text: string;
  like: string;
  starts: string;
  /** Digits of a phone number, when the text looks like one. */
  phone: string | null;
  /** A record id, from "25", "#25", "L00025", "HRC0012"… with its letters. */
  id: { prefix: string; value: number } | null;
}

export { phoneDigits };

export function readTerm(q: string): SearchTerm | null {
  const text = q.trim().slice(0, 100);
  if (!text) return null;
  const phone = /^[+\d\s()-]+$/.test(text) ? phoneDigits(text) : null;
  const idMatch = /^([A-Za-z#]{0,4})-?0*(\d{1,9})$/.exec(text);
  const id = idMatch ? { prefix: idMatch[1].replace('#', '').toUpperCase(), value: Number(idMatch[2]) } : null;
  // A single letter matches too much to be useful, unless it is part of an id.
  if (text.length < 2 && !id) return null;
  const escaped = text.replace(/[\\%_]/g, (c) => `\\${c}`);
  return { text, like: `%${escaped}%`, starts: `${escaped}%`, phone, id };
}

const pad = (prefix: string, id: number, width: number) => `${prefix}${String(id).padStart(width, '0')}`;
const join = (...parts: (string | null | undefined)[]) => parts.map((p) => (p ?? '').toString().trim()).filter(Boolean).join(' · ');
const digitsOf = (col: string) => `REGEXP_REPLACE(COALESCE(${col}, ''), '[^0-9]', '')`;

/**
 * One place to find any record across the CRM, for the ⌘K palette. Every
 * module keeps its own rules: a user only finds what its list would show them,
 * and only in modules turned on in their sidebar.
 */
@Injectable()
export class SearchService {
  constructor(
    private readonly dataSource: DataSource,
    private readonly permissions: PermissionsService,
    private readonly inbounds: InboundsService,
    private readonly assets: AssetsService,
    private readonly properties: PropertiesService,
    private readonly projects: ProjectsService,
    private readonly builders: BuildersService,
  ) {}

  /** The scopes this user may search. */
  async scopesFor(user: any): Promise<SearchScope[]> {
    const id = Number(user?.id);
    if (!Number.isFinite(id)) return [];
    const allowed = await Promise.all(SEARCH_SCOPES.map((s) => this.permissions.hasNavModule(id, NAV[s])));
    return SEARCH_SCOPES.filter((_, i) => allowed[i]);
  }

  async search(user: any, q: string, scope?: string): Promise<{ groups: SearchGroup[]; scopes: SearchScope[] }> {
    const scopes = await this.scopesFor(user);
    const term = readTerm(q ?? '');
    if (!term) return { groups: [], scopes };
    const wanted = scope && (SEARCH_SCOPES as readonly string[]).includes(scope) ? scopes.filter((s) => s === scope) : scopes;
    // Everywhere: a few from each module. One module: a longer list.
    const limit = scope ? 20 : 5;
    const settled = await Promise.allSettled(wanted.map((s) => this.find(s, user, term, limit)));
    const groups = wanted
      .map((s, i) => ({ scope: s, items: settled[i].status === 'fulfilled' ? (settled[i] as PromiseFulfilledResult<SearchHit[]>).value : [] }))
      .filter((g) => g.items.length);
    return { groups, scopes };
  }

  private find(scope: SearchScope, user: any, t: SearchTerm, limit: number): Promise<SearchHit[]> {
    switch (scope) {
      case 'leads': return this.leads(user, t, limit);
      case 'inbound': return this.inbound(user, t, limit);
      case 'partners': return this.partners(user, t, limit);
      case 'properties': return this.propertyList(user, t, limit);
      case 'projects': return this.projectList(t, limit);
      case 'builders': return this.builderList(t, limit);
      case 'hr': return this.candidates(t, limit);
      case 'assets': return this.assetList(user, t, limit);
      case 'users': return this.users(t, limit);
    }
  }

  /** Name/email/id conditions, plus phone columns when the text is a number. */
  private match(t: SearchTerm, text: string[], phones: string[], idCol: string, idPrefixes: string[]) {
    const conds: string[] = [];
    const params: any[] = [];
    for (const col of text) { conds.push(`${col} LIKE ?`); params.push(t.like); }
    if (t.phone) for (const col of phones) { conds.push(`${digitsOf(col)} LIKE ?`); params.push(`%${t.phone}%`); }
    const idHit = !!t.id && (t.id.prefix === '' || idPrefixes.includes(t.id.prefix));
    if (idHit) { conds.push(`${idCol} = ?`); params.push(t.id!.value); }
    return { where: conds.length ? `(${conds.join(' OR ')})` : '0', params, idValue: idHit ? t.id!.value : -1 };
  }

  private async leads(user: any, t: SearchTerm, limit: number): Promise<SearchHit[]> {
    const m = this.match(t, ['l.name', 'l.email'], ['l.mobile_number', 'l.whatsapp_number'], 'l.id', ['L']);
    const rows: any[] = await this.dataSource.query(
      `SELECT l.id, l.name, l.mobile_number, l.whatsapp_number, l.status, s.id AS staff_id, s.name AS staff
       FROM leads l LEFT JOIN users s ON s.id = l.assigned_staff_id
       WHERE 1=1 ${seesAllLeads(user) ? '' : leadScopeSql(user)} AND ${m.where}
       ORDER BY (l.id = ?) DESC, (l.name LIKE ?) DESC, l.updated_at DESC LIMIT ?`,
      [...m.params, m.idValue, t.starts, limit],
    );
    return rows.map((r) => ({
      id: r.id, code: pad('L', r.id, 5), title: r.name || 'Unnamed lead',
      subtitle: join(
        r.mobile_number,
        // Found by a WhatsApp number that differs from the mobile: show which.
        t.phone && r.whatsapp_number && r.whatsapp_number !== r.mobile_number && String(r.whatsapp_number).replace(/\D/g, '').includes(t.phone)
          ? `WhatsApp ${r.whatsapp_number}` : null,
        r.status, r.staff ? null : 'Unassigned'),
      href: `/leads/${r.id}`,
      person: r.staff ? { id: r.staff_id, name: r.staff } : null,
    }));
  }

  private async inbound(user: any, t: SearchTerm, limit: number): Promise<SearchHit[]> {
    const [ids, contacts] = await Promise.all([this.inbounds.visibleIds(user), this.inbounds.canSeeContacts(user)]);
    if (ids && !ids.length) return [];
    // Phone numbers are matched only for people allowed to see them.
    const m = this.match(t, ['i.property_title', 'i.owner_name', 'i.property_id', 'i.locality', 'i.area'],
      contacts ? ['i.mobile_number', 'i.whatsapp_number'] : [], 'i.id', ['IN', 'INB']);
    const rows: any[] = await this.dataSource.query(
      `SELECT i.id, i.property_id, i.property_title, i.owner_name, i.property_type, i.locality, i.city, i.status, s.id AS staff_id, s.name AS staff
       FROM inbounds i LEFT JOIN users s ON s.id = i.assigned_staff_id
       WHERE ${ids ? `i.id IN (${ids.map(() => '?').join(',')}) AND` : ''} ${m.where}
       ORDER BY (i.id = ?) DESC, (i.property_id = ?) DESC, i.updated_at DESC LIMIT ?`,
      [...(ids ?? []), ...m.params, m.idValue, t.text, limit],
    );
    return rows.map((r) => ({
      id: r.id, code: r.property_id || pad('IN', r.id, 5), title: r.property_title || r.owner_name || 'Inbound',
      subtitle: join(r.owner_name !== r.property_title ? r.owner_name : null, r.property_type, r.locality || r.city, r.status),
      href: `/inbound/${r.id}`, person: r.staff ? { id: r.staff_id, name: r.staff } : null,
    }));
  }

  private async partners(user: any, t: SearchTerm, limit: number): Promise<SearchHit[]> {
    const scope = AgentsService.scopeFor(user);
    if (!scope) return [];
    const m = this.match(t, ['a.name', 'a.company_name', 'a.email', 'a.city'], ['a.mobile_number', 'a.whatsapp_number'], 'a.id', ['A']);
    const rows: any[] = await this.dataSource.query(
      `SELECT a.id, a.name, a.company_name, a.partner_type, a.city, s.id AS staff_id, s.name AS staff
       FROM agents a LEFT JOIN users s ON s.id = a.assigned_staff_id
       WHERE ${scope.where} AND ${m.where}
       ORDER BY (a.id = ?) DESC, (a.name LIKE ?) DESC, a.updated_at DESC LIMIT ?`,
      [...scope.params, ...m.params, m.idValue, t.starts, limit],
    );
    return rows.map((r) => ({
      id: r.id, code: pad('A', r.id, 5), title: r.name || r.company_name || 'Partner',
      subtitle: join(r.name ? r.company_name : null, r.partner_type, r.city), href: `/agent-network/${r.id}`,
      person: r.staff ? { id: r.staff_id, name: r.staff } : null,
    }));
  }

  private async candidates(t: SearchTerm, limit: number): Promise<SearchHit[]> {
    const m = this.match(t, ['h.name', 'h.email', 'h.position'], ['h.mobile', 'h.whatsapp'], 'h.id', ['HRC', 'HR']);
    const rows: any[] = await this.dataSource.query(
      `SELECT h.id, h.name, h.position, h.status, h.mobile FROM hr_candidates h
       WHERE ${m.where}
       ORDER BY (h.id = ?) DESC, (h.name LIKE ?) DESC, h.updatedAt DESC LIMIT ?`,
      [...m.params, m.idValue, t.starts, limit],
    );
    return rows.map((r) => ({
      id: r.id, code: pad('HRC', r.id, 4), title: r.name || 'Candidate',
      subtitle: join(r.position, r.status), href: `/hr/${r.id}`,
    }));
  }

  private async assetList(user: any, t: SearchTerm, limit: number): Promise<SearchHit[]> {
    const ids = await this.assets.visibleIds(user);
    if (ids && !ids.length) return [];
    const m = this.match(t, ['a.owner_name', 'a.display_id', 'a.mediator_name'], ['a.mobile_number'], 'a.id', ['AST']);
    const rows: any[] = await this.dataSource.query(
      `SELECT a.id, a.display_id, a.owner_name, a.status FROM assets a
       WHERE ${ids ? `a.id IN (${ids.map(() => '?').join(',')}) AND` : ''} ${m.where}
       ORDER BY (a.id = ?) DESC, a.updated_at DESC LIMIT ?`,
      [...(ids ?? []), ...m.params, m.idValue, limit],
    );
    return rows.map((r) => ({
      id: r.id, code: r.display_id || pad('AST', r.id, 5), title: r.owner_name || 'Asset',
      subtitle: join(r.status), href: `/asset-inventory/${r.id}`,
    }));
  }

  private async users(t: SearchTerm, limit: number): Promise<SearchHit[]> {
    const m = this.match(t, ['u.name', 'u.email'], ['u.phone'], 'u.id', []);
    const rows: any[] = await this.dataSource.query(
      `SELECT u.id, u.name, u.email, u.avatar_url, u.is_active, r.name AS role, d.name AS department
       FROM users u LEFT JOIN roles r ON r.id = u.role_id LEFT JOIN departments d ON d.id = u.department_id
       WHERE ${m.where}
       ORDER BY (u.id = ?) DESC, u.is_active DESC, (u.name LIKE ?) DESC, u.name LIMIT ?`,
      [...m.params, m.idValue, t.starts, limit],
    );
    return rows.map((r) => ({
      id: r.id, code: String(r.id), title: r.name,
      subtitle: join(r.role, r.department, Number(r.is_active) ? null : 'Inactive'), href: `/users/${r.id}`,
      avatar: r.avatar_url ?? null, person: { id: r.id, name: r.name },
    }));
  }

  // Properties, projects and builders live on the website: ask its API, with
  // the same rules as the CRM's own lists.
  private async propertyList(user: any, t: SearchTerm, limit: number): Promise<SearchHit[]> {
    const res: any = await this.properties.findAll({ search: t.text, limit, page: 1 } as any, user);
    return (res?.data ?? []).map((p: any) => ({
      id: p.id, code: p.propertyCode || String(p.id), title: p.title || 'Property',
      subtitle: join(propertyTypeLabel(p.propertyType), p.listingType === 'Sell' ? 'Buy' : p.listingType, p.city),
      href: `/properties/${p.id}`,
    }));
  }

  private async projectList(t: SearchTerm, limit: number): Promise<SearchHit[]> {
    const res: any = await this.projects.findAll({ search: t.text, limit, page: 1 } as any);
    return (res?.data ?? []).map((p: any) => ({
      id: p.id, code: p.projectCode || String(p.id), title: p.name || 'Project',
      subtitle: join(p.builderName, p.city), href: `/projects/${p.id}`,
    }));
  }

  private async builderList(t: SearchTerm, limit: number): Promise<SearchHit[]> {
    const res: any = await this.builders.findAll({ search: t.text, limit, page: 1 });
    const items: any[] = res?.items ?? res?.data ?? (Array.isArray(res) ? res : []);
    return items.slice(0, limit).map((b: any) => ({
      id: b.id, code: String(b.id), title: b.name || 'Builder',
      subtitle: join(b.city, b.isActive === false ? 'Inactive' : null), href: `/builders/${b.id}`,
    }));
  }
}

/**
 * Admins and managers find every lead, including unassigned ones still in
 * Routing (the Leads page lists only assigned leads). Staff and Team Leads
 * keep exactly the Leads page's scope.
 */
function seesAllLeads(user: any) {
  return ['Admin', 'Super Admin', 'Manager'].includes(String(user?.role ?? ''));
}

/** "apartment_flat" → "Apartment flat". */
function propertyTypeLabel(type?: string | null) {
  if (!type) return null;
  const s = type.replace(/_/g, ' ');
  return s.charAt(0).toUpperCase() + s.slice(1);
}
