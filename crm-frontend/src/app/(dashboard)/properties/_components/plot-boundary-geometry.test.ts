import { expect, it } from "vitest";
import { plotBoundaryGeometry } from "./plot-boundary-geometry";
const sides = (lengths: string[], unit = "ft") =>
  lengths.map((length) => ({ length, unit }));
it("keeps every side proportional to the entered lengths", () => {
  const lengths = [40, 50, 70, 60];
  const result = plotBoundaryGeometry(sides(lengths.map(String)));
  expect(result.invalid).toBe(false);
  const edges = result.corners.map((point, i) =>
    Math.hypot(
      point[0] - result.corners[(i + 1) % 4][0],
      point[1] - result.corners[(i + 1) % 4][1],
    ),
  );
  edges.forEach((edge, i) =>
    expect(edge / edges[0]).toBeCloseTo(lengths[i] / lengths[0], 6),
  );
});
it("changes the shape immediately for changed lengths", () => {
  expect(
    plotBoundaryGeometry(sides(["40", "60", "40", "60"])).corners,
  ).not.toEqual(plotBoundaryGeometry(sides(["60", "60", "40", "60"])).corners);
});
it("gives equivalent geometry for mixed feet and metres", () => {
  const original = sides(["100", "150", "100", "150"]);
  const mixed = original.map((side, i) =>
    i % 2 ? side : { length: "30.48", unit: "m" },
  );
  const a = plotBoundaryGeometry(original),
    b = plotBoundaryGeometry(mixed);
  a.corners.forEach((point, i) =>
    point.forEach((n, axis) => expect(n).toBeCloseTo(b.corners[i][axis], 6)),
  );
});
it("handles empty, partial and invalid numeric input without nonfinite coordinates", () => {
  for (const values of [
    ["", "", "", ""],
    ["45", "", "", ""],
    ["0", "NaN", "-1", "Infinity"],
  ]) {
    const result = plotBoundaryGeometry(sides(values));
    expect(result.complete).toBe(false);
    expect(result.corners.flat().every(Number.isFinite)).toBe(true);
  }
});
it("rejects impossible or degenerate quadrilaterals", () => {
  expect(plotBoundaryGeometry(sides(["500", "10", "10", "10"])).invalid).toBe(
    true,
  );
  expect(plotBoundaryGeometry(sides(["30", "10", "10", "10"])).invalid).toBe(
    true,
  );
});
