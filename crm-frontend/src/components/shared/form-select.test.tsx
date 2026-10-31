// @vitest-environment jsdom
import { createElement, type ReactNode, useState } from "react";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { isPropertyFieldVisible } from "@/app/(dashboard)/properties/_components/property-form-fields";

// Model Base UI's nullable single-select callback, including an empty selection.
vi.mock("@/components/ui/select", () => ({
  Select: ({ children, onValueChange }: { children: ReactNode; onValueChange: (value: string | null) => void }) => createElement("div", null,
    children,
    createElement("button", { onClick: () => onValueChange(null) }, "Clear selection"),
    createElement("button", { onClick: () => onValueChange("commercial") }, "Select commercial")),
  SelectTrigger: ({ children }: { children: ReactNode }) => createElement("div", null, children),
  SelectValue: () => null,
  SelectContent: () => null,
  SelectItem: () => null,
}));

import { FormSelect } from "./form-select";

afterEach(cleanup);

it("keeps the property form's state a string after a nullable dropdown event", () => {
  function PropertySelection() {
    const [type, setType] = useState("apartment");
    const hasSaleFields = isPropertyFieldVisible("reraNumber", type, "Buy");
    return createElement("div", null,
      createElement(FormSelect, { name: "propertyType", placeholder: "Select type", options: [], value: type, onValueChange: setType }),
      createElement("output", null, JSON.stringify(type)),
      hasSaleFields && createElement("p", null, "Sale fields available"));
  }
  render(createElement(PropertySelection));
  fireEvent.click(screen.getByRole("button", { name: "Clear selection" }));
  expect(screen.getByRole("status").textContent).toBe('""');
  expect(screen.getByText("Sale fields available")).toBeTruthy();
  fireEvent.click(screen.getByRole("button", { name: "Select commercial" }));
  expect(screen.getByRole("status").textContent).toBe('"commercial"');
});
