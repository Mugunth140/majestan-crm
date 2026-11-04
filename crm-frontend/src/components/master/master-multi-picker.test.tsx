// @vitest-environment jsdom
import { createElement } from "react";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { MasterMultiPicker } from "./master-multi-picker";
import { roomDimensionName, sameName } from "@/lib/master-kinds";

afterEach(cleanup);

const items = Array.from({ length: 12 }, (_, i) => ({ id: i + 1, name: `Amenity ${i + 1}` }));

function setup(selected: number[] = [], onCreate = vi.fn()) {
  const onChange = vi.fn();
  render(createElement(MasterMultiPicker, { items, selected, onChange, noun: "amenity", plural: "amenities", onCreate }));
  return { onChange, onCreate };
}

it("shows a few suggestions, not the whole list", () => {
  setup();
  expect(screen.getAllByRole("checkbox")).toHaveLength(8);
  expect(screen.getByText("Showing 8 of 12. Search to find the rest.")).toBeTruthy();
});

it("lists picked items as chips that can be removed", () => {
  const { onChange } = setup([3]);
  fireEvent.click(screen.getByRole("button", { name: "Remove Amenity 3" }));
  expect(onChange).toHaveBeenCalledWith([]);
});

it("searches and picks with Enter", () => {
  const { onChange } = setup();
  const search = screen.getByRole("textbox", { name: "Search amenities" });
  fireEvent.change(search, { target: { value: "amenity 11" } });
  expect(screen.getAllByRole("checkbox")).toHaveLength(1);
  fireEvent.keyDown(search, { key: "Enter" });
  expect(onChange).toHaveBeenCalledWith([11]);
});

it("offers to create only what isn't listed", () => {
  const { onCreate } = setup();
  const search = screen.getByRole("textbox", { name: "Search amenities" });
  fireEvent.change(search, { target: { value: "  amenity   2 " } });
  expect(screen.queryByText(/Create amenity/)).toBeNull();
  fireEvent.change(search, { target: { value: "Rooftop garden" } });
  fireEvent.click(screen.getByRole("button", { name: /Create amenity “Rooftop garden”/ }));
  expect(onCreate).toHaveBeenCalledWith("Rooftop garden");
});

it("names room dimensions like the master page and compares names loosely", () => {
  expect(roomDimensionName("12", "10.50")).toBe("12 × 10.5 ft");
  expect(roomDimensionName("12", "")).toBeNull();
  expect(sameName(" Master  Bedroom", "master bedroom")).toBe(true);
});
