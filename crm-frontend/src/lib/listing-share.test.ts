import { describe, expect, it } from "vitest";
import {
  listingHref,
  listingUrl,
  parseShare,
  whatsappMessage,
} from "./listing-share";

describe("listing-share", () => {
  it("links listings to their CRM and website pages", () => {
    expect(listingHref({ kind: "property", id: 4 })).toBe("/properties/4");
    expect(listingHref({ kind: "project", id: 6 })).toBe("/projects/6");
    expect(listingUrl("property", "delite-building-cs2775")).toBe(
      "https://www.majestanrealty.com/property/delite-building-cs2775",
    );
    expect(listingUrl("project", "emerald-heights-coimbatore-pa0006")).toBe(
      "https://www.majestanrealty.com/emerald-heights-coimbatore-pa0006",
    );
    expect(listingUrl("project", null)).toBeNull();
  });

  it("writes the WhatsApp message with each listing and its link", () => {
    const text = whatsappMessage("Pam Beesly", [
      {
        kind: "property",
        id: 1,
        code: "CS1",
        title: "Delite Building",
        subtitle: "Commercial · Puliakulam",
        price: "₹1.04 L/mo",
        url: "https://x.test/p",
      },
      { kind: "project", id: 2, code: "PA2", title: "Emerald Heights" },
    ]);
    expect(text).toContain("Hi Pam,");
    expect(text).toContain(
      "1. *Delite Building* – Commercial · Puliakulam · ₹1.04 L/mo\nhttps://x.test/p",
    );
    expect(text).toContain("2. *Emerald Heights*");
    expect(text).toContain("a few options");
  });

  it("reads stored shares and ignores anything malformed", () => {
    expect(
      parseShare(
        '[{"kind":"project","id":6,"code":"PA6","title":"E"},{"kind":"car","id":1}]',
      ),
    ).toEqual([{ kind: "project", id: 6, code: "PA6", title: "E" }]);
    expect(parseShare("not json")).toEqual([]);
    expect(parseShare(null)).toEqual([]);
  });
});
