// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { PropertyWorkspace } from "./property-workspace";
import { apiFetch, apiJson } from "@/lib/api-fetch";
vi.mock("@/lib/api-fetch", () => ({ apiJson: vi.fn(), apiFetch: vi.fn() }));
vi.mock("./inventory-records", () => ({
  InventoryRecordsDialog: ({
    filters,
  }: {
    filters: Record<string, string> | null;
  }) => (filters ? <p role="dialog">{filters.city}</p> : null),
  ListingInsightsDialog: () => null,
  ListingCompareDialog: () => null,
}));
vi.mock("@/components/shared/form-select", () => ({
  SearchableFormSelect: ({
    name,
    value,
    options,
    onValueChange,
    disabled,
  }: {
    name: string;
    value: string;
    options: { label: string; value: string }[];
    onValueChange: (s: string) => void;
    disabled: boolean;
  }) => (
    <select
      aria-label={name}
      value={value}
      disabled={disabled}
      onChange={(e) => onValueChange(e.target.value)}
    >
      {options.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </select>
  ),
}));
const from = "2026-11-01",
  to = "2026-11-07";
const report = {
  version: 2,
  filters: {},
  timezone: "UTC",
  snapshotAt: "2026-11-06T00:00:00Z",
  sources: {
    inventory: "available",
    traffic: "unavailable",
    enquiries: "available",
    history: "available",
  },
  coverage: {
    trafficFrom: null,
    historyMessage: null,
    historyFrom: "2026-11-06",
    unmatchedViews: 0,
  },
  metrics: [{ key: "properties", label: "Current properties", value: 948 }],
  charts: [
    {
      key: "city",
      title: "Inventory by city",
      type: "bar",
      rows: ["Chennai", "Madurai", "Salem", "Trichy", "Erode", "Vellore"].map((label, i) => ({ label, value: 6 - i, match: { city: label } })),
    },
    { key: "attention", title: "Attention by issue", type: "bar", rows: [{ label: "Missing price", value: 3 }] },
    { key: "empty", title: "Nothing here", type: "bar", rows: [{ label: "A", value: 0 }] },
  ],
  issues: [{ key: "missing_price", label: "Missing applicable price", value: 3, match: { issue: "missing_price" } }],
  selectionRequired: null,
  records: { total: 948, items: [] },
};
beforeEach(() => {
  vi.mocked(apiJson).mockImplementation(async (input) => ({
    data: String(input).includes("/options?")
      ? { city: ["Chennai"], type: ["apartment"] }
      : report,
  }));
  vi.mocked(apiFetch).mockResolvedValue({ ok: true } as Response);
});
afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});
describe("Property Insights workspace", () => {
  it("renders dashboard tiles, useful charts and the attention queue", async () => {
    render(<PropertyWorkspace from={from} to={to} />);
    expect(await screen.findByText("Current properties")).toBeTruthy();
    expect(screen.getByText("Some data is missing: traffic: unavailable")).toBeTruthy();
    expect(screen.getByText("Inventory by city")).toBeTruthy();
    expect(screen.queryByText("Attention by issue")).toBeNull();
    expect(screen.queryByText("Nothing here")).toBeNull();
    expect(screen.getByText("Attention queue")).toBeTruthy();
    expect(screen.queryByText(/matching records/i)).toBeNull();
  });
  it("has no refresh or Excel buttons", async () => {
    render(<PropertyWorkspace from={from} to={to} />);
    await screen.findByText("Current properties");
    expect(screen.queryByRole("button", { name: /refresh/i })).toBeNull();
    expect(screen.queryByRole("button", { name: /excel/i })).toBeNull();
    expect(apiFetch).not.toHaveBeenCalled();
  });
  it("has five sections and requests section-specific reports", async () => {
    render(<PropertyWorkspace from={from} to={to} />);
    await screen.findByText("Current properties");
    const nav = screen.getByRole("navigation", { name: "Property Insights sections" });
    expect(within(nav).getAllByRole("button")).toHaveLength(5);
    fireEvent.click(within(nav).getByRole("button", { name: "Projects", exact: true }));
    await waitFor(() =>
      expect(vi.mocked(apiJson).mock.calls.some(([u]) => String(u).includes("section=projects") && String(u).includes("kind=project"))).toBe(true),
    );
  });
  it("drills a chart row into the listings behind it", async () => {
    render(<PropertyWorkspace from={from} to={to} />);
    fireEvent.click(await screen.findByRole("button", { name: "Open Chennai" }));
    expect(screen.getByRole("dialog").textContent).toBe("Chennai");
  });
  it("opens the attention queue rows as listings", async () => {
    render(<PropertyWorkspace from={from} to={to} />);
    fireEvent.click(await screen.findByRole("button", { name: /Missing applicable price/ }));
    expect(screen.getByRole("dialog")).toBeTruthy();
  });
  it("keeps every filter behind the Filters button", async () => {
    render(<PropertyWorkspace from={from} to={to} />);
    await screen.findByText("Current properties");
    expect(screen.queryByLabelText("inventory-city")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: /Filters/ }));
    fireEvent.change(await screen.findByLabelText("inventory-city"), { target: { value: "Chennai" } });
    await waitFor(() =>
      expect(vi.mocked(apiJson).mock.calls.some(([u]) => String(u).includes("/report?") && String(u).includes("city=Chennai") && String(u).includes("from=2026-11-01") && String(u).includes("to=2026-11-07"))).toBe(true),
    );
  });
});
