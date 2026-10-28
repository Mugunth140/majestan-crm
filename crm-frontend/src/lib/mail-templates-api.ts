import { apiJson } from "@/lib/api-fetch";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "/api/v1";
const JSON_HEADERS = { "Content-Type": "application/json" };

export interface MailVariableDoc {
  key: string;
  label: string;
  sample: string;
  block?: boolean;
}

export interface MailTemplateEntity {
  entityType: string;
  label: string;
  module: string;
  from: string;
}

export interface SystemEmailTemplate {
  key: string;
  label: string;
  description: string;
  mode: "confirm" | "auto";
  customized: boolean;
  subject: string;
  body: string;
  defaultSubject: string;
  defaultBody: string;
  updatedAt: string | null;
}

export interface SavedEmailTemplate {
  id: number;
  /** Mailbox it is written for, e.g. "finance". */
  sender: string;
  name: string;
  subject: string;
  body: string;
  isActive: boolean;
  updatedAt: string;
}

export interface MailTemplateCatalog extends MailTemplateEntity {
  /** Mailboxes that can write to this record type, its own first. */
  senders: { key: string; from: string }[];
  variables: MailVariableDoc[];
  systemEmails: SystemEmailTemplate[];
  savedTemplates: SavedEmailTemplate[];
}

export interface TemplatePreview {
  subject: string;
  html: string;
  issues: string[];
}

const send = <T,>(method: string, path: string, body?: unknown) =>
  apiJson<T>(`${API_URL}/mail/templates${path}`, {
    method,
    headers: JSON_HEADERS,
    body: body === undefined ? undefined : JSON.stringify(body),
  });

export const mailTemplatesApi = {
  entities: () => apiJson<MailTemplateEntity[]>(`${API_URL}/mail/templates/entities`),
  catalog: (entityType: string) =>
    apiJson<MailTemplateCatalog>(`${API_URL}/mail/templates?entityType=${encodeURIComponent(entityType)}`),
  preview: (entityType: string, subject: string, body: string, sender?: string) =>
    send<TemplatePreview>("POST", "/preview", { entityType, subject, body, sender }),
  saveSystem: (eventKey: string, subject: string, body: string) =>
    send<SystemEmailTemplate>("PUT", `/system/${encodeURIComponent(eventKey)}`, { subject, body }),
  resetSystem: (eventKey: string) => send<SystemEmailTemplate>("DELETE", `/system/${encodeURIComponent(eventKey)}`),
  createSaved: (entityType: string, input: { name: string; subject: string; body: string; isActive?: boolean; sender?: string }) =>
    send<SavedEmailTemplate>("POST", "/saved", { entityType, ...input }),
  updateSaved: (id: number, entityType: string, input: { name: string; subject: string; body: string; isActive?: boolean; sender?: string }) =>
    send<SavedEmailTemplate>("PUT", `/saved/${id}`, { entityType, ...input }),
  deleteSaved: (id: number) => send<{ success: boolean }>("DELETE", `/saved/${id}`),
};

/** Roles allowed to edit templates (the server enforces the same list). */
export const TEMPLATE_EDITOR_ROLES = ["Super Admin", "Admin", "Manager", "Team Lead"];

export function canEditTemplates(): boolean {
  if (typeof window === "undefined") return false;
  try {
    const user = JSON.parse(localStorage.getItem("crm_user") || "{}");
    return TEMPLATE_EDITOR_ROLES.includes(user.role?.name || user.role);
  } catch {
    return false;
  }
}
