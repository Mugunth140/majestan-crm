import { describe, expect, it } from "vitest";
import { normalizeStaffId } from "@/lib/lead-import";

// Mirrors the row mapping in handleFileUpload (page.tsx:642-657) for the
// optional Staff ID column.
function buildRow(row: Record<string, unknown>) {
  return {
    rawId: "import-0",
    name: String(row["Customer Name"]).trim(),
    mobile: String(row["Customer Number"]).trim(),
    source: String(row["Lead source"]).trim(),
    staffId: normalizeStaffId(row["Staff ID"]),
  };
}

describe("bulk import Staff ID column", () => {
  it("is optional — a file without the column parses with no assignee", () => {
    const parsed = buildRow({
      "Customer Name": "Asha",
      "Customer Number": "9876543210",
      "Lead source": "Website",
    });
    expect(parsed.staffId).toBeUndefined();
  });

  it("reads a numeric staff id when present", () => {
    const parsed = buildRow({
      "Customer Name": "Asha",
      "Customer Number": "9876543210",
      "Lead source": "Website",
      "Staff ID": 12,
    });
    expect(parsed.staffId).toBe(12);
  });

  it("does not abort the file on a malformed staff id", () => {
    const parsed = buildRow({
      "Customer Name": "Asha",
      "Customer Number": "9876543210",
      "Lead source": "Website",
      "Staff ID": "not-a-number",
    });
    expect(parsed.staffId).toBeUndefined();
    expect(parsed.name).toBe("Asha");
  });
});
