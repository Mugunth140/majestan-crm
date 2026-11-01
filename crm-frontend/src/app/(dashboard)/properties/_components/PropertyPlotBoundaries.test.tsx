import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { expect, it } from "vitest";
import {
  PropertyPlotBoundaries,
  emptyPlotBoundaries,
} from "./PropertyPlotBoundaries";
function highlighted(facing?: string, directions?: string[]) {
  const value = emptyPlotBoundaries().map((side, i) => ({
    ...side,
    direction: directions?.[i] ?? side.direction,
  }));
  const markup = renderToStaticMarkup(
    createElement(PropertyPlotBoundaries, { value, facing, readOnly: true }),
  );
  return {
    markup,
    sides: [
      ...markup.matchAll(
        /data-boundary-direction="([^"]+)" data-facing="true"/g,
      ),
    ].map((match) => match[1]),
  };
}
it("highlights the facing boundary by direction rather than row order", () => {
  const result = highlighted("South", ["South", "West", "North", "East"]);
  expect(result.sides).toEqual(["South"]);
  expect(result.markup).toContain("Boundary legend");
  expect(result.markup).toContain("Plot facing: South");
  expect(result.markup).toContain("Other boundaries");
});
it("highlights the two cardinal sides for a diagonal facing", () => {
  expect(highlighted("North East").sides).toEqual(["North", "East"]);
});
it("prefers an exact diagonal boundary when present", () => {
  expect(
    highlighted("North East", ["North East", "East", "South", "West"]).sides,
  ).toEqual(["North East"]);
});
it("does not highlight anything without a facing or a matching side", () => {
  expect(highlighted().sides).toEqual([]);
  expect(
    highlighted("South", ["North", "East", "North East", "West"]).sides,
  ).toEqual([]);
});
