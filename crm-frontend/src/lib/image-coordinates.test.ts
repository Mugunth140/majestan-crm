import { describe, expect, it, vi } from "vitest";
import { readImageCoordinates, readStoredCoordinates } from "./image-coordinates";

const { gps } = vi.hoisted(() => ({ gps: vi.fn() }));
vi.mock("exifr", () => ({ gps }));

describe("optional photo coordinates", () => {
  it.each([
    { latitude: 11.0168, longitude: 76.9558 },
    { latitude: -33.86, longitude: -151.2 },
    { latitude: 0, longitude: 0 },
  ])("reads valid GPS including negative and zero coordinates: %o", async (coordinates) => {
    gps.mockResolvedValueOnce(coordinates);
    expect(await readImageCoordinates(new Blob())).toEqual(coordinates);
  });

  it.each([undefined, {}, { latitude: 10 }, { latitude: NaN, longitude: 20 },
    { latitude: 91, longitude: 10 }, { latitude: 20, longitude: 181 }])(
    "does not require usable GPS metadata: %o", async (coordinates) => {
      gps.mockResolvedValueOnce(coordinates);
      expect(await readImageCoordinates(new Blob())).toBeNull();
    },
  );

  it("allows photos whose metadata parser fails", async () => {
    gps.mockRejectedValueOnce(new Error("Unsupported metadata"));
    expect(await readImageCoordinates(new Blob())).toBeNull();
  });

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
