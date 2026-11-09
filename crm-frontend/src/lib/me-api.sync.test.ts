// @vitest-environment jsdom
import { describe, expect, it, vi } from "vitest";
import { syncStoredUser } from "./me-api";

describe("syncStoredUser", () => {
  it("saves the new photo and tells the sidebar and staff photos", () => {
    window.localStorage.setItem("crm_user", JSON.stringify({ id: 17, name: "Test User", avatar_url: null }));
    const heard = vi.fn();
    window.addEventListener("crm-user-updated", heard);
    syncStoredUser({ avatar_url: "/avatars/critters/97d72d26ee.svg" });
    expect(JSON.parse(window.localStorage.getItem("crm_user")!).avatar_url).toBe("/avatars/critters/97d72d26ee.svg");
    expect(heard).toHaveBeenCalledTimes(1);
  });
});
