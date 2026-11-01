// @vitest-environment jsdom
import { createElement, useState } from "react";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { PgAccommodationFields } from "./PgAccommodationFields";
import { pgPayload, restorePgDetails } from "./pg-accommodation";
beforeEach(() =>
  vi.stubGlobal(
    "ResizeObserver",
    class {
      observe() {}
      unobserve() {}
      disconnect() {}
    },
  ),
);
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});
function Form({ initial = {} }: { initial?: Record<string, unknown> }) {
  const [value, onChange] = useState(() => restorePgDetails(initial));
  return createElement(
    "div",
    null,
    createElement(PgAccommodationFields, {
      value,
      onChange,
      furnishingStatus: "FULLY FURNISHED",
    }),
    createElement(
      "output",
      { "data-testid": "payload" },
      JSON.stringify(pgPayload(value)),
    ),
  );
}
async function select(id: string, name: string) {
  fireEvent.keyDown(document.getElementById(id)!, { key: "ArrowDown" });
  const option = await screen.findByRole("option", { name: new RegExp(`^${name}$`, "i") });
  fireEvent.pointerDown(option, { pointerType: "mouse", button: 0 });
  fireEvent.click(option);
}
it("switches bed capacity to rooms and clears incompatible counts", async () => {
  render(
    createElement(Form, {
      initial: {
        roomType: "Sharing",
        sharingCount: 3,
        totalCapacity: 12,
        availableCapacity: 4,
      },
    }),
  );
  expect(screen.getByLabelText("People sharing the room")).toBeTruthy();
  await select("pg-roomType", "Private");
  expect(screen.queryByLabelText("People sharing the room")).toBeNull();
  expect(
    (screen.getByLabelText("Total rooms in PG") as HTMLInputElement).value,
  ).toBe("");
  expect(
    (screen.getByLabelText("Rooms available in PG") as HTMLInputElement).value,
  ).toBe("");
});
it("reveals meals and charges only while food is available", async () => {
  render(
    createElement(Form, {
      initial: {
        foodAvailable: "Available",
        foodChargeType: "Per meal basis",
        breakfastCharge: 50,
      },
    }),
  );
  expect(screen.getByLabelText("Breakfast charge")).toBeTruthy();
  await select("pg-foodAvailable", "Not Available");
  expect(screen.queryByLabelText("Breakfast charge")).toBeNull();
  expect(
    JSON.parse(screen.getByTestId("payload").textContent!),
  ).not.toHaveProperty("breakfastCharge");
});
it("preserves an explicit unchecked facility and saves a furnishing count", () => {
  render(createElement(Form, { initial: { attachedBathroom: false } }));
  fireEvent.click(screen.getByText("In room furnishings"));
  fireEvent.change(document.getElementById("pg-roomFurnishings-Beds")!, {
    target: { value: "2" },
  });
  expect(JSON.parse(screen.getByTestId("payload").textContent!)).toMatchObject({
    attachedBathroom: false,
    roomFurnishings: [{ item: "Beds", count: 2 }],
  });
});

it("places monthly food and early leaving amounts in their own sections once", () => {
  render(
    createElement(Form, {
      initial: {
        foodAvailable: "Available",
        foodChargeType: "Fixed monthly amount",
        foodMonthlyCharge: 3000,
        earlyLeavingType: "Fixed",
        earlyLeavingAmount: 500,
      },
    }),
  );
  const food = screen.getByLabelText("Monthly food charge");
  expect(screen.getAllByLabelText("Early leaving amount")).toHaveLength(1);
  expect(
    screen
      .getByRole("heading", { name: "Food and meals" })
      .compareDocumentPosition(food) & Node.DOCUMENT_POSITION_FOLLOWING,
  ).toBeTruthy();
  expect(
    screen
      .getByRole("heading", { name: "Contract and house rules" })
      .compareDocumentPosition(screen.getByLabelText("Early leaving amount")) &
      Node.DOCUMENT_POSITION_FOLLOWING,
  ).toBeTruthy();
});

it("keeps extra charges with their service and clears them when included in rent", async () => {
  render(createElement(Form));
  await select("pg-service-Laundry", "Available for extra charge");
  await select("pg-service-Laundry-basis", "Fixed amount");
  fireEvent.change(screen.getByLabelText("Laundry charge"), {
    target: { value: "350" },
  });
  expect(
    JSON.parse(screen.getByTestId("payload").textContent!).services,
  ).toContainEqual({
    name: "Laundry",
    status: "Available for extra charge",
    chargeType: "Fixed amount",
    amount: 350,
  });
  expect(screen.queryByLabelText("Water charge")).toBeNull();
  await select("pg-service-Laundry", "Included in rent");
  expect(screen.queryByLabelText("Laundry charge")).toBeNull();
  expect(
    JSON.parse(screen.getByTestId("payload").textContent!).services,
  ).toContainEqual({
    name: "Laundry",
    status: "Included in rent",
    chargeType: "",
    amount: null,
  });
});
