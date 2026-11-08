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
vi.mock("./inventory-chart", () => ({
  InventoryChart: ({
    spec,
    onDrill,
  }: {
    spec: { title: string };
    onDrill: (f: Record<string, string>, s: string) => void;
  }) => (
    <button onClick={() => onDrill({ city: "Chennai" }, spec.title)}>
      {spec.title}
    </button>
  ),
}));
vi.mock("./inventory-records", () => ({
  InventoryRecordTable: () => <p>Inventory records</p>,
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
      rows: [{ label: "Chennai", value: 2, match: { city: "Chennai" } }],
    },
  ],
  issues: [],
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
  it("keeps inventory usable with unavailable traffic and exposes source status", async () => {
    render(<PropertyWorkspace from={from} to={to} />);
    expect(await screen.findByText("948")).toBeTruthy();
    expect(screen.getByText("traffic: unavailable")).toBeTruthy();
    expect(screen.getByText("Inventory by city")).toBeTruthy();
  });
  it("has six focused sections and requests section-specific reports", async () => {
    render(<PropertyWorkspace from={from} to={to} />);
    await screen.findByText("948");
    const nav = screen.getByRole("navigation", {
      name: "Property Insights sections",
    });
    expect(within(nav).getAllByRole("button")).toHaveLength(6);
    fireEvent.click(
      within(nav).getByRole("button", { name: "Projects", exact: true }),
    );
    await waitFor(() =>
      expect(
        vi
          .mocked(apiJson)
          .mock.calls.some(
            ([u]) =>
              String(u).includes("section=projects") &&
              String(u).includes("kind=project"),
          ),
      ).toBe(true),
    );
  });
  it("uses server filters for chart drill-downs", async () => {
    render(<PropertyWorkspace from={from} to={to} />);
    fireEvent.click(await screen.findByText("Inventory by city"));
    expect(screen.getByRole("dialog").textContent).toBe("Chennai");
  });
  it("applies searchable city and UTC range filters together", async () => {
    render(<PropertyWorkspace from={from} to={to} />);
    await screen.findByText("948");
    fireEvent.change(screen.getByLabelText("inventory-city"), {
      target: { value: "Chennai" },
    });
    await waitFor(() =>
      expect(
        vi
          .mocked(apiJson)
          .mock.calls.some(
            ([u]) =>
              String(u).includes("/report?") &&
              String(u).includes("city=Chennai") &&
              String(u).includes("from=2026-11-01") &&
              String(u).includes("to=2026-11-07"),
          ),
      ).toBe(true),
    );
  });
  it("refreshes the server read model explicitly", async () => {
    render(<PropertyWorkspace from={from} to={to} />);
    await screen.findByText("948");
    fireEvent.click(screen.getByRole("button", { name: "Refresh inventory" }));
    await waitFor(() =>
      expect(apiFetch).toHaveBeenCalledWith(
        "/api/v1/site-analytics/property-insights/v2/refresh",
        { method: "POST" },
      ),
    );
  });
});
