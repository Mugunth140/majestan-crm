import { describe, expect, it } from "vitest";
import { formatBytes, parseAddresses } from "./mail-api";

describe("composer helpers", () => {
  it("splits Cc input on commas, semicolons and spaces, lowercases and de-duplicates", () => {
    expect(parseAddresses(" A@x.com, b@y.co.in; a@x.com  c@z.com")).toEqual({ valid: ["a@x.com", "b@y.co.in", "c@z.com"], invalid: [] });
    expect(parseAddresses("good@x.com, not-an-email, @x.com")).toEqual({ valid: ["good@x.com"], invalid: ["not-an-email", "@x.com"] });
    expect(parseAddresses("")).toEqual({ valid: [], invalid: [] });
  });

  it("formats attachment sizes", () => {
    expect(formatBytes(512)).toBe("512 B");
    expect(formatBytes(2048)).toBe("2 KB");
    expect(formatBytes(3.5 * 1024 * 1024)).toBe("3.5 MB");
  });
});
