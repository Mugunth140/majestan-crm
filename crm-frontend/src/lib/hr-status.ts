import type { StatusTone } from "@/components/tables/cells";

/** A candidate's progress, as the HR table and the candidate page colour it. */
export const HR_STATUS_TONES: Record<string, StatusTone> = {
  "New Application": "gray",
  "Contacted": "blue",
  "Resume Shortlisted": "blue",
  "Interview Scheduled": "violet",
  "Interview Completed": "violet",
  "Selected": "green",
  "Offer Sent": "blue",
  "Joined": "green",
  "Rejected": "red",
  "Hold": "amber",
};
