// @vitest-environment jsdom
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { ColumnDef } from "@tanstack/react-table";
import { DataTable } from "./data-table";

vi.mock("next/navigation", () => ({ usePathname: () => "/users" }));
vi.mock("@/hooks/use-device", () => ({ useIsMobile: () => false }));

type Row = { name: string };
const columns: ColumnDef<Row>[] = [{ accessorKey: "name", header: "Name" }];
const rows: Row[] = Array.from({ length: 45 }, (_, i) => ({ name: `Person ${i + 1}` }));
const shown = () => screen.queryAllByText(/^Person \d+$/).length;

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
