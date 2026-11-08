// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  cleanup,
  fireEvent,
  render as renderComponent,
  screen,
  within,
} from "@testing-library/react";
import {
  PageActionsProvider,
  PageActionsSlot,
} from "@/components/layout/page-actions";
import { SiteAnalyticsDashboard } from "./dashboard";
import { useSiteAnalytics } from "./use-site-analytics";
import { analyticsFixture } from "./test-fixtures";

function render(ui: React.ReactNode) {
  return renderComponent(
    <PageActionsProvider>
      <header aria-label="Page toolbar">
        <PageActionsSlot />
      </header>
      {ui}
    </PageActionsProvider>,
  );
}

vi.mock("./use-site-analytics", () => ({ useSiteAnalytics: vi.fn() }));
vi.mock("@/components/ui/dialog", () => ({
  Dialog: ({ open, children }: { open: boolean; children: React.ReactNode }) =>
    open ? <div role="dialog">{children}</div> : null,
  DialogContent: ({ children }: { children: React.ReactNode }) => (
    <div>{children}</div>
  ),
  DialogHeader: ({ children }: { children: React.ReactNode }) => (
    <div>{children}</div>
  ),
  DialogTitle: ({ children }: { children: React.ReactNode }) => (
    <h2>{children}</h2>
  ),
  DialogDescription: ({ children }: { children: React.ReactNode }) => (
    <p>{children}</p>
  ),
}));
beforeEach(() => {
  sessionStorage.clear();
  localStorage.clear();
  const report = analyticsFixture();
  vi.mocked(useSiteAnalytics).mockReturnValue({
    report,
    previous: { ...report, overview: { ...report.overview, visitors: 100 } },
    loading: false,
    error: null,
    comparisonError: null,
    liveError: false,
    key: "test",
    refresh: vi.fn(),
  });
});
afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});
describe("website analytics dashboard", () => {
  it("shows traffic KPIs, UTC, visitor-day disclosure and ranked panels", () => {
    render(<SiteAnalyticsDashboard />);
    expect(screen.queryByText("unique visitor-days")).toBeNull();
    expect(screen.getByText("25%")).toBeTruthy();
    expect(screen.getByText("1m 12s")).toBeTruthy();
    expect(
      within(screen.getByRole("banner", { name: "Page toolbar" })).getByText(
        "online",
      ),
    ).toBeTruthy();
    expect(screen.queryByText("Website analytics")).toBeNull();
    expect(screen.queryByText("majestanrealty.com")).toBeNull();
    expect(
      screen.queryByRole("button", { name: "Refresh analytics" }),
    ).toBeNull();
    expect(
      screen.getByRole("button", { name: /Daily pseudonyms/ }),
    ).toBeTruthy();
    expect(screen.getByText("9")).toBeTruthy();
    expect(screen.getByRole("button", { name: /Period:/ })).toBeTruthy();
  });
  it("opens all results and keeps unknown countries last", () => {
    render(<SiteAnalyticsDashboard />);
    fireEvent.click(screen.getByRole("button", { name: "View all 12" }));
    expect(
      within(screen.getByRole("dialog")).getByText("/property-12"),
    ).toBeTruthy();
    const countries = screen.getByRole("list", {
      name: "Countries: Countries",
    });
    expect(
      within(countries).getAllByRole("listitem").at(-1)?.textContent,
    ).toContain("Unknown");
  });
  it("shows honest Speed Insights when unavailable data cannot be derived", () => {
    render(<SiteAnalyticsDashboard />);
    fireEvent.click(screen.getByRole("tab", { name: "Speed Insights" }));
    expect(screen.getByText(/Field data from real visitors/)).toBeTruthy();
    expect(screen.getByText("Route breakdown unavailable")).toBeTruthy();
    expect(screen.getByText("2.3 s")).toBeTruthy();
    expect(screen.getAllByText(/split unavailable/).length).toBe(3);
  });
  it("persists the picked period, including the six-month preset", () => {
    render(<SiteAnalyticsDashboard />);
    fireEvent.click(screen.getByRole("button", { name: /Period:/ }));
    fireEvent.click(screen.getByRole("option", { name: "Last 6 months" }));
    expect(
      sessionStorage.getItem("crm_view:anon:site-analytics:range"),
    ).toContain('"180"');
  });
  it("explains a saved custom range that is too long", () => {
    sessionStorage.setItem(
      "crm_view:anon:site-analytics:range",
      JSON.stringify({ preset: "custom", from: "2024-01-01", to: "2026-11-06" }),
    );
    render(<SiteAnalyticsDashboard />);
    expect(screen.getByRole("alert").textContent).toContain("at most 366 days");
    expect(screen.getByRole("button", { name: /Period:/ }).textContent).toMatch(/2024/);
  });
  it("supports exact chart values with the keyboard", () => {
    render(<SiteAnalyticsDashboard />);
    fireEvent.keyDown(screen.getByRole("img", { name: /Daily visitors/ }), {
      key: "ArrowRight",
    });
    expect(screen.getByRole("status").textContent).toContain("25");
  });
  it("renders a skeleton, empty state and safe error reason", () => {
    const state = vi.mocked(useSiteAnalytics).mock.results[0]?.value;
    vi.mocked(useSiteAnalytics).mockReturnValue({
      ...(state ?? { refresh: vi.fn() }),
      report: null,
      previous: null,
      error: null,
      comparisonError: null,
      loading: true,
      liveError: false,
      key: "test",
    });
    const view = render(<SiteAnalyticsDashboard />);
    expect(screen.getByLabelText("Loading website analytics")).toBeTruthy();
    vi.mocked(useSiteAnalytics).mockReturnValue({
      report: null,
      previous: null,
      error: "Website analytics is not configured",
      loading: false,
      comparisonError: null,
      liveError: true,
      key: "test",
      refresh: vi.fn(),
    });
    view.rerender(<SiteAnalyticsDashboard />);
    expect(screen.getByRole("alert").textContent).toContain("not configured");
    const empty = analyticsFixture();
    empty.overview.pageviews = 0;
    empty.events = [];
    empty.performance = [];
    vi.mocked(useSiteAnalytics).mockReturnValue({
      report: empty,
      previous: null,
      error: null,
      loading: false,
      comparisonError: null,
      liveError: false,
      key: "test",
      refresh: vi.fn(),
    });
    view.rerender(<SiteAnalyticsDashboard />);
    expect(screen.getByText("No website activity in this range")).toBeTruthy();
  });
});
