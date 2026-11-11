// Finds site listings for a lead requirement. A requirement is written in the
// CRM's own words (category, type, purchase type, preferences), so it is first
// read into what the site stores, then matched loosely: budget and area allow
// some slack, and BHK and locality rank results rather than rule them out.
// When that finds little, a wider search adds similar listings: the same city
// and rent/sale, any type in the category, any budget, closest price first.
// If even that is empty (no rentals of that kind, say), rent/sale is dropped.

/** How far outside the stated budget or area a listing may still be shown. */
export const MATCH_SLACK = 0.2;
export const MATCH_LIMIT = 20;
/** Fewer exact matches than this and similar ones are added. */
export const SIMILAR_WHEN = 8;
export const SIMILAR_LIMIT = 12;

/** Site property types (properties.property_type) for each CRM requirement type. */
const TYPE_MAP: Record<string, string[]> = {
  apartment: ['apartment'],
  villa: ['villa'],
  independent_house: ['villa', 'individual_portion'],
  builder_floor: ['apartment', 'individual_portion'],
  plot: ['plot'],
  farm_house: ['farm_house', 'farmland'],
  office: ['commercial', 'coworking'],
  coworking: ['coworking'],
  commercial_land: ['commercial', 'plot'],
  warehouse: ['commercial', 'industrial'],
  factory: ['industrial'],
  industrial_shed: ['industrial'],
  industrial_land: ['industrial'],
  manufacturing_unit: ['industrial'],
};

/** Used when the type is missing or has no site equivalent. */
const CATEGORY_MAP: Record<string, string[]> = {
  residential: [
    'apartment',
    'villa',
    'individual_portion',
    'plot',
    'farm_house',
  ],
  commercial: ['commercial', 'coworking'],
  industrial: ['industrial'],
  agricultural: ['farmland', 'farm_house'],
  institutional: ['commercial', 'other'],
};

/** Project types the site has (projects.project_type). */
const PROJECT_TYPES = ['apartment', 'villa', 'plot'];

export interface MatchCriteria {
  types: string[] | null;
  /** Every type in the requirement's category, for similar listings. */
  broadTypes: string[] | null;
  listing: 'Rent' | 'Sell' | null;
  city: string | null;
  localities: string[];
  minBudget: number | null;
  maxBudget: number | null;
  /** Every BHK the requirement accepts (old requirements hold a single value). */
  bhk: number[];
  minArea: number | null;
  maxArea: number | null;
  /** Words typed by staff to find a listing by name, code, area or builder. */
  search?: string | null;
}

/** Nothing to narrow by: every available listing, newest first. */
export const NO_CRITERIA: MatchCriteria = {
  types: null,
  broadTypes: null,
  listing: null,
  city: null,
  localities: [],
  minBudget: null,
  maxBudget: null,
  bhk: [],
  minArea: null,
  maxArea: null,
};

const likeAny = (columns: string[], search: string) => {
  const term = `%${search.replace(/[%_\\]/g, '\\$&')}%`;
  return {
    sql: `(${columns.map((c) => `${c} LIKE ?`).join(' OR ')})`,
    params: columns.map(() => term),
  };
};

const num = (v: unknown) => {
  const n = Number(v);
  return v !== null &&
    v !== undefined &&
    v !== '' &&
    Number.isFinite(n) &&
    n > 0
    ? n
    : null;
};

const nums = (v: unknown) => [
  ...new Set(
    (Array.isArray(v) ? v : [v])
      .map(num)
      .filter((n): n is number => n !== null),
  ),
];

const key = (v?: string | null) =>
  v
    ? v
        .trim()
        .toLowerCase()
        .replace(/[\s-]+/g, '_')
    : '';

/** What a requirement asks for, in the site's terms. */
export function matchCriteria(
  inquiry: any,
  city: string | null,
): MatchCriteria {
  const prefs = inquiry.preferences || {};
  const type = key(inquiry.property_type);
  const purchase = key(inquiry.purchase_type);
  let localities: string[] = [];
  try {
    const raw =
      typeof inquiry.sub_locations === 'string'
        ? JSON.parse(inquiry.sub_locations)
        : inquiry.sub_locations;
    if (Array.isArray(raw))
      localities = raw
        .filter((s) => typeof s === 'string' && s.trim())
        .map((s) => s.trim());
  } catch {
    // An unreadable locality list just means no locality preference.
  }
  const types =
    TYPE_MAP[type] ?? CATEGORY_MAP[key(inquiry.property_category)] ?? null;
  const category =
    CATEGORY_MAP[key(inquiry.property_category)] ??
    Object.values(CATEGORY_MAP).find((list) =>
      types?.some((t) => list.includes(t)),
    );
  return {
    types,
    broadTypes:
      types && category ? [...new Set([...types, ...category])] : types,
    listing:
      purchase === 'rental'
        ? 'Rent'
        : purchase === 'buy' || purchase === 'sale'
          ? 'Sell'
          : null,
    city,
    localities,
    minBudget: num(prefs.minBudget),
    maxBudget: num(prefs.maxBudget),
    bhk: nums(prefs.bhk),
    minArea: num(prefs.minArea),
    maxArea: num(prefs.maxArea),
  };
}

const placeholders = (list: unknown[]) => list.map(() => '?').join(', ');

/** Distance from a bedrooms column to the nearest wanted BHK (0 when it is one of them). */
const bhkDistance = (column: string, bhk: number[]) => {
  const each = bhk.map(() => `ABS(CAST(${column} AS SIGNED) - ?)`);
  return each.length > 1 ? `LEAST(${each.join(', ')})` : each[0];
};

/** Options for the wider search: what to rank against and what is already shown. */
export interface SimilarSearch {
  /** Price the requirement aims at (middle of the budget), if any. */
  target: number | null;
  exclude: number[];
}

/**
 * The wider search: same city and rent/sale, any type in the category, no
 * budget or area limits. Price closeness then does the ranking.
 */
export function similarCriteria(c: MatchCriteria): {
  criteria: MatchCriteria;
  target: number | null;
} {
  const target =
    c.minBudget && c.maxBudget
      ? (c.minBudget + c.maxBudget) / 2
      : (c.maxBudget ?? c.minBudget);
  return {
    criteria: {
      ...c,
      types: c.broadTypes,
      minBudget: null,
      maxBudget: null,
      minArea: null,
      maxArea: null,
    },
    target,
  };
}

/** Ranking terms that apply; a bare `0` would be read as a column position. */
const order = (...ranks: string[]) =>
  ranks
    .filter((r) => r !== '0')
    .map((r) => `${r}, `)
    .join('');

/** Available properties, nearest locality and BHK first. */
export function propertyMatchQuery(c: MatchCriteria, similar?: SimilarSearch) {
  const where = ["p.status = 'available'"];
  const params: unknown[] = [];
  if (similar?.exclude.length) {
    where.push(`p.id NOT IN (${placeholders(similar.exclude)})`);
    params.push(...similar.exclude);
  }
  const area =
    'COALESCE(NULLIF(pd.area_sqft, 0), NULLIF(pd.built_up_area, 0), NULLIF(pd.carpet_area, 0), NULLIF(pd.plot_area, 0))';

  if (c.search) {
    const like = likeAny(
      ['p.title', 'p.property_code', 's.locality_name', 'p.city'],
      c.search,
    );
    where.push(like.sql);
    params.push(...like.params);
  }
  if (c.types) {
    where.push(`p.property_type IN (${placeholders(c.types)})`);
    params.push(...c.types);
  }
  if (c.listing) {
    where.push('p.listing_type = ?');
    params.push(c.listing);
  }
  if (c.city) {
    where.push('p.city = ?');
    params.push(c.city);
  }
  if (c.minBudget) {
    where.push('p.price >= ?');
    params.push(c.minBudget * (1 - MATCH_SLACK));
  }
  if (c.maxBudget) {
    where.push('p.price <= ?');
    params.push(c.maxBudget * (1 + MATCH_SLACK));
  }
  if (c.minArea) {
    where.push(`(${area} IS NULL OR ${area} >= ?)`);
    params.push(c.minArea * (1 - MATCH_SLACK));
  }
  if (c.maxArea) {
    where.push(`(${area} IS NULL OR ${area} <= ?)`);
    params.push(c.maxArea * (1 + MATCH_SLACK));
  }

  const localityRank = c.localities.length
    ? `CASE WHEN s.locality_name IN (${placeholders(c.localities)}) THEN 0 ELSE 1 END`
    : '0';
  const bhkRank = c.bhk.length
    ? `COALESCE(${bhkDistance('pd.bedrooms', c.bhk)}, 99)`
    : '0';
  const priceRank = similar?.target ? 'COALESCE(ABS(p.price - ?), 1e15)' : '0';
  const rankParams = [
    ...c.localities,
    ...(similar?.target ? [similar.target] : []),
    ...c.bhk,
  ];

  return {
    sql: `SELECT p.id, p.property_code AS code, p.title, p.slug,
                 (SELECT i.image_url FROM property_images i WHERE i.property_id = p.id ORDER BY i.is_primary DESC, i.id LIMIT 1) AS photo, p.price, p.property_type, p.listing_type, p.city,
                 s.locality_name AS locality, pd.bedrooms, ${area} AS area_sqft, pd.furnished,
                 ${c.localities.length ? `${localityRank} = 0` : '0'} AS locality_match
          FROM properties p
          LEFT JOIN property_details pd ON pd.property_id = p.id
          LEFT JOIN property_locations pl ON pl.property_id = p.id
          LEFT JOIN sublocations s ON s.id = pl.location_id
          WHERE ${where.join(' AND ')}
          ORDER BY ${order(localityRank, priceRank, bhkRank)}p.created_at DESC
          LIMIT ${similar ? SIMILAR_LIMIT : MATCH_LIMIT}`,
    params: [...c.localities, ...params, ...rankParams],
  };
}

/** Published projects with at least one available unit that fits. */
export function projectMatchQuery(c: MatchCriteria, similar?: SimilarSearch) {
  const types = c.types
    ? c.types.filter((t) => PROJECT_TYPES.includes(t))
    : PROJECT_TYPES;
  if (!types.length) return null;

  const where = [
    "pr.status = 'published'",
    `pr.project_type IN (${placeholders(types)})`,
  ];
  const projectParams: unknown[] = [...types];
  if (similar?.exclude.length) {
    where.push(`pr.id NOT IN (${placeholders(similar.exclude)})`);
    projectParams.push(...similar.exclude);
  }
  if (c.city) {
    where.push('pr.city = ?');
    projectParams.push(c.city);
  }
  if (c.search) {
    const like = likeAny(
      [
        'pr.name',
        'pr.project_code',
        'pr.sublocation',
        'pr.city',
        'pr.builder_name',
      ],
      c.search,
    );
    where.push(like.sql);
    projectParams.push(...like.params);
  }

  const rent = c.listing === 'Rent';
  const unitPrice = rent ? 'u.monthly_rent' : 'u.price';
  const unit = ['u.project_id = pr.id', "u.status = 'available'"];
  const unitParams: unknown[] = [];
  if (c.listing) {
    unit.push('u.listing_mode = ?');
    unitParams.push(rent ? 'rent' : 'sale');
  }
  if (c.minBudget) {
    unit.push(`${unitPrice} >= ?`);
    unitParams.push(c.minBudget * (1 - MATCH_SLACK));
  }
  if (c.maxBudget) {
    unit.push(`${unitPrice} <= ?`);
    unitParams.push(c.maxBudget * (1 + MATCH_SLACK));
  }

  const localityRank = c.localities.length
    ? `CASE WHEN pr.sublocation IN (${placeholders(c.localities)}) THEN 0 ELSE 1 END`
    : '0';
  const bhkRank = c.bhk.length
    ? `COALESCE(MIN(${bhkDistance('u.bedrooms', c.bhk)}), 99)`
    : '0';
  const priceRank = similar?.target
    ? `COALESCE(MIN(ABS(${unitPrice} - ?)), 1e15)`
    : '0';
  const rankParams = [
    ...c.localities,
    ...(similar?.target ? [similar.target] : []),
    ...c.bhk,
  ];

  return {
    sql: `SELECT pr.id, pr.project_code AS code, pr.name, pr.canonical_slug AS slug, pr.cover_image_url AS photo, pr.project_type, pr.city, pr.sublocation AS locality,
                 pr.builder_name, pr.possession_status,
                 COUNT(u.id) AS units, MIN(${unitPrice}) AS min_price, MAX(${unitPrice}) AS max_price,
                 GROUP_CONCAT(DISTINCT u.bedrooms ORDER BY u.bedrooms) AS bedrooms,
                 ${c.localities.length ? `${localityRank} = 0` : '0'} AS locality_match
          FROM projects pr
          JOIN project_units u ON ${unit.join(' AND ')}
          WHERE ${where.join(' AND ')}
          GROUP BY pr.id
          ORDER BY ${order(localityRank, priceRank, bhkRank)}pr.created_at DESC
          LIMIT ${similar ? SIMILAR_LIMIT : MATCH_LIMIT}`,
    params: [...c.localities, ...unitParams, ...projectParams, ...rankParams],
  };
}
