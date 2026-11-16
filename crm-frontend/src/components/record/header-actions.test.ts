import { describe, expect, it } from "vitest";
import { telHref } from "./header-actions";

describe("telHref", () => {
  it("dials the digits of a stored number", () => {
    expect(telHref("98765 43210")).toBe("tel:9876543210");
    expect(telHref("+91 98765-43210")).toBe("tel:+919876543210");
  });

  it("offers no call without a number", () => {
    expect(telHref("")).toBeNull();
    expect(telHref(null)).toBeNull();
    expect(telHref("—")).toBeNull();
  });
});
