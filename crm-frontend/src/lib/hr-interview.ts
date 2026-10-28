export type InterviewMode = "in_person" | "phone" | "video";

export const INTERVIEW_MODE_LABELS: Record<InterviewMode, string> = {
  in_person: "In person",
  phone: "Phone call",
  video: "Video call",
};

export const INTERVIEW_MODE_OPTIONS = (Object.keys(INTERVIEW_MODE_LABELS) as InterviewMode[]).map((value) => ({
  value,
  label: INTERVIEW_MODE_LABELS[value],
}));

/** "11:30:00" or "11:30" → "11:30 AM" (IST wall clock, no timezone conversion). */
export function formatInterviewTime(value: string | null | undefined): string {
  const match = /^(\d{1,2}):(\d{2})/.exec(value ?? "");
  if (!match) return "";
  const hours = Number(match[1]);
  return `${((hours + 11) % 12) + 1}:${match[2]} ${hours < 12 ? "AM" : "PM"}`;
}

/** API "HH:mm:ss" → <input type="time"> "HH:mm". */
export const toTimeInput = (value: string | null | undefined) => (value ?? "").slice(0, 5);
