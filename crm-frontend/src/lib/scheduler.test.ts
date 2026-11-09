import { describe, expect, it } from "vitest";
import { SCHEDULE_VIEWS, agentItem, formatWhen, inView, isDoneView, sortItems, viewKey } from "./scheduler";
import { notificationHref, notificationSentence, reminderParts } from "./notification-text";

// 08:45 UTC on 5 Nov is 14:15 in India.
const now = new Date("2026-11-05T08:45:00Z");

describe("scheduler", () => {
  it("has one view per bucket and two for Today", () => {
    expect(SCHEDULE_VIEWS.map(viewKey)).toEqual(["Overdue", "Yesterday", "Today:pending", "Today:completed", "Tomorrow", "All Scheduled"]);
    expect(isDoneView({ bucket: "Yesterday", mode: "pending" })).toBe(true);
    expect(isDoneView({ bucket: "Today", mode: "completed" })).toBe(true);
    expect(isDoneView({ bucket: "Today", mode: "pending" })).toBe(false);
  });

  it("buckets agents by their next and last follow-ups", () => {
    const agent = { nextFollowUpDate: "2026-11-04T00:00:00.000Z", lastFollowedUpDate: "2026-11-05" };
    expect(inView("agent", agent, { bucket: "Overdue", mode: "pending" }, now)).toBe(true);
    expect(inView("agent", agent, { bucket: "Today", mode: "completed" }, now)).toBe(true);
    expect(inView("agent", agent, { bucket: "Today", mode: "pending" }, now)).toBe(false);
    expect(inView("agent", { nextFollowUpDate: "2026-11-20" }, { bucket: "All Scheduled", mode: "pending" }, now)).toBe(true);
  });

  it("leaves joined and rejected candidates out, as the HR tab did", () => {
    const due = { nextFollowUpDate: "2026-11-05", status: "Interview Scheduled" };
    expect(inView("hr", due, { bucket: "Today", mode: "pending" }, now)).toBe(true);
    expect(inView("hr", { ...due, status: "Joined" }, { bucket: "Today", mode: "pending" }, now)).toBe(false);
  });

  it("leaves queued and closed inbound out", () => {
    const due = { nextFollowUpDate: "2026-11-05", status: "New" };
    expect(inView("inbound", due, { bucket: "Today", mode: "pending" }, now)).toBe(true);
    expect(inView("inbound", { ...due, is_queued: true }, { bucket: "Today", mode: "pending" }, now)).toBe(false);
    expect(inView("inbound", { ...due, status: "Closed" }, { bucket: "Today", mode: "pending" }, now)).toBe(false);
  });

  it("orders to-dos by due time and contacts made newest first", () => {
    const a = agentItem({ id: 1, nextFollowUpDate: "2026-11-05", nextFollowUpTime: "15:00:00", lastFollowedUpDate: "2026-11-01" });
    const b = agentItem({ id: 2, nextFollowUpDate: "2026-11-05", nextFollowUpTime: "09:30:00", lastFollowedUpDate: "2026-11-03" });
    const c = agentItem({ id: 3, nextFollowUpDate: "2026-11-05" });
    expect(sortItems([a, b, c], false).map((i) => i.id)).toEqual([2, 1, 3]);
    expect(sortItems([a, b], true).map((i) => i.id)).toEqual([2, 1]);
  });

  it("formats when a follow-up is", () => {
    expect(formatWhen("2026-11-05", "14:30", now)).toBe("5 Nov · 2:30 PM");
    expect(formatWhen("2025-07-11", null, now)).toBe("11 Jul 2025");
    expect(formatWhen(null, null, now)).toBe("");
    expect(agentItem({ id: 1, nextFollowUpDate: "2026-11-05", nextFollowUpTime: "00:00:00" }).nextTime).toBeNull();
  });
});

describe("notification text", () => {
  const reminder = { type: "followup_reminder", title: "Follow-up due", message: "Pam Beesly · Lead · 2:30 PM", entity_id: 12, entity_type: "lead" };

  it("reads a reminder", () => {
    expect(reminderParts(reminder)).toEqual({ name: "Pam Beesly", module: "Lead", time: "2:30 PM" });
    expect(notificationSentence(reminder)).toBe("Follow-up with Pam Beesly (Lead) is due at 2:30 PM");
    expect(notificationSentence({ title: "Security Alert", message: "Password changed" })).toBe("Password changed");
  });

  it("links to the record in its module", () => {
    expect(notificationHref(reminder)).toBe("/leads/12");
    expect(notificationHref({ entity_id: 3, entity_type: "hr" })).toBe("/hr/3");
    expect(notificationHref({ entity_id: 3, entity_type: "agent" })).toBe("/agent-network/3");
    expect(notificationHref({ entity_id: 3, entity_type: "user" })).toBeNull();
    expect(notificationHref({ lead_id: 8 })).toBe("/leads/8");
  });
});
