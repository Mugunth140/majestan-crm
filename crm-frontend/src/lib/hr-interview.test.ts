import { describe, expect, it } from "vitest";
import { formatInterviewTime, toTimeInput } from "./hr-interview";
import { MAIL_STATUS, newDraftIds, type MailSummary } from "./mail-api";

describe("interview helpers", () => {
  it("formats wall-clock times without timezone conversion", () => {
    expect(formatInterviewTime("11:30:00")).toBe("11:30 AM");
    expect(formatInterviewTime("00:05")).toBe("12:05 AM");
    expect(formatInterviewTime("13:00:00")).toBe("1:00 PM");
    expect(formatInterviewTime(null)).toBe("");
    expect(toTimeInput("09:15:00")).toBe("09:15");
  });
});

describe("mail panel helpers", () => {
  const row = (id: number, status: MailSummary["status"]) => ({ id, status }) as MailSummary;

  it("only reports drafts that appeared after the first load", () => {
    expect(newDraftIds(null, [row(1, "draft")])).toEqual([]);
    expect(newDraftIds(new Set([1]), [row(1, "draft"), row(3, "draft"), row(2, "sent"), row(4, "draft")])).toEqual([4, 3]);
  });

  it("has a label for every status", () => {
    expect(Object.keys(MAIL_STATUS).sort()).toEqual(["cancelled", "draft", "failed", "pending", "sending", "sent", "suppressed"]);
  });
});
