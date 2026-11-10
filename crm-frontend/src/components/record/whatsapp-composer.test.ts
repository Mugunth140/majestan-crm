import { describe, expect, it } from "vitest";
import { fillTemplate, startingValues, templateLabel, type WaTemplate } from "./whatsapp-composer";

const visit: WaTemplate = {
  name: "site_visit",
  language: "en",
  category: "UTILITY",
  header: "Visit on {{1}}",
  body: "Hi {{customer_name}}, see you at {{2}}.",
  footer: null,
  buttons: [],
  fields: [
    { id: "header:1", part: "header", key: "1", example: "Saturday" },
    { id: "body:customer_name", part: "body", key: "customer_name", example: "Ravi" },
    { id: "body:2", part: "body", key: "2", example: null },
  ],
  supported: true,
};

describe("WhatsApp composer helpers", () => {
  it("previews the filled template and leaves empty values visible", () => {
    expect(fillTemplate(visit, { "header:1": "Sunday", "body:customer_name": "Anu" })).toEqual({
      header: "Visit on Sunday",
      body: "Hi Anu, see you at {{2}}.",
    });
  });

  it("puts the lead's name in name fields only", () => {
    expect(startingValues(visit, "Ravi Kumar")).toEqual({ "body:customer_name": "Ravi Kumar" });
    expect(startingValues(visit, null)).toEqual({});
  });

  it("labels templates readably and flags ones that need a file", () => {
    expect(templateLabel(visit)).toBe("Site visit · en");
    expect(templateLabel({ ...visit, supported: false })).toBe("Site visit · en (needs a file)");
  });
});
