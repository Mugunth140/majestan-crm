// @vitest-environment jsdom
import { createElement } from "react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  within,
  waitFor,
} from "@testing-library/react";
const mock = vi.hoisted(() => ({
  router: { push: vi.fn() },
  formData: vi.fn(),
}));
vi.mock("next/navigation", () => ({ useRouter: () => mock.router }));
vi.mock("@/components/layout/mobile-header", () => ({
  MobileHeader: () => null,
}));
vi.mock("@/lib/permissions", () => ({ canViewPropertyContacts: () => true }));
vi.mock("@/lib/properties-api", () => ({
  propertiesApi: { formData: mock.formData },
}));
vi.mock("@/lib/nearby-places", () => ({
  fetchNearbyCategories: vi.fn(async () => []),
  fetchPostalCode: vi.fn(),
  resolveCenterFromText: vi.fn(),
}));
import { PropertyForm } from "./PropertyForm";
beforeEach(() => {
  localStorage.clear();
  sessionStorage.clear();
  vi.stubGlobal(
    "ResizeObserver",
    class {
      observe() {}
      unobserve() {}
      disconnect() {}
    },
  );
  Object.defineProperty(window, "matchMedia", {
    configurable: true,
    value: vi.fn(() => ({
      matches: false,
      addEventListener() {},
      removeEventListener() {},
    })),
  });
  mock.formData.mockResolvedValue({
    propertyTypes: [
      { value: "apartment", label: "Apartment" },
      { value: "villa", label: "Villa" },
      { value: "commercial", label: "Commercial" },
      { value: "coworking", label: "Co-working" },
      { value: "farm_house", label: "Farmhouse" },
      { value: "farm_house", label: "Farm House" },
    ],
    furnishings: [{ id: 1, name: "Desk" }],
    cities: [],
    sublocations: [],
  });
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});
async function open() {
  const result = render(createElement(PropertyForm, { mode: "create" }));
  await screen.findByText("Add New Property");
  return result;
}
async function choose(container: HTMLElement, text: string) {
  const field = container.querySelector("#pf-propertyType")!;
  fireEvent.keyDown(within(field as HTMLElement).getByRole("combobox"), {
    key: "ArrowDown",
  });
  const option = await screen.findByRole("option", {
    name: new RegExp(`^${text}$`, "i"),
  });
  fireEvent.pointerDown(option, { pointerType: "mouse", button: 0 });
  fireEvent.click(option);
  await waitFor(() =>
    expect(
      within(field as HTMLElement).getByRole("combobox").textContent,
    ).toMatch(new RegExp(text, "i")),
  );
}
it("loads the create form and clears an incompatible real dropdown safely", async () => {
  const { container } = await open();
  fireEvent.click(screen.getByRole("button", { name: "Rent", exact: true }));
  await choose(container, "Co-working");
  await waitFor(() => expect(screen.queryByText("Monthly rent *")).toBeNull());
  expect(screen.getByText("Furnishing Items")).toBeTruthy();
  fireEvent.click(screen.getByRole("button", { name: "Buy", exact: true }));
  expect(
    screen.getByText("Select a type to see the relevant property fields."),
  ).toBeTruthy();
  expect(
    within(
      container.querySelector("#pf-propertyType") as HTMLElement,
    ).getByRole("combobox").textContent,
  ).toContain("Select Type");
});
it("recalculates sale rates from the actual price and area controls", async () => {
  const { container } = await open();
  await choose(container, "Apartment");
  fireEvent.change(screen.getByLabelText("Sale price *"), {
    target: { value: "50L" },
  });
  fireEvent.change(
    screen.getByRole("spinbutton", { name: /^built Up Area$/i }),
    { target: { value: "1000" } },
  );
  expect(
    (screen.getByLabelText("Calculated price per area") as HTMLInputElement)
      .value,
  ).toBe("5000.00");
  fireEvent.change(screen.getByLabelText("Individual bathrooms"), {
    target: { value: "2" },
  });
  fireEvent.change(screen.getByLabelText("Attached bathrooms"), {
    target: { value: "1" },
  });
  expect(screen.getByText("Total bathrooms: 3")).toBeTruthy();
});
it("does not offer the duplicate Farmhouse master label", async () => {
  const { container } = await open();
  const field = container.querySelector("#pf-propertyType")!;
  fireEvent.keyDown(within(field as HTMLElement).getByRole("combobox"), {
    key: "ArrowDown",
  });
  expect(
    await screen.findByRole("option", { name: "Farm House", exact: true }),
  ).toBeTruthy();
  expect(
    screen.queryByRole("option", { name: "Farmhouse", exact: true }),
  ).toBeNull();
});
