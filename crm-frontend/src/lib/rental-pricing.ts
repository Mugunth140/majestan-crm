/** Derived from saved rent and area so the rate never becomes stale. */
export function calculateRentPerSqft(monthlyRent: number, area: number, unit = "Sq Ft"): number | null {
  const factors: Record<string, number> = { "Sq Ft": 1, "Sq M": 1 / (0.3048 ** 2), Acres: 43560, Cents: 435.6, Grounds: 2400 };
  const factor = factors[unit];
  if (!factor || !Number.isFinite(monthlyRent) || !Number.isFinite(area) || monthlyRent <= 0 || area <= 0) return null;
  const rate = monthlyRent / (area * factor);
  return Number.isFinite(rate) && rate > 0 ? rate : null;
}
