import { describe, expect, it } from "vitest";
import { mapImportSheetRow } from "@/lib/lead-import";

const baseRow = {
  "Customer Name": "Asha",
  "Customer Number": "9876543210",
  "Email Id": "asha@example.com",
  "Lead source": "Website",
};

describe("bulk import Staff ID column", () => {
  it("is optional — a file without the column parses with no assignee", () => {
    const parsed = mapImportSheetRow({ ...baseRow }, 0);
    expect(parsed.staffId).toBeUndefined();
    expect(parsed.staff).toBe("Unassigned");
    expect(parsed.rawId).toBe("import-0");
    expect(parsed.id).toBe("IMPORT-1");
  });

  it("reads a numeric staff id when present", () => {
    const parsed = mapImportSheetRow({ ...baseRow, "Staff ID": 12 }, 3);
    expect(parsed.staffId).toBe(12);
    expect(parsed.rawId).toBe("import-3");
    expect(parsed.id).toBe("IMPORT-4");
  });

  it("does not abort the file on a malformed staff id", () => {
    const parsed = mapImportSheetRow({ ...baseRow, "Staff ID": "not-a-number" }, 0);
    expect(parsed.staffId).toBeUndefined();
    expect(parsed.name).toBe("Asha");
    expect(parsed.isPendingImport).toBe(true);
  });

  it("normalizes the mobile and defaults the optional text columns", () => {
    const parsed = mapImportSheetRow(
      {
        "Customer Name": "  Asha  ",
        "Customer Number": "+91 98765-43210",
        "Email Id": "",
        "Lead source": "  Website  ",
      },
      0,
    );
    expect(parsed.mobile).toBe("9876543210");
    expect(parsed.name).toBe("Asha");
    expect(parsed.source).toBe("Website");
    expect(parsed.email).toBe("");
    expect(parsed.commissionRemarks).toBe("");
    expect(parsed.status).toBe("NEW");
  });
});
