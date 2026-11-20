// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { apiFetch } from "@/lib/api-fetch";
import { resetRoadNames } from "@/lib/road-names";
import { asksPropertyAge } from "@/lib/lead-constants";
import { RequirementFields } from "./lead-requirement";

vi.mock("@/lib/api-fetch", () => ({ apiFetch: vi.fn() }));

const ok = (data: unknown) => Promise.resolve({ json: () => Promise.resolve({ success: true, data }) } as Response);

beforeEach(() => {
  resetRoadNames();
  vi.mocked(apiFetch).mockImplementation((input) => {
    const url = String(input);
    if (url.includes("/master/road-names")) return ok([{ id: 1, label: "Avinashi Road", value: "Avinashi Road" }, { id: 2, label: "Trichy Road", value: "Trichy Road" }]);
    return ok([]);
  });
});
afterEach(() => { cleanup(); vi.clearAllMocks(); });

describe("RequirementFields road name and property age", () => {
  it("shows the saved road name and age bucket", () => {
    render(<RequirementFields canEdit={false} save={vi.fn()}
      inquiry={{ id: 1, property_category: "residential", property_type: "apartment", preferences: { roadName: "Trichy Road", propertyAge: "5-10" } }} />);
    expect(screen.getByText("Road name")).toBeTruthy();
    expect(screen.getByText("Trichy Road")).toBeTruthy();
    expect(screen.getByText("5–10 years")).toBeTruthy();
  });

  it("saves a road picked from the Master Registry list as a preference patch", async () => {
    const save = vi.fn(() => Promise.resolve());
    render(<RequirementFields canEdit save={save} inquiry={{ id: 1, property_category: "residential", preferences: {} }} />);
    await waitFor(() => expect(apiFetch).toHaveBeenCalledWith(expect.stringContaining("/master/road-names")));
    fireEvent.click(screen.getByRole("button", { name: "Road name" }));
    fireEvent.click(await screen.findByRole("option", { name: /Avinashi Road/ }));
    expect(save).toHaveBeenCalledWith({ preferencesPatch: { roadName: "Avinashi Road" } });
  });

  it("does not ask the age of land", () => {
    render(<RequirementFields canEdit={false} save={vi.fn()} inquiry={{ id: 1, property_category: "residential", property_type: "plot", preferences: {} }} />);
    expect(screen.queryByText("Property age")).toBeNull();
    expect(asksPropertyAge("agricultural", null)).toBe(false);
    expect(asksPropertyAge("commercial", "commercial_land")).toBe(false);
    expect(asksPropertyAge("commercial", "office")).toBe(true);
    expect(asksPropertyAge(null, null)).toBe(true);
  });
});
