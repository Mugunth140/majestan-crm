import { describe, expect, it } from "vitest";
import { EMPTY_AGENT, agentPayload, checkAgent, commissionKind, commissionText, type AgentForm } from "./agent-form";

const form = (patch: Partial<AgentForm>): AgentForm => ({ ...EMPTY_AGENT, ...patch });

describe("agent create form", () => {
  it("asks each step for its own required fields", () => {
    expect(Object.keys(checkAgent("partner", form({})))).toEqual(["name", "partner_type"]);
    expect(Object.keys(checkAgent("contact", form({})))).toEqual(["mobile", "city"]);
    expect(checkAgent("commission", form({}))).toEqual({});
    expect(Object.keys(checkAgent("commission", form({ commission_accepted: true })))).toEqual(["commission_type", "commission_value"]);
    expect(checkAgent("follow_up", form({}))).toEqual({});
    expect(Object.keys(checkAgent("follow_up", form({ notes: "Met at the expo" })))).toEqual(["contactedVia"]);
  });

  it("checks optional contact details only when given", () => {
    expect(checkAgent("contact", form({ mobile: "+91 98765 43210", city: "Chennai", email: "x@y.in" }))).toEqual({});
    expect(Object.keys(checkAgent("contact", form({ mobile: "98765 43210", city: "Chennai", email: "nope", whatsapp: "123" })))).toEqual(["whatsapp", "email"]);
  });

  it("sends the follow-up only when one was logged, and drops commission terms when not accepted", () => {
    const now = new Date(2026, 10, 4, 9, 5);
    const quiet = agentPayload(form({ name: " Ravi ", mobile: "9876543210", city: "Chennai", commission_type: "percentage", commission_value: "2" }), now);
    expect(quiet).toMatchObject({ name: "Ravi", commission_accepted: false, commission_type: null, commission_value: null });
    expect(quiet).not.toHaveProperty("contactedVia");

    const logged = agentPayload(form({ name: "Ravi", mobile: "9876543210", contactedVia: "call", next: new Date(2026, 10, 6, 11, 30).toISOString(), notes: "Call back" }), now);
    expect(logged).toMatchObject({ contactedVia: "call", followUpDate: "2026-11-04", followUpTime: "09:05", nextFollowUpDate: "2026-11-06", nextFollowUpTime: "11:30", notes: "Call back" });
  });

  it("writes commission the way people read it", () => {
    expect(commissionText("percentage", "2")).toBe("2%");
    expect(commissionText("fixed_amount", "50000")).toBe("₹50,000");
    expect(commissionText("percentage", "")).toBe("");
    expect(commissionText(null, "half of brokerage")).toBe("half of brokerage");
  });
});

describe("older commission records", () => {
  it("reads Fixed Amount and Percentage the same as the new values", () => {
    expect(commissionKind("Fixed Amount")).toBe("fixed_amount");
    expect(commissionText("Fixed Amount", "50000")).toBe("₹50,000");
    expect(commissionText("Percentage", "2.0")).toBe("2%");
  });
});
