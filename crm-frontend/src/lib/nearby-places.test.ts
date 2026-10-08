import { afterEach, describe, expect, it, vi } from "vitest";
import { fetchPostalCode } from "./nearby-places";

afterEach(() => {
  vi.unstubAllGlobals();
});

function mockGeocode(results: unknown) {
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => ({
      ok: true,
      json: async () => ({ results }),
    }))
  );
}

describe("fetchPostalCode", () => {
  it("returns the postal code from coordinates", async () => {
    mockGeocode([
      {
        address_components: [
          { long_name: "600001", types: ["postal_code"] },
          { long_name: "Chennai", types: ["locality", "political"] },
        ],
      },
    ]);
    await expect(fetchPostalCode(13.0827, 80.2707, "key")).resolves.toBe("600001");
  });

  it("scans past results without a postal component", async () => {
    mockGeocode([
      { address_components: [{ long_name: "Chennai", types: ["locality"] }] },
      { address_components: [{ long_name: "600002", types: ["postal_code"] }] },
    ]);
    await expect(fetchPostalCode(13.0827, 80.2707, "key")).resolves.toBe("600002");
  });

  it("returns null when no postal code exists", async () => {
    mockGeocode([{ address_components: [] }]);
    await expect(fetchPostalCode(0, 0, "key")).resolves.toBeNull();
  });

  it("throws when geocoding fails", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({ ok: false }))
    );
    await expect(fetchPostalCode(13.0827, 80.2707, "key")).rejects.toThrow();
  });
});
