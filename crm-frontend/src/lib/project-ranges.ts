export interface ProjectRanges {
  minPrice: number | null;
  maxPrice: number | null;
  minArea: number | null;
  maxArea: number | null;
  bhk: number[];
  unitsCount: number;
}

const toPositiveNumber = (value: unknown): number | null => {
  if (value === null || value === undefined || value === '') return null;
  const num = Number(value);
  if (!Number.isFinite(num) || num <= 0) return null;
  return num;
};

export function computeProjectRanges(units: any[] | null | undefined): ProjectRanges {
  const empty: ProjectRanges = { minPrice: null, maxPrice: null, minArea: null, maxArea: null, bhk: [], unitsCount: 0 };
  if (!units || units.length === 0) return empty;
  const available = units.filter((u) => !u.status || u.status === 'available');
  if (available.length === 0) return empty;
  const prices = available.map((u) => toPositiveNumber(u.price)).filter((n): n is number => n !== null);
  const areas = available
    .map((u) => toPositiveNumber(u.builtupAreaSqft ?? u.builtUpArea ?? u.carpetAreaSqft ?? u.carpetArea ?? u.superBuiltupAreaSqft))
    .filter((n): n is number => n !== null);
  const bhk = Array.from(
    new Set(
      available
        .map((u) => Number(u.bedrooms))
        .filter((n) => Number.isInteger(n) && n > 0),
    ),
  ).sort((a, b) => a - b);
  return {
    minPrice: prices.length ? Math.min(...prices) : null,
    maxPrice: prices.length ? Math.max(...prices) : null,
    minArea: areas.length ? Math.min(...areas) : null,
    maxArea: areas.length ? Math.max(...areas) : null,
    bhk,
    unitsCount: available.length,
  };
}

export function formatPrice(price: number | null | undefined): string {
  if (!price) return '-';
  if (price >= 10000000) return `₹${(price / 10000000).toFixed(2)} Cr`;
  if (price >= 100000) return `₹${(price / 100000).toFixed(2)} L`;
  return `₹${price.toLocaleString('en-IN')}`;
}

export function formatPriceRange(min: number | null, max: number | null): string {
  if (min == null && max == null) return '-';
  if (min != null && max != null && min !== max) return `${formatPrice(min)} - ${formatPrice(max)}`;
  return formatPrice(min ?? max);
}
