import { apiJson } from "@/lib/api-fetch";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "/api/v1";
const JSON_HEADERS = { "Content-Type": "application/json" };

export type MailStatus = "draft" | "pending" | "sending" | "sent" | "failed" | "cancelled" | "suppressed";

export interface MailCatalogEvent {
  key: string;
  label: string;
  description: string;
  mode: "confirm" | "auto";
  from: string;
  canSend: boolean;
}

export interface MailCatalog {
  enabled: boolean;
  redirectTo: string | null;
  events: MailCatalogEvent[];
}

export interface MailSummary {
  id: number;
  event: string;
  label: string;
  status: MailStatus;
  to: string[];
  cc: string[];
  subject: string;
  note: string | null;
  triggerSource: string;
  attempts: number;
  lastError: string | null;
  createdBy: number | null;
  confirmedBy: number | null;
  createdAt: string;
  confirmedAt: string | null;
  sentAt: string | null;
  expiresAt: string | null;
}

export interface MailPreview {
  outboxId: number | null;
  event: string;
  label: string;
  from: string;
  to: string[];
  cc: string[];
  subject: string;
  html: string;
  text: string;
  issues: string[];
  hash: string;
  enabled: boolean;
  redirectTo: string | null;
}

export interface MailAttachment {
  id: number;
  filename: string;
  contentType: string;
  size: number;
}

/** A message from the composer; subject/body may contain {{variables}}. */
export interface ComposeInput {
  entityType: string;
  entityId: number;
  subject: string;
  body: string;
  cc?: string[];
  eventKey?: string;
  draftId?: number;
  attachmentIds?: number[];
}

export type ComposePreview = MailPreview & { attachments: MailAttachment[] };

/** What the preview dialog is about: an existing draft, or a new email of a given type. */
export type MailTarget = { kind: "draft"; id: number } | { kind: "new"; event: string };

const post = <T,>(path: string, body: unknown) =>
  apiJson<T>(`${API_URL}${path}`, { method: "POST", headers: JSON_HEADERS, body: JSON.stringify(body) });

export const mailApi = {
  catalog: (entityType: string) =>
    apiJson<MailCatalog>(`${API_URL}/mail/events?entityType=${encodeURIComponent(entityType)}`),
  history: (entityType: string, entityId: number) =>
    apiJson<MailSummary[]>(`${API_URL}/mail/history?entityType=${encodeURIComponent(entityType)}&entityId=${entityId}`),
  preview: (target: MailTarget, entityId: number, note: string) =>
    target.kind === "draft"
      ? post<MailPreview>(`/mail/outbox/${target.id}/preview`, { note: note || undefined })
      : post<MailPreview>("/mail/preview", { event: target.event, entityId, note: note || undefined }),
  send: (target: MailTarget, entityId: number, note: string, hash: string) =>
    target.kind === "draft"
      ? post<MailSummary>(`/mail/outbox/${target.id}/confirm`, { note: note || undefined, hash })
      : post<MailSummary>("/mail/send", { event: target.event, entityId, note: note || undefined, hash }),
  cancel: (id: number) => post<MailSummary>(`/mail/outbox/${id}/cancel`, {}),
  retry: (id: number) => post<MailSummary>(`/mail/outbox/${id}/retry`, {}),
  composePreview: (input: ComposeInput) => post<ComposePreview>("/mail/compose/preview", input),
  composeSend: (input: ComposeInput, hash: string) => post<MailSummary>("/mail/compose/send", { ...input, hash }),
  uploadAttachment: (file: File) => {
    const form = new FormData();
    form.append("file", file);
    return apiJson<MailAttachment>(`${API_URL}/mail/attachments`, { method: "POST", body: form });
  },
  removeAttachment: (id: number) => apiJson<{ success: boolean }>(`${API_URL}/mail/attachments/${id}`, { method: "DELETE" }),
};

export const MAX_ATTACHMENT_BYTES = 10 * 1024 * 1024;

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/** Splits "a@x.com, b@y.com; c@z.com" into addresses; returns the ones that look invalid too. */
export function parseAddresses(input: string): { valid: string[]; invalid: string[] } {
  const parts = input.split(/[\s,;]+/).map((p) => p.trim().toLowerCase()).filter(Boolean);
  const valid = [...new Set(parts.filter((p) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(p)))];
  return { valid, invalid: parts.filter((p) => !valid.includes(p)) };
}

export const MAIL_STATUS: Record<MailStatus, { label: string; className: string }> = {
  draft: { label: "Ready to send", className: "bg-amber-100 text-amber-800 border-amber-200" },
  pending: { label: "Queued", className: "bg-blue-100 text-blue-800 border-blue-200" },
  sending: { label: "Sending", className: "bg-blue-100 text-blue-800 border-blue-200" },
  sent: { label: "Sent", className: "bg-emerald-100 text-emerald-800 border-emerald-200" },
  failed: { label: "Failed", className: "bg-red-100 text-red-800 border-red-200" },
  cancelled: { label: "Discarded", className: "bg-gray-100 text-gray-600 border-gray-200" },
  suppressed: { label: "Blocked", className: "bg-gray-100 text-gray-700 border-gray-200" },
};

/**
 * Drafts that appeared since the last load, newest first. `seen` is null on the
 * first load so existing drafts don't pop a dialog when the page opens.
 */
export function newDraftIds(seen: Set<number> | null, rows: MailSummary[]): number[] {
  if (!seen) return [];
  return rows.filter((row) => row.status === "draft" && !seen.has(row.id)).sort((a, b) => b.id - a.id).map((row) => row.id);
}
