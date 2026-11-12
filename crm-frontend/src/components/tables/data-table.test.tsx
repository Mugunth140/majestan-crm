// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { ColumnDef } from "@tanstack/react-table";
import { DataTable, rowSignature } from "./data-table";

vi.mock("next/navigation", () => ({ usePathname: () => "/users" }));
vi.mock("@/hooks/use-device", () => ({ useIsMobile: () => false }));

type Row = { name: string };
const columns: ColumnDef<Row>[] = [{ accessorKey: "name", header: "Name" }];
const rows: Row[] = Array.from({ length: 45 }, (_, i) => ({ name: `Person ${i + 1}` }));
const shown = () => screen.queryAllByText(/^Person \d+$/).length;
afterEach(cleanup);

describe("DataTable client pagination", () => {
  it("shows 20 rows, switches to 50 and 100, and pages through", () => {
    render(<DataTable columns={columns} data={rows} variant="list" persistKey={false} />);
    expect(shown()).toBe(20);
    expect(screen.getByText("1–20 of 45")).toBeTruthy();

    fireEvent.click(screen.getByLabelText("Next page"));
    expect(screen.getByText("21–40 of 45")).toBeTruthy();
    expect(screen.getByText("Person 21")).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "50" }));
    expect(shown()).toBe(45);
    expect(screen.getByText("1–45 of 45")).toBeTruthy();
    expect(screen.getByRole("button", { name: "50" }).className).toContain("font-medium");

    fireEvent.click(screen.getByRole("button", { name: "100" }));
    expect(shown()).toBe(45);
  });
});

describe("DataTable remembered page", () => {
  type IdRow = { id: number; name: string };
  const idCols: ColumnDef<IdRow>[] = [{ accessorKey: "name", header: "Name" }];
  const make = (n: number, from = 1) => Array.from({ length: n }, (_, i) => ({ id: from + i, name: `Person ${from + i}` }));

  it("keeps the page when the same rows load again and resets for different rows", () => {
    localStorage.clear();
    const { rerender } = render(<DataTable columns={idCols} data={make(45)} variant="list" persistKey="keep" />);
    fireEvent.click(screen.getByLabelText("Next page"));
    expect(screen.getByText("21–40 of 45")).toBeTruthy();

    rerender(<DataTable columns={idCols} data={make(45)} variant="list" persistKey="keep" />);
    expect(screen.getByText("21–40 of 45")).toBeTruthy();

    rerender(<DataTable columns={idCols} data={make(30, 100)} variant="list" persistKey="keep" />);
    expect(screen.getByText("1–20 of 30")).toBeTruthy();
  });

  it("comes back on the same page after leaving the list", () => {
    localStorage.clear();
    const first = render(<DataTable columns={idCols} data={make(45)} variant="list" persistKey="back" />);
    fireEvent.click(screen.getByLabelText("Next page"));
    first.unmount();
    render(<DataTable columns={idCols} data={make(45)} variant="list" persistKey="back" />);
    expect(screen.getByText("21–40 of 45")).toBeTruthy();
  });
});

describe("rowSignature", () => {
  it("names rows by id, or by count when they have none", () => {
    expect(rowSignature([{ id: 1 }, { id: 2 }])).toBe("1,2");
    expect(rowSignature([{ code: "L1" }])).toBe("L1");
    expect(rowSignature([{ name: "a" }, { name: "b" }])).toBe("#2");
  });
});
