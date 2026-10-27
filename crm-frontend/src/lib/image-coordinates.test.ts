import { describe, expect, it } from "vitest";
import { readStoredCoordinates } from "./image-coordinates";

describe("saved inbound coordinates", () => {
  it("loads saved decimal strings and preserves zero coordinates", () => {
    expect(readStoredCoordinates({ latitude: 0, longitude: "76.9558000" }))
      .toEqual({ latitude: "0", longitude: "76.9558000" });
  });

  it("loads coordinates from legacy Maps links", () => {
    expect(readStoredCoordinates({ google_map_location: "https://www.google.com/maps?q=-11.5,76.9" }))
      .toEqual({ latitude: "-11.5", longitude: "76.9" });
  });

  it("leaves coordinates empty for absent or shortened links", () => {
    expect(readStoredCoordinates({ google_map_location: "https://maps.app.goo.gl/example" }))
      .toEqual({ latitude: "", longitude: "" });
  });
});
