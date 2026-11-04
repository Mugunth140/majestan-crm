"use client";

import { FileUp } from "lucide-react";
import { HR_STATUS_TONES } from "@/lib/hr-status";
import { INTERVIEW_MODE_LABELS, formatInterviewTime } from "@/lib/hr-interview";
import { statusDot } from "@/components/tables/cells";
import { Value } from "@/components/record/feed";
import type { ActivityWords } from "@/components/record/activity";

/** Document types as the Documents tab names them. */
export const HR_DOCUMENT_LABELS: Record<string, string> = {
  resume: "Resume / CV", aadhaar: "Aadhaar card", pan: "PAN card",
  educationCert: "Education certificates", experienceCert: "Experience certificate", photo: "Passport photo",
};

/** How the candidate Activity tab words its history. */
export const HR_ACTIVITY: ActivityWords = {
  noun: "candidate",
  labels: {
    name: "name", mobile: "mobile", whatsapp: "WhatsApp number", email: "email", city: "city", state: "state",
    department: "department", position: "position", experience: "experience", currentSalary: "current CTC",
    expectedSalary: "expected CTC", noticePeriod: "notice period", recruitmentSource: "HR source",
    interviewDate: "interview date", interviewTime: "interview time", interviewMode: "interview mode",
    interviewLocation: "interview venue", interviewLink: "meeting link", interviewer: "interviewer",
    interviewRound: "interview round", interviewFeedback: "interview feedback",
  },
  format: (field, value) => {
    if (field === "interviewMode") return INTERVIEW_MODE_LABELS[value as keyof typeof INTERVIEW_MODE_LABELS] ?? value;
    if (field === "interviewTime") return formatInterviewTime(value) || value;
    if (field === "interviewDate" && value && /^\d{4}-\d{2}-\d{2}/.test(value)) {
      return new Date(`${value.slice(0, 10)}T00:00:00`).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
    }
    return value;
  },
  statusDot: (s) => statusDot(s, HR_STATUS_TONES[s]),
  extra: (e, actor, base) =>
    e.kind === "document_uploaded"
      ? { ...base, icon: <FileUp />, title: <>{actor} uploaded <Value>{HR_DOCUMENT_LABELS[e.field ?? ""] ?? "a document"}</Value></> }
      : null,
};
