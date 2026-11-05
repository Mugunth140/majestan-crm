import type { DataSource } from 'typeorm';

// What a customer may see about a site listing. Only fields picked here reach
// the PDF: owner, agent, brokerage, legal paperwork, internal pricing and the
// street address are never read, and free text is cleaned of phone numbers,
// emails and the notes the old-CRM import left behind.

export type ListingKind = 'property' | 'project';

export interface Listing {
  kind: ListingKind;
  id: number;
  code: string;
  title: string;
  /** "Apartment · RS Puram, Coimbatore" */
  subtitle: string;
  url: string | null;
  price: string;
  priceNote: string | null;
  facts: [string, string][];
  description: string[];
  /** Project highlights: a heading and its points. */
  highlights: { heading: string; points: string[] }[];
  amenities: string[];
  units: { type: string; size: string; price: string }[];
  photos: string[];
}

const WEBSITE = 'https://www.majestanrealty.com';
const MAX_PHOTOS = 7;

const has = (v: unknown) =>
  v !== null &&
  v !== undefined &&
  v !== '' &&
  v !== 0 &&
  v !== '0' &&
  v !== '0.00';
const titleCase = (v: string) =>
  v.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
const yesNo = (v: unknown) =>
  v === null || v === undefined ? null : Number(v) ? 'Yes' : 'No';
// Below this an area in square feet is a typing slip, not a size worth showing.
const sqft = (v: unknown, unit = 'sq ft') =>
  has(v) && (unit !== 'sq ft' || Number(v) >= 50)
    ? `${Math.round(Number(v)).toLocaleString('en-IN')} ${unit}`
    : null;
const date = (v: unknown) =>
  has(v)
    ? new Date(v as string).toLocaleDateString('en-IN', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
        timeZone: 'Asia/Kolkata',
      })
    : null;

/** "₹1.2 Cr", "₹45 L", "₹30,000". */
export function rupees(value: unknown): string | null {
  const n = Number(value);
  if (!has(value) || !Number.isFinite(n) || n <= 0) return null;
  const trim = (x: number) =>
    Number.isInteger(x) ? String(x) : x.toFixed(2).replace(/\.?0+$/, '');
  if (n >= 1e7) return `₹${trim(n / 1e7)} Cr`;
  if (n >= 1e5) return `₹${trim(n / 1e5)} L`;
  return `₹${Math.round(n).toLocaleString('en-IN')}`;
}

// Lines the old-CRM import or staff wrote for themselves.
const INTERNAL_LINE =
  /legacy\s+\w+|excel row|photos? pending|coords?:|^\s*site:|owner|brokerage|commission|contact (no|number|person)/i;
const PHONE = /(\+?91[\s-]?)?[6-9]\d{4}[\s-]?\d{5}\b|\b\d{3,5}[\s-]\d{6,8}\b/g;
const EMAIL = /[\w.+-]+@[\w-]+\.[\w.]+/g;

/** Paragraphs safe to hand a customer. */
export function cleanText(text: unknown): string[] {
  if (typeof text !== 'string' || !text.trim()) return [];
  return text
    .replace(/<\/(p|div|li|h\d)>|<br\s*\/?>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .split(/\n+/)
    .map((line) =>
      line.replace(PHONE, '').replace(EMAIL, '').replace(/\s+/g, ' ').trim(),
    )
    .filter((line) => line.length > 1 && !INTERNAL_LINE.test(line));
}

/** Public URL for a stored photo key or URL; files kept only on the site server are skipped. */
export function photoUrl(key: unknown): string | null {
  if (typeof key !== 'string' || !key.trim()) return null;
  if (/^https?:\/\//.test(key)) return key;
  if (key.startsWith('local')) return null;
  const base = (
    process.env.R2_PUBLIC_URL || 'https://cdn.majestanrealty.com'
  ).replace(/\/$/, '');
  return `${base}/${key.replace(/^\//, '')}`;
}

/** Values typed in capitals ("EAST", "BARESHELL") read as shouting in a brochure. */
const calm = (value: string) =>
  /[A-Z]{3}/.test(value) && value === value.toUpperCase()
    ? titleCase(value.toLowerCase())
    : value;
const facts = (pairs: [string, string | null | undefined][]) =>
  pairs
    .filter((p): p is [string, string] => !!p[1])
    .map(([label, value]): [string, string] => [label, calm(value)]);

function jsonList(value: unknown): string[] {
  try {
    const list = typeof value === 'string' ? JSON.parse(value) : value;
    return Array.isArray(list) ? list.filter((v) => typeof v === 'string') : [];
  } catch {
    return [];
  }
}

export async function loadProperty(
  site: DataSource,
  id: number,
): Promise<Listing | null> {
  const [p] = await site.query(
    // Details first: on a name clash (id) the property's own column wins.
    `SELECT d.*, p.id, p.property_code, p.title, p.description, p.price, p.property_type, p.listing_type, p.city, p.slug,
            p.negotiable, p.maintenance_charges, p.security_deposit, p.price_per_sqft, p.available_from, p.property_condition,
            s.locality_name
       FROM properties p
       LEFT JOIN property_details d ON d.property_id = p.id
       LEFT JOIN property_locations pl ON pl.property_id = p.id
       LEFT JOIN sublocations s ON s.id = pl.location_id
      WHERE p.id = ?
      LIMIT 1`,
    [id],
  );
  if (!p) return null;
  const [images, amenities] = await Promise.all([
    site.query(
      'SELECT image_url FROM property_images WHERE property_id = ? ORDER BY is_primary DESC, id LIMIT ?',
      [id, MAX_PHOTOS],
    ),
    site.query(
      `SELECT a.name FROM property_amenities pa JOIN amenities a ON a.id = pa.amenity_id
        WHERE pa.property_id = ? AND pa.availability <> 'not_available' ORDER BY a.name`,
      [id],
    ),
  ]);

  const rent = p.listing_type === 'Rent';
  const unit = p.area_unit && p.area_unit !== 'Sq Ft' ? p.area_unit : 'sq ft';
  const place = [p.locality_name, p.city].filter(Boolean).join(', ');
  const furnishing = p.furnishing_status
    ? titleCase(p.furnishing_status)
    : p.furnished === null
      ? null
      : Number(p.furnished)
        ? 'Furnished'
        : 'Unfurnished';

  return {
    kind: 'property',
    id: p.id,
    code: p.property_code || `#${p.id}`,
    title: p.title || 'Property',
    subtitle: [titleCase(p.property_type || ''), place]
      .filter(Boolean)
      .join(' · '),
    url: p.slug ? `${WEBSITE}/property/${p.slug}` : null,
    price: rupees(p.price)
      ? `${rupees(p.price)}${rent ? ' / month' : ''}`
      : 'Price on request',
    priceNote: [
      rent ? 'For rent' : 'For sale',
      Number(p.negotiable) ? 'Negotiable' : null,
    ]
      .filter(Boolean)
      .join(' · '),
    facts: facts([
      ['Bedrooms', has(p.bedrooms) ? `${p.bedrooms} BHK` : null],
      ['Bathrooms', has(p.bathrooms) ? String(p.bathrooms) : null],
      ['Balconies', has(p.balconies) ? String(p.balconies) : null],
      ['Built-up area', sqft(p.built_up_area, unit)],
      ['Carpet area', sqft(p.carpet_area, unit)],
      ['Super built-up area', sqft(p.super_built_up_area, unit)],
      [
        'Plot area',
        sqft(p.plot_area, unit) ??
          (has(p.plot_size_cents)
            ? `${Number(p.plot_size_cents)} cents`
            : null),
      ],
      [
        'Area',
        !has(p.built_up_area) && !has(p.carpet_area) && !has(p.plot_area)
          ? sqft(p.area_sqft, unit)
          : null,
      ],
      [
        'Floor',
        has(p.floor_number)
          ? has(p.total_floors)
            ? `${p.floor_number} of ${p.total_floors}`
            : String(p.floor_number)
          : null,
      ],
      ['Facing', p.property_facing ? titleCase(p.property_facing) : null],
      ['Furnishing', furnishing],
      [
        'Parking',
        has(p.car_parking)
          ? `${p.car_parking} car`
          : has(p.parking)
            ? String(p.parking)
            : null,
      ],
      [
        'Possession',
        p.possession_status ? titleCase(p.possession_status) : null,
      ],
      [
        'Property age',
        p.property_age ? titleCase(String(p.property_age)) : null,
      ],
      [
        'Condition',
        p.property_condition ? titleCase(p.property_condition) : null,
      ],
      ['Available from', date(p.available_from)],
      ['Price per sq ft', rupees(p.price_per_sqft)],
      [
        'Maintenance',
        rupees(p.maintenance_charges)
          ? `${rupees(p.maintenance_charges)} / month`
          : null,
      ],
      ['Security deposit', rupees(p.security_deposit)],
      [
        'Ceiling height',
        has(p.ceiling_height_ft) ? `${Number(p.ceiling_height_ft)} ft` : null,
      ],
      ['Road width', p.road_width ? String(p.road_width) : null],
      ['Frontage', p.frontage ? String(p.frontage) : null],
      ['Water supply', p.water_supply ? titleCase(p.water_supply) : null],
      ['Power backup', yesNo(p.power_backup)],
      ['Lifts', has(p.no_of_lifts) ? String(p.no_of_lifts) : null],
      ['Suitable for', p.suitable_for ? String(p.suitable_for) : null],
    ]),
    description: cleanText(p.description),
    highlights: [],
    amenities: amenities.map((a: { name: string }) => a.name),
    units: [],
    photos: images
      .map((i: { image_url: string }) => photoUrl(i.image_url))
      .filter(Boolean) as string[],
  };
}

function unitLabel(u: any): string {
  if (u.title) return u.title;
  if (has(u.bedrooms)) return `${u.bedrooms} BHK`;
  if (/^\d+bhk$/.test(u.unit_type)) return u.unit_type.replace('bhk', ' BHK');
  return u.unit_type === 'other'
    ? 'Unit'
    : titleCase(u.unit_type.replace(/_unit$/, ''));
}

export async function loadProject(
  site: DataSource,
  id: number,
): Promise<Listing | null> {
  const [p] = await site.query(
    `SELECT id, project_code, name, description, highlights, project_type, builder_name, rera_number, possession_status,
            possession_date, city, sublocation, address, towers, total_units, total_floors, project_area_sqft,
            canonical_slug, cover_image_url, gallery_image_urls
       FROM projects WHERE id = ? LIMIT 1`,
    [id],
  );
  if (!p) return null;
  const [units, amenities] = await Promise.all([
    site.query(
      `SELECT title, unit_type, bedrooms, carpet_area_sqft, builtup_area_sqft, plot_area_sqft, listing_mode, price, monthly_rent
         FROM project_units WHERE project_id = ? AND status = 'available' ORDER BY COALESCE(price, monthly_rent), id LIMIT 30`,
      [id],
    ),
    site.query(
      `SELECT a.name FROM project_amenities pa JOIN amenities a ON a.id = pa.amenity_id
        WHERE pa.project_id = ? AND pa.availability <> 'not_available' ORDER BY a.name`,
      [id],
    ),
  ]);
  const prices = units
    .map((u: any) =>
      Number(u.listing_mode === 'rent' ? u.monthly_rent : u.price),
    )
    .filter((n: number) => n > 0);
  const low = rupees(Math.min(...prices));
  const high = rupees(Math.max(...prices));

  return {
    kind: 'project',
    id: p.id,
    code: p.project_code || `#${p.id}`,
    title: p.name,
    subtitle: [
      titleCase(p.project_type || ''),
      [p.sublocation, p.city].filter(Boolean).join(', '),
    ]
      .filter(Boolean)
      .join(' · '),
    url: p.canonical_slug ? `${WEBSITE}/${p.canonical_slug}` : null,
    price: prices.length
      ? low === high
        ? low!
        : `${low} – ${high}`
      : 'Price on request',
    priceNote: units.length
      ? `${units.length} available ${units.length === 1 ? 'unit' : 'units'}`
      : null,
    facts: facts([
      ['Builder', p.builder_name],
      ['Project type', p.project_type ? titleCase(p.project_type) : null],
      [
        'Possession',
        p.possession_status ? titleCase(p.possession_status) : null,
      ],
      ['Possession date', date(p.possession_date)],
      ['RERA number', p.rera_number],
      ['Towers', has(p.towers) ? String(p.towers) : null],
      ['Total units', has(p.total_units) ? String(p.total_units) : null],
      ['Floors', has(p.total_floors) ? String(p.total_floors) : null],
      ['Project area', sqft(p.project_area_sqft)],
      [
        'Address',
        [p.address, p.sublocation, p.city].filter(Boolean).join(', ') || null,
      ],
    ]),
    description: cleanText(p.description),
    highlights: projectHighlights(p.highlights),
    amenities: amenities.map((a: { name: string }) => a.name),
    units: units.map((u: any) => {
      const rent = u.listing_mode === 'rent';
      const area =
        sqft(u.carpet_area_sqft) ??
        sqft(u.builtup_area_sqft) ??
        sqft(u.plot_area_sqft) ??
        '—';
      return {
        type: unitLabel(u),
        size: area,
        price: rupees(rent ? u.monthly_rent : u.price)
          ? `${rupees(rent ? u.monthly_rent : u.price)}${rent ? ' / month' : ''}`
          : 'On request',
      };
    }),
    photos: [
      photoUrl(p.cover_image_url),
      ...jsonList(p.gallery_image_urls).map(photoUrl),
    ]
      .filter((u, i, all): u is string => !!u && all.indexOf(u) === i)
      .slice(0, MAX_PHOTOS),
  };
}

/** Blank-line separated blocks, each a heading line followed by its points. */
export function projectHighlights(text: unknown): Listing['highlights'] {
  return String(text ?? '')
    .split(/\n\s*\n/)
    .map((block) => cleanText(block))
    .filter((lines) => lines.length)
    .map((lines) =>
      lines.length === 1
        ? { heading: '', points: lines }
        : { heading: lines[0], points: lines.slice(1) },
    );
}
