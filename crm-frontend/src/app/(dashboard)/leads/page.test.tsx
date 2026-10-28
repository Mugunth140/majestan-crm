import { describe, expect, it } from "vitest";
import { mapImportSheetRow } from "@/lib/lead-import";

const sources = [{ id: 3, name: "Website" }];
const baseRow = {
  "Customer Name": "Asha",
  "Customer Number": "9876543210",
  "Email Id": "asha@example.com",
  "Lead Source ID": 3,
};

describe("bulk import Staff ID column", () => {
  it("is optional — a file without the column parses with no assignee", () => {
    const parsed = mapImportSheetRow({ ...baseRow }, 0, sources);
    expect(parsed.staffId).toBeUndefined();
    expect(parsed.staff).toBe("Unassigned");
    expect(parsed.rawId).toBe("import-0");
    expect(parsed.id).toBe("IMPORT-1");
  });

  it("reads a numeric staff id when present", () => {
    const parsed = mapImportSheetRow({ ...baseRow, "Staff ID": 12 }, 3, sources);
    expect(parsed.staffId).toBe(12);
    expect(parsed.rawId).toBe("import-3");
    expect(parsed.id).toBe("IMPORT-4");
  });

  it("does not abort the file on a malformed staff id", () => {
    const parsed = mapImportSheetRow({ ...baseRow, "Staff ID": "not-a-number" }, 0, sources);
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
        "Lead Source ID": " 3 ",
      },
      0, sources,
    );
    expect(parsed.mobile).toBe("9876543210");
    expect(parsed.name).toBe("Asha");
    expect(parsed.source).toBe("Website");
    expect(parsed.email).toBe("");
    expect(parsed.commissionRemarks).toBe("");
    expect(parsed.status).toBe("NEW");
  });
});


describe("Lead Source ID import", () => {
  it("resolves IDs to display names while retaining the ID for submission", () => {
    expect(mapImportSheetRow(baseRow, 0, sources)).toMatchObject({ leadSourceId: 3, source: "Website" });
  });
  it.each([undefined, "", "Website", 0, -1, 1.5, 999])("rejects an invalid source ID %s with its spreadsheet row", value => {
    expect(() => mapImportSheetRow({ ...baseRow, "Lead Source ID": value }, 4, sources)).toThrow("Row 6: Lead Source ID");
  });
  it("rejects inactive IDs absent from the active master list", () => {
    expect(() => mapImportSheetRow(baseRow, 0, [])).toThrow("active Lead Source master ID");
  });
});
