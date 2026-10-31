export const AREA_UNIT_OPTIONS = [
  { value: "Sq Ft", label: "Sqft" },
  { value: "Sq M", label: "Sqm" },
  { value: "Cents", label: "Cents" },
  { value: "Acres", label: "Acres" },
  { value: "Grounds", label: "Grounds" },
];
export const AREA_FACTORS: Record<string, number> = {
  "Sq Ft": 1,
  "Sq M": 1 / 0.3048 ** 2,
  Cents: 435.6,
  Acres: 43560,
  Grounds: 2400,
};
export function convertArea(
  value: string | number,
  from: string,
  to: string,
): string {
  if (
    String(value).trim() === "" ||
    !Number.isFinite(Number(value)) ||
    !AREA_FACTORS[from] ||
    !AREA_FACTORS[to]
  )
    return String(value);
  return String(
    Number(
      ((Number(value) * AREA_FACTORS[from]) / AREA_FACTORS[to]).toFixed(8),
    ),
  );
}
export function areaInSqft(
  value: string | number,
  unit = "Sq Ft",
): number | undefined {
  if (
    String(value).trim() === "" ||
    !Number.isFinite(Number(value)) ||
    !AREA_FACTORS[unit]
  )
    return undefined;
  return Number(value) * AREA_FACTORS[unit];
}
export function initialArea(
  value: unknown,
  field: string,
  units: Record<string, string>,
  base = "Sq Ft",
): string {
  return value == null
    ? ""
    : convertArea(String(value), base, units[field] || base);
}

export function convertRate(
  value: string | number,
  from: string,
  to: string,
): number | undefined {
  const number = Number(value);
  return String(value).trim() &&
    Number.isFinite(number) &&
    AREA_FACTORS[from] &&
    AREA_FACTORS[to]
    ? (number * AREA_FACTORS[to]) / AREA_FACTORS[from]
    : undefined;
}
export const rateLabel = (unit: string) =>
  ({
    "Sq Ft": "sqft",
    "Sq M": "sqm",
    Cents: "cent",
    Acres: "acre",
    Grounds: "ground",
  })[unit] || unit;

/** Legacy Plot Area used the general unit; only metadata marks canonical sqft. */
export function restorePlotArea(value: unknown, genericUnit: string, units: Record<string, string>) {
  const unit = units.plotArea || (AREA_FACTORS[genericUnit] ? genericUnit : "Sq Ft");
  return {
    unit: value == null && !units.plotArea ? "Sq Ft" : unit,
    value: value == null ? "" : units.plotArea ? initialArea(value, "plotArea", units) : String(value),
  };
}
