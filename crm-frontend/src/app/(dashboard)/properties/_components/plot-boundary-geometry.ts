export type PlotPoint = [number, number];
const fallback: PlotPoint[] = [
  [100, 75],
  [300, 75],
  [300, 225],
  [100, 225],
];

/** Four lengths need an angle to determine a unique survey outline. Use a
 * convex cyclic quadrilateral as a stable, proportional illustrative shape. */
export function plotBoundaryGeometry(
  sides: readonly { length: string; unit: string }[],
) {
  const lengths = sides.map((side) => {
    const n = Number(side.length);
    return side.length.trim() && Number.isFinite(n) && n > 0
      ? n * (side.unit === "m" ? 1 : 0.3048)
      : null;
  });
  const known = lengths.filter((n): n is number => n != null);
  const complete = known.length === 4;
  if (!known.length) return { corners: fallback, complete, invalid: false };
  // Normalize before squaring so large entries cannot overflow geometry.
  const maximum = Math.max(...known);
  const average = known.reduce((sum, n) => sum + n / maximum, 0) / known.length;
  const [a, b, c, d] = lengths.map((n) => (n == null ? average : n / maximum));
  if (Math.max(a, b, c, d) >= (a + b + c + d) / 2 - 1e-10)
    return { corners: fallback, complete, invalid: true };
  const diagonal = Math.sqrt(
    ((a * c + b * d) * (a * d + b * c)) / (a * b + c * d),
  );
  const xB = (a * a + diagonal * diagonal - b * b) / (2 * diagonal);
  const yB = -Math.sqrt(Math.max(0, a * a - xB * xB));
  const xD = (d * d + diagonal * diagonal - c * c) / (2 * diagonal);
  const yD = Math.sqrt(Math.max(0, d * d - xD * xD));
  const angle = -Math.atan2(yB, xB);
  const points: PlotPoint[] = [
    [0, 0],
    [xB, yB],
    [diagonal, 0],
    [xD, yD],
  ];
  const rotated = points.map(
    ([x, y]): PlotPoint => [
      x * Math.cos(angle) - y * Math.sin(angle),
      x * Math.sin(angle) + y * Math.cos(angle),
    ],
  );
  const xs = rotated.map((p) => p[0]),
    ys = rotated.map((p) => p[1]);
  const width = Math.max(...xs) - Math.min(...xs),
    height = Math.max(...ys) - Math.min(...ys);
  const scale = Math.min(220 / width, 150 / height);
  const midX = (Math.min(...xs) + Math.max(...xs)) / 2,
    midY = (Math.min(...ys) + Math.max(...ys)) / 2;
  const corners = rotated.map(
    ([x, y]): PlotPoint => [200 + (x - midX) * scale, 150 + (y - midY) * scale],
  );
  return { corners, complete, invalid: false };
}
