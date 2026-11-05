import type { DataSource } from 'typeorm';

// What a customer may see about a site listing. Only fields picked here reach
// the PDF: owner, agent, brokerage, legal paperwork, internal pricing and the
// street address are never read, and free text is cleaned of phone numbers,
// emails and the notes the old-CRM import left behind.

export type ListingKind = 'property' | 'project';

/** A block of the brochure: a grid of facts, a table, grouped lists or plain items. */
export interface ListingSection {
  title: string;
  facts?: [string, string][];
  table?: { columns: string[]; widths: number[]; rows: string[][] };
  groups?: { title: string; items: string[] }[];
  items?: string[];
  link?: { label: string; url: string };
}

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
  sections: ListingSection[];
  photos: string[];
}

const WEBSITE = 'https://www.majestanrealty.com';
const MAX_PHOTOS = 16;

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
  /[A-Z]{3}/.test(value) && !/\d/.test(value) && value === value.toUpperCase()
    ? titleCase(value.toLowerCase())
    : value;
const facts = (pairs: [string, string | null | undefined][]) =>
  pairs
    .filter((p): p is [string, string] => !!p[1])
    .map(([label, value]): [string, string] => [label, calm(value)]);

function json(value: unknown): unknown {
  try {
    return typeof value === 'string' ? JSON.parse(value) : value;
  } catch {
    return null;
  }
}
const jsonList = (value: unknown): unknown[] => {
  const list = json(value);
  return Array.isArray(list) ? list : [];
};
/** Free text a customer may see, on one line. */
const plain = (value: unknown) => cleanText(value).join(' ') || null;

// "Suitable for" categories the old import filed as amenities ("SHOP", "OFFICE").
const notAnAmenity = (a: { name: string; category: string }) =>
  a.category === 'other' && a.name === a.name.toUpperCase();
const amenityNames = (rows: { name: string; category: string }[]) =>
  rows.filter((a) => !notAnAmenity(a)).map((a) => a.name);

const section = (
  title: string,
  pairs: [string, string | null | undefined][],
  extra: Partial<ListingSection> = {},
): ListingSection => ({ title, facts: facts(pairs), ...extra });
/** Sections with nothing in them are left out of the brochure. */
const filled = (sections: ListingSection[]) =>
  sections.filter(
    (s) =>
      s.facts?.length ||
      s.table?.rows.length ||
      s.groups?.length ||
      s.items?.length,
  );

const AMENITY_SQL = (owner: 'property' | 'project') =>
  `SELECT a.name, a.category FROM ${owner}_amenities pa JOIN amenities a ON a.id = pa.amenity_id
    WHERE pa.${owner}_id = ? AND pa.availability <> 'not_available' ORDER BY a.name`;

export async function loadProperty(
  site: DataSource,
  id: number,
): Promise<Listing | null> {
  const [p] = await site.query(
    // Details first: on a name clash (id) the property's own column wins.
    `SELECT d.*, p.id, p.property_code, p.title, p.price, p.property_type, p.listing_type, p.city, p.slug,
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
    site.query(AMENITY_SQL('property'), [id]),
  ]);
  return propertyListing(
    p,
    images.map((i: { image_url: string }) => i.image_url),
    amenities,
  );
}

export function propertyListing(
  p: any,
  images: string[],
  amenities: { name: string; category: string }[],
): Listing {
  const rent = p.listing_type === 'Rent';
  const unit = p.area_unit && p.area_unit !== 'Sq Ft' ? p.area_unit : 'sq ft';
  const furnishing = p.furnishing_status
    ? titleCase(p.furnishing_status)
    : p.furnished === null || p.furnished === undefined
      ? null
      : Number(p.furnished)
        ? 'Furnished'
        : 'Unfurnished';

  return {
    kind: 'property',
    id: p.id,
    code: p.property_code || `#${p.id}`,
    title: p.title || 'Property',
    subtitle: [
      titleCase(p.property_type || ''),
      [p.locality_name, p.city].filter(Boolean).join(', '),
    ]
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
    sections: filled([
      section('Overview', [
        ['Property type', p.property_type ? titleCase(p.property_type) : null],
        ['Listed for', rent ? 'Rent' : 'Sale'],
        [
          'Possession',
          p.possession_status ? titleCase(p.possession_status) : null,
        ],
        ['Available from', date(p.available_from)],
        [
          'Property age',
          p.property_age ? titleCase(String(p.property_age)) : null,
        ],
        [
          'Condition',
          p.property_condition ? titleCase(p.property_condition) : null,
        ],
        ['Furnishing', furnishing],
        ['Facing', p.property_facing ? titleCase(p.property_facing) : null],
        ['Suitable for', plain(p.suitable_for)],
      ]),
      section('Sizes & configuration', [
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
          'Ceiling height',
          has(p.ceiling_height_ft) ? `${Number(p.ceiling_height_ft)} ft` : null,
        ],
        ['Frontage', plain(p.frontage)],
        ['Road width', plain(p.road_width)],
      ]),
      section('Building', [
        [
          'Floor',
          has(p.floor_number)
            ? has(p.total_floors)
              ? `${p.floor_number} of ${p.total_floors}`
              : String(p.floor_number)
            : null,
        ],
        [
          'Total floors',
          !has(p.floor_number) && has(p.total_floors)
            ? String(p.total_floors)
            : null,
        ],
        ['Lifts', has(p.no_of_lifts) ? String(p.no_of_lifts) : null],
        [
          'Parking',
          has(p.car_parking)
            ? `${p.car_parking} car`
            : has(p.parking)
              ? String(p.parking)
              : null,
        ],
        ['Power backup', yesNo(p.power_backup)],
        ['Water supply', p.water_supply ? titleCase(p.water_supply) : null],
      ]),
      section('Location', [
        ['Locality', p.locality_name],
        ['City', p.city],
      ]),
      section('Pricing', [
        ['Price per sq ft', rupees(p.price_per_sqft)],
        [
          'Maintenance',
          rupees(p.maintenance_charges)
            ? `${rupees(p.maintenance_charges)} / month`
            : null,
        ],
        ['Security deposit', rupees(p.security_deposit)],
        ['Negotiable', Number(p.negotiable) ? 'Yes' : null],
      ]),
      { title: 'Amenities', items: amenityNames(amenities) },
    ]),
    photos: images.map(photoUrl).filter(Boolean) as string[],
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

const cents = (v: unknown) => (has(v) ? `${Number(v)} cents` : null);
/** The size a unit is sold by: carpet, else built-up, super built-up or plot. */
const mainArea = (u: any): number | null =>
  [
    u.carpet_area_sqft,
    u.builtup_area_sqft,
    u.super_builtup_area_sqft,
    u.plot_area_sqft,
  ]
    .map(Number)
    .find((n) => n >= 50) ?? null;
const range = (values: number[], show: (n: number) => string) => {
  if (!values.length) return null;
  const low = Math.min(...values);
  const high = Math.max(...values);
  return low === high ? show(low) : `${show(low)} – ${show(high)}`;
};
const count = (n: unknown, one: string, many = `${one}s`) =>
  has(n) ? `${n} ${Number(n) === 1 ? one : many}` : null;

export async function loadProject(
  site: DataSource,
  id: number,
): Promise<Listing | null> {
  const [p] = await site.query(
    `SELECT id, project_code, name, project_type, builder_name, rera_number, possession_status, possession_date,
            city, sublocation, address, pincode, latitude, longitude, towers, tower_details, total_units, total_floors,
            project_area_sqft, connectivity, nearby_categories, canonical_slug, cover_image_url, gallery_image_urls
       FROM projects WHERE id = ? LIMIT 1`,
    [id],
  );
  if (!p) return null;
  const [units, amenities] = await Promise.all([
    site.query(
      `SELECT title, unit_type, bedrooms, bathrooms, balconies, carpet_area_sqft, builtup_area_sqft,
              super_builtup_area_sqft, plot_area_sqft, plot_area_cents, facing, furnished_status, parking,
              listing_mode, price, monthly_rent, floor_plans, floor_plan_image_url
         FROM project_units WHERE project_id = ? AND status = 'available' ORDER BY COALESCE(price, monthly_rent), id LIMIT 30`,
      [id],
    ),
    site.query(AMENITY_SQL('project'), [id]),
  ]);
  return projectListing(p, units, amenities);
}

export function projectListing(
  p: any,
  units: any[],
  amenities: { name: string; category: string }[],
): Listing {
  const unitPrice = (u: any) =>
    Number(u.listing_mode === 'rent' ? u.monthly_rent : u.price);
  const prices = units.map(unitPrice).filter((n) => n > 0);
  const anyRent = units.some((u) => u.listing_mode === 'rent');
  const bhk = [
    ...new Set(units.map((u) => Number(u.bedrooms)).filter((n) => n > 0)),
  ].sort((a, b) => a - b);
  const plots = units.filter((u) => has(u.plot_area_cents));

  const towers = jsonList(p.tower_details).filter(
    (t: any) => t && typeof t === 'object' && t.tower,
  ) as { tower: string; floors?: number; units?: number }[];
  const connectivity = jsonList(p.connectivity)
    .map((c: any) =>
      c?.label
        ? [plain(c.label), plain(c.detail)].filter(Boolean).join(' – ')
        : null,
    )
    .filter(Boolean) as string[];
  const nearby = jsonList(p.nearby_categories)
    .map((group: any) => ({
      title: plain(group?.title) || 'Nearby',
      items: jsonList(group?.places)
        .map((place: any) =>
          place?.name
            ? [plain(place.name), place.distance].filter(Boolean).join(' · ')
            : null,
        )
        .filter((v, i, all): v is string => !!v && all.indexOf(v) === i)
        .slice(0, 4),
    }))
    .filter((group) => group.items.length);
  const hasMap = has(p.latitude) && has(p.longitude);

  const floorPlans = units.flatMap((u) => [
    u.floor_plan_image_url,
    ...jsonList(u.floor_plans).map((f: any) => f?.imageUrl || f?.imageKey),
  ]);

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
    price: range(prices, (n) => rupees(n)!) ?? 'Price on request',
    priceNote: units.length
      ? `${units.length} available ${units.length === 1 ? 'unit' : 'units'}${anyRent ? ' · rent per month' : ''}`
      : null,
    sections: filled([
      section('Overview', [
        ['Builder', p.builder_name],
        ['Project type', p.project_type ? titleCase(p.project_type) : null],
        [
          'Possession',
          p.possession_status ? titleCase(p.possession_status) : null,
        ],
        ['Possession date', date(p.possession_date)],
        ['RERA number', p.rera_number],
        ['Total units', has(p.total_units) ? String(p.total_units) : null],
        ['Available units', units.length ? String(units.length) : null],
        ['Starting price', prices.length ? rupees(Math.min(...prices)) : null],
      ]),
      section('Sizes', [
        [
          'Project area',
          has(p.project_area_sqft)
            ? `${sqft(p.project_area_sqft)} (${(Number(p.project_area_sqft) / 43560).toFixed(2)} acres)`
            : null,
        ],
        [
          'Configurations',
          bhk.length ? `${bhk.join(', ')} BHK` : plots.length ? 'Plots' : null,
        ],
        [
          'Unit sizes',
          range(
            units.map(mainArea).filter((n): n is number => n !== null),
            (n) => sqft(n)!,
          ),
        ],
        [
          'Plot sizes',
          range(
            plots.map((u) => Number(u.plot_area_cents)),
            (n) => cents(n)!,
          ),
        ],
      ]),
      section(
        'Towers',
        [
          ['Towers', has(p.towers) ? String(p.towers) : null],
          ['Floors', has(p.total_floors) ? String(p.total_floors) : null],
        ],
        towers.length
          ? {
              table: {
                columns: ['Tower', 'Floors', 'Units'],
                widths: [0.5, 0.25, 0.25],
                rows: towers.map((t) => [
                  plain(t.tower) || '—',
                  has(t.floors) ? String(t.floors) : '—',
                  has(t.units) ? String(t.units) : '—',
                ]),
              },
            }
          : {},
      ),
      section(
        'Location',
        [
          ['Address', plain(p.address)],
          ['Locality', p.sublocation],
          ['City', p.city],
          ['Pincode', p.pincode],
        ],
        {
          groups: [
            ...(connectivity.length
              ? [{ title: 'Connectivity', items: connectivity }]
              : []),
            ...nearby,
          ],
          ...(hasMap
            ? {
                link: {
                  label: 'Open in Google Maps',
                  url: `https://www.google.com/maps/search/?api=1&query=${Number(p.latitude)},${Number(p.longitude)}`,
                },
              }
            : {}),
        },
      ),
      { title: 'Amenities', items: amenityNames(amenities) },
      {
        title: 'Units & configuration',
        table: {
          columns: [
            'Unit',
            'Configuration',
            'Area',
            'Facing',
            anyRent ? 'Price / rent' : 'Price',
          ],
          widths: [0.19, 0.3, 0.25, 0.1, 0.16],
          rows: units.map((u) => {
            const rent = u.listing_mode === 'rent';
            const amount = rupees(unitPrice(u));
            return [
              unitLabel(u),
              [
                [
                  count(u.bedrooms, 'Bed'),
                  count(u.bathrooms, 'Bath'),
                  count(u.balconies, 'Balcony', 'Balconies'),
                ]
                  .filter(Boolean)
                  .join(' · '),
                u.furnished_status ? titleCase(u.furnished_status) : null,
                count(u.parking, 'parking', 'parking'),
              ]
                .filter(Boolean)
                .join('\n') || '—',
              [
                sqft(u.carpet_area_sqft) &&
                  `Carpet ${sqft(u.carpet_area_sqft)}`,
                sqft(u.builtup_area_sqft) &&
                  `Built-up ${sqft(u.builtup_area_sqft)}`,
                sqft(u.super_builtup_area_sqft) &&
                  `Super ${sqft(u.super_builtup_area_sqft)}`,
                sqft(u.plot_area_sqft) && `Plot ${sqft(u.plot_area_sqft)}`,
                cents(u.plot_area_cents),
              ]
                .filter(Boolean)
                .join('\n') || '—',
              u.facing ? titleCase(u.facing) : '—',
              amount ? `${amount}${rent ? ' / month' : ''}` : 'On request',
            ];
          }),
        },
      },
    ]),
    photos: [
      photoUrl(p.cover_image_url),
      ...jsonList(p.gallery_image_urls).map(photoUrl),
      ...floorPlans.map(photoUrl),
    ]
      .filter((u, i, all): u is string => !!u && all.indexOf(u) === i)
      .slice(0, MAX_PHOTOS),
  };
}
