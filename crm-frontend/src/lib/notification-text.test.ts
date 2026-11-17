import { describe, expect, it } from "vitest";
import { notificationHref } from "./notification-text";

describe("notificationHref", () => {
  it("opens the record a notification is about", () => {
    expect(notificationHref({ type: "lead_repeat", entity_id: 4488, entity_type: "lead" })).toBe("/leads/4488");
    expect(notificationHref({ type: "record_assigned", entity_id: 7, entity_type: "hr" })).toBe("/hr/7");
  });

  it("opens the module list when a notification covers several records", () => {
    expect(notificationHref({ type: "record_assigned", entity_type: "inbound" })).toBe("/inbound");
    expect(notificationHref({ type: "lead_repeat", entity_type: "lead" })).toBe("/leads");
  });

  it("opens the page a summary is about", () => {
    expect(notificationHref({ type: "queue_new" })).toBe("/lead-routing");
    expect(notificationHref({ type: "pace_alert" })).toBe("/tasks");
    expect(notificationHref({ type: "targets_set" })).toBe("/tasks");
    expect(notificationHref({ type: "lost_leads_digest" })).toBe("/leads");
    expect(notificationHref({ type: "first_contact_digest" })).toBe("/leads?waiting=1");
  });

  it("has nowhere to go for account notices", () => {
    expect(notificationHref({ type: "security" })).toBeNull();
  });
});
