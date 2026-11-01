// @vitest-environment jsdom
import { createElement, useState } from "react";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  within,
} from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import {
  AdditionalCurationFields,
  OwnerAlternativeContacts,
  PortionFields,
  ParkingFields,
} from "./PropertyCurationFields";
import { PropertyRoomDimensions } from "./PropertyRoomDimensions";
import {
  curationPayload,
  restoreCurationDetails,
  restoreContactDetails,
} from "./property-curation-two";
beforeEach(() => {
  vi.stubGlobal(
    "ResizeObserver",
    class {
      observe() {}
      unobserve() {}
      disconnect() {}
    },
  );
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});
async function select(trigger: HTMLElement, name: string) {
  fireEvent.keyDown(trigger, { key: "ArrowDown" });
  const option = await screen.findByRole("option", { name, exact: true });
  fireEvent.pointerDown(option, { pointerType: "mouse", button: 0 });
  fireEvent.click(option);
}
it("creates BHK configuration rows from the portion count", async () => {
  function Form() {
    const [count, setCount] = useState("");
    const [value, setValue] = useState(() => restoreCurationDetails(null));
    return createElement(
      "div",
      null,
      createElement(PortionFields, {
        count,
        onCountChange: setCount,
        value,
        onChange: setValue,
      }),
      createElement(
        "output",
        { "data-testid": "result" },
        JSON.stringify(curationPayload(value, () => true)),
      ),
    );
  }
  render(createElement(Form));
  fireEvent.change(screen.getByLabelText("No of Portions"), {
    target: { value: "3" },
  });
  await select(screen.getByRole("combobox"), "3 BHK");
  fireEvent.change(screen.getByLabelText("Portion configuration 1 count"), {
    target: { value: "2" },
  });
  fireEvent.click(
    screen.getByRole("button", { name: "Add portion configuration" }),
  );
  await select(screen.getAllByRole("combobox")[1], "2 BHK");
  expect(
    JSON.parse(screen.getByTestId("result").textContent!).portions,
  ).toEqual([
    { bhk: "3 BHK", count: 2 },
    { bhk: "2 BHK", count: 1 },
  ]);
});
it("adds unique parking combinations and can explicitly mark no parking", () => {
  function Form() {
    const [value, onChange] = useState(() => restoreCurationDetails(null));
    return createElement(
      "div",
      null,
      createElement(ParkingFields, { value, onChange }),
      createElement(
        "output",
        { "data-testid": "result" },
        JSON.stringify(curationPayload(value, () => true)),
      ),
    );
  }
  render(createElement(Form));
  fireEvent.click(
    screen.getByRole("button", { name: "Add parking combination" }),
  );
  fireEvent.click(
    screen.getByRole("button", { name: "Add parking combination" }),
  );
  expect(
    JSON.parse(screen.getByTestId("result").textContent!).parkingSpaces,
  ).toEqual([
    { vehicle: "Car", type: "Open", count: 1 },
    { vehicle: "Car", type: "Covered", count: 1 },
  ]);
  fireEvent.click(screen.getByRole("button", { name: "No parking" }));
  expect(
    JSON.parse(screen.getByTestId("result").textContent!).parkingSpaces,
  ).toEqual([]);
});
it("edits the second owner alternative without replacing the first", async () => {
  function Form() {
    const [value, onChange] = useState(() =>
      restoreContactDetails({
        ownerAlternatives: [
          { role: "Manager", name: "Synthetic first", phone: "", email: "" },
        ],
      }),
    );
    return createElement(
      "div",
      null,
      createElement(OwnerAlternativeContacts, { value, onChange }),
      createElement(
        "output",
        { "data-testid": "result" },
        JSON.stringify(value),
      ),
    );
  }
  render(createElement(Form));
  fireEvent.change(screen.getByLabelText("Alternative owner contact 2 name"), {
    target: { value: "Synthetic second" },
  });
  await select(
    within(
      screen.getByRole("group", { name: "Alternative owner contact 2" }),
    ).getByRole("combobox"),
    "Security",
  );
  const result = JSON.parse(screen.getByTestId("result").textContent!);
  expect(result.ownerAlternatives[0].name).toBe("Synthetic first");
  expect(result.ownerAlternatives[1]).toMatchObject({
    name: "Synthetic second",
    role: "Security",
  });
});
it("edits manual room dimensions and responds to a restored draft", () => {
  function Form() {
    const [value, onChange] = useState("12 × 10 ft");
    return createElement(
      "div",
      null,
      createElement(PropertyRoomDimensions, { value, onChange }),
      createElement(
        "button",
        { onClick: () => onChange("15 × 11 ft") },
        "Restore draft",
      ),
      createElement("output", { "data-testid": "result" }, value),
    );
  }
  render(createElement(Form));
  fireEvent.change(screen.getByLabelText("Room length in feet"), {
    target: { value: "14" },
  });
  expect(screen.getByTestId("result").textContent).toBe("14 × 10 ft");
  fireEvent.click(screen.getByText("Restore draft"));
  expect(
    (screen.getByLabelText("Room length in feet") as HTMLInputElement).value,
  ).toBe("15");
  expect(
    (screen.getByLabelText("Room width in feet") as HTMLInputElement).value,
  ).toBe("11");
});

it("keeps utility names containing commas intact across multiple selections and save", () => {
  function Form() {
    const [value, onChange] = useState(() => restoreCurationDetails(null));
    return createElement(
      "div",
      null,
      createElement(AdditionalCurationFields, {
        value,
        onChange,
        visible: (field) => field === "utilities",
        hasRestroom: false,
        utilities: ["Water, power and backup", "Internet"],
      }),
      createElement(
        "output",
        { "data-testid": "result" },
        JSON.stringify(
          curationPayload(value, (field) => field === "utilities"),
        ),
      ),
    );
  }
  render(createElement(Form));
  fireEvent.click(screen.getByText("Select utilities provided"));
  fireEvent.click(
    screen.getByRole("checkbox", { name: "Water, power and backup" }),
  );
  fireEvent.click(screen.getByRole("checkbox", { name: "Internet" }));
  expect(
    JSON.parse(screen.getByTestId("result").textContent!).utilities,
  ).toEqual(["Water, power and backup", "Internet"]);
  expect(
    screen
      .getByRole("checkbox", { name: "Water, power and backup" })
      .getAttribute("aria-checked"),
  ).toBe("true");
});
