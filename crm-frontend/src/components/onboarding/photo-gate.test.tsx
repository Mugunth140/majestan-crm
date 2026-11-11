// @vitest-environment jsdom
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const me = vi.hoisted(() => ({ avatar: null as string | null }));
vi.mock("@/lib/me-api", () => ({
  meApi: {
    get: vi.fn(async () => ({ id: 7, name: "Yazhini", avatar_url: me.avatar })),
    onboarding: vi.fn(async () => ({ welcomed_at: "2026-11-01", last_seen_version: "9.9.9" })),
    updateOnboarding: vi.fn(async () => ({})),
  },
  syncStoredUser: vi.fn(),
}));
import { Onboarding } from "./onboarding";

describe("profile picture gate", () => {
  beforeEach(() => { me.avatar = null; });
  afterEach(cleanup);

  it("asks a user without a picture to pick one, with no way to close it", async () => {
    render(<Onboarding />);
    await waitFor(() => expect(screen.getByText("Add your profile picture")).toBeTruthy());
    expect(screen.queryByRole("button", { name: /close/i })).toBeNull();
    expect(screen.getByRole("radiogroup", { name: "Profile picture" })).toBeTruthy();
  });

  it("leaves users with a picture alone", async () => {
    me.avatar = "/avatars/a1.svg";
    render(<Onboarding />);
    await new Promise((r) => setTimeout(r, 50));
    expect(screen.queryByText("Add your profile picture")).toBeNull();
  });
});
