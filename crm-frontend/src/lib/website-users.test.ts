import { describe, expect, it } from "vitest";
import { matchesWebsiteUser, type WebsiteUser } from "./website-users";

const user: WebsiteUser = {
  id: 1, name: "Priya S", email: "priya@x.in", phone: "+91 98765 43210", verified: true,
  registeredAt: "2026-11-01T10:00:00Z", wishlistCount: 2, enquiryCount: 1, lastEnquiryAt: null,
  lead: { id: 4206, displayId: "L04206", status: "New Lead", staff: "Abarna" },
};

describe("matchesWebsiteUser", () => {
  it("matches name, email and lead ID", () => {
    expect(matchesWebsiteUser(user, "priya")).toBe(true);
    expect(matchesWebsiteUser(user, "x.in")).toBe(true);
    expect(matchesWebsiteUser(user, "l04206")).toBe(true);
  });
  it("matches the mobile whatever its format", () => {
    expect(matchesWebsiteUser(user, "98765 432")).toBe(true);
    expect(matchesWebsiteUser(user, "+919876543210")).toBe(true);
    expect(matchesWebsiteUser(user, "12345")).toBe(false);
  });
  it("shows everyone for an empty search", () => expect(matchesWebsiteUser(user, "  ")).toBe(true));
});
