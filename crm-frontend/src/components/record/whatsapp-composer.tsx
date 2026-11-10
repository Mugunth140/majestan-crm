"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import { toast } from "sonner";
import { Clock, Loader2, RefreshCw, Send } from "lucide-react";
import { apiFetch } from "@/lib/api-fetch";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { FormSelect } from "@/components/shared/form-select";
import { cn } from "@/lib/utils";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "/api/v1";

export interface WaField { id: string; part: "header" | "body"; key: string; example: string | null }
export interface WaTemplate {
  name: string;
  language: string;
  category: string;
  header: string | null;
  body: string;
  footer: string | null;
  buttons: string[];
  fields: WaField[];
  supported: boolean;
}
interface WaWindow { configured: boolean; number: string | null; open: boolean; closes_at: string | null; hoursLeft?: number }

/** Whole hours until free replies close, worked out when the window is loaded. */
const withHours = (w: WaWindow): WaWindow => ({
  ...w,
  hoursLeft: w.closes_at ? Math.max(1, Math.round((new Date(w.closes_at).getTime() - Date.now()) / 3_600_000)) : 0,
});

/** The server's reason, whichever shape the error came back in. */
const reason = (body: { error?: unknown; message?: unknown }, fallback: string) => {
  const value = body.error ?? body.message;
  return (Array.isArray(value) ? String(value[0]) : typeof value === "string" ? value : "") || fallback;
};

const PLACEHOLDER = /\{\{\s*([A-Za-z0-9_]+)\s*\}\}/g;

/** The template as the customer will read it; empty values stay as {{1}} so the gap is obvious. */
export function fillTemplate(template: WaTemplate, values: Record<string, string>) {
  const fill = (text: string, part: string) =>
    text.replace(PLACEHOLDER, (_, key: string) => values[`${part}:${key}`]?.trim() || `{{${key}}}`);
  return { header: template.header && fill(template.header, "header"), body: fill(template.body, "body") };
}

/** "follow_up_reminder" → "Follow up reminder". */
export const templateLabel = (t: WaTemplate) =>
  `${t.name.replace(/_/g, " ").replace(/^./, (c) => c.toUpperCase())} · ${t.language}${t.supported ? "" : " (needs a file)"}`;

/** Values to start with: named fields about the person get the lead's name. */
export function startingValues(template: WaTemplate, leadName?: string | null): Record<string, string> {
  const values: Record<string, string> = {};
  for (const f of template.fields) if (leadName && /name/i.test(f.key)) values[f.id] = leadName;
  return values;
}

let templatesRequest: Promise<WaTemplate[]> | null = null;
function loadTemplates(refresh = false) {
  if (!templatesRequest || refresh) {
    templatesRequest = apiFetch(`${API_URL}/whatsapp/templates${refresh ? "?refresh=1" : ""}`)
      .then(async (res) => {
        const body = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(reason(body, "Could not load WhatsApp templates"));
        return body.data as WaTemplate[];
      })
      .catch((error) => {
        templatesRequest = null;
        throw error;
      });
  }
  return templatesRequest;
}

/**
 * Sends from the business number through the WhatsApp Cloud API: an approved template
 * any time, or free text within 24 hours of the customer's last message. When the
 * server isn't set up for the API, `fallback` (open WhatsApp and log) is shown instead.
 */
export function WhatsappComposer({ leadId, leadName, fallback, onSent }: {
  leadId: number;
  leadName?: string | null;
  fallback: ReactNode;
  onSent: () => void;
}) {
  const [win, setWin] = useState<WaWindow | null>(null);
  const [templates, setTemplates] = useState<WaTemplate[] | null>(null);
  const [templatesError, setTemplatesError] = useState<string | null>(null);
  const [mode, setMode] = useState<"template" | "text" | null>(null);
  const [picked, setPicked] = useState<string>("");
  const [values, setValues] = useState<Record<string, string>>({});
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    let live = true;
    apiFetch(`${API_URL}/whatsapp/leads/${leadId}/window`)
      .then((res) => (res.ok ? res.json() : null))
      .then((body) => live && setWin(withHours(body?.data ?? { configured: false, number: null, open: false, closes_at: null })))
      .catch(() => live && setWin({ configured: false, number: null, open: false, closes_at: null }));
    return () => { live = false; };
  }, [leadId]);

  useEffect(() => {
    if (!win?.configured) return;
    let live = true;
    loadTemplates()
      .then((list) => live && setTemplates(list))
      .catch((error: Error) => live && setTemplatesError(error.message));
    return () => { live = false; };
  }, [win?.configured]);

  const tab = mode ?? (win?.open ? "text" : "template");
  const key = (t: WaTemplate) => `${t.name}|${t.language}`;
  const template = useMemo(() => templates?.find((t) => key(t) === picked) ?? null, [templates, picked]);
  const preview = template ? fillTemplate(template, values) : null;
  const missing = template?.fields.find((f) => !values[f.id]?.trim());

  if (!win) {
    return <div className="flex h-[116px] items-center justify-center"><Loader2 className="size-4 animate-spin text-muted-foreground" /></div>;
  }
  if (!win.configured) return <>{fallback}</>;
  if (!win.number) {
    return <p className="px-4 py-4 text-[13px] text-muted-foreground md:px-6">Add a WhatsApp or mobile number to this lead to message them.</p>;
  }

  const pick = (value: string) => {
    setPicked(value);
    const next = templates?.find((t) => key(t) === value);
    setValues(next ? startingValues(next, leadName) : {});
  };

  const refresh = async () => {
    setRefreshing(true);
    try {
      setTemplates(await loadTemplates(true));
      setTemplatesError(null);
    } catch (error) {
      setTemplatesError((error as Error).message);
    } finally {
      setRefreshing(false);
    }
  };

  const canSend = tab === "text" ? win.open && !!text.trim() : !!template?.supported && !missing;
  const send = async () => {
    if (!canSend || sending) return;
    setSending(true);
    try {
      const payload = tab === "text"
        ? { text }
        : { template_name: template!.name, template_language: template!.language, values };
      const res = await apiFetch(`${API_URL}/whatsapp/leads/${leadId}/send`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(reason(body, "WhatsApp didn’t accept the message"));
      toast.success(`Sent on WhatsApp to +${win.number}`);
      setText("");
      setPicked("");
      setValues({});
      onSent();
    } catch (error) {
      toast.error("Not sent", { description: (error as Error).message });
    } finally {
      setSending(false);
    }
  };

  return (
    <div>
      <div className="flex items-center gap-1 px-3 pt-2.5 md:px-5" role="tablist" aria-label="WhatsApp message type">
        {(["template", "text"] as const).map((m) => (
          <button
            key={m}
            type="button"
            role="tab"
            aria-selected={tab === m}
            onClick={() => setMode(m)}
            className={cn(
              "h-7 rounded-md px-2.5 text-[13px] transition-colors",
              tab === m ? "bg-foreground/[0.07] font-medium text-foreground" : "text-muted-foreground hover:text-foreground",
            )}
          >
            {m === "template" ? "Template" : "Message"}
          </button>
        ))}
        <span className={cn("ml-auto inline-flex items-center gap-1 text-[12px]", win.open ? "text-emerald-600 dark:text-emerald-400" : "text-muted-foreground")}>
          <Clock className="size-3" />
          {win.open ? `Replies open for ${win.hoursLeft}h` : "Template only"}
        </span>
      </div>

      {tab === "text" ? (
        win.open ? (
          <Textarea
            autoFocus
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) void send(); }}
            placeholder={`WhatsApp message to +${win.number}`}
            aria-label="WhatsApp message"
            maxLength={4096}
            className="min-h-[76px] resize-none rounded-none border-0 bg-transparent px-4 pb-1 pt-2 text-[14px] shadow-none focus-visible:ring-0 md:px-6 dark:bg-transparent"
          />
        ) : (
          <p className="px-4 py-4 text-[13px] leading-5 text-muted-foreground md:px-6">
            {leadName || "This lead"} hasn’t messaged your WhatsApp number in the last 24 hours, so WhatsApp only allows an approved template.{" "}
            <button type="button" className="font-medium text-foreground underline-offset-2 hover:underline" onClick={() => setMode("template")}>Pick a template</button>
          </p>
        )
      ) : (
        <div className="space-y-2.5 px-4 pb-1 pt-2.5 md:px-6">
          {templatesError ? (
            <p className="text-[13px] text-red-600 dark:text-red-400">{templatesError}</p>
          ) : !templates ? (
            <div className="flex h-9 items-center gap-2 text-[13px] text-muted-foreground"><Loader2 className="size-3.5 animate-spin" />Loading templates…</div>
          ) : !templates.length ? (
            <p className="text-[13px] text-muted-foreground">No approved templates yet. Create one in WhatsApp Manager; it shows here once Meta approves it.</p>
          ) : (
            <div className="flex items-center gap-2">
              <FormSelect
                name="whatsappTemplate"
                placeholder="Choose a template"
                options={templates.map((t) => ({ label: templateLabel(t), value: key(t) }))}
                value={picked || null}
                onValueChange={(v) => pick(String(v))}
                className="h-9! w-full rounded-md! text-sm"
              />
              <Button type="button" variant="ghost" size="icon" className="size-9 shrink-0" onClick={refresh} disabled={refreshing} aria-label="Reload templates">
                <RefreshCw className={cn("size-3.5", refreshing && "animate-spin")} />
              </Button>
            </div>
          )}

          {template && !template.supported && (
            <p className="text-[13px] text-muted-foreground">This template needs a picture, video, document or code, which the CRM can’t send yet. Pick another one.</p>
          )}

          {template?.supported && template.fields.length > 0 && (
            <div className="grid gap-2 sm:grid-cols-2">
              {template.fields.map((f) => (
                <label key={f.id} className="space-y-1 text-[12px] text-muted-foreground">
                  <span>{template.fields.some((x) => x.part === "header") ? (f.part === "header" ? "Header " : "Body ") : ""}{`{{${f.key}}}`}</span>
                  <Input
                    value={values[f.id] ?? ""}
                    onChange={(e) => setValues((v) => ({ ...v, [f.id]: e.target.value }))}
                    placeholder={f.example ? `e.g. ${f.example}` : "Value"}
                    maxLength={1000}
                    className="h-8 text-[13px] text-foreground"
                  />
                </label>
              ))}
            </div>
          )}

          {preview && template?.supported && (
            <div className="w-fit max-w-[90%] rounded-xl rounded-tl-sm bg-emerald-50 px-3 py-2 text-[14px] leading-6 text-foreground shadow-[0_1px_2px_rgba(0,0,0,0.06)] dark:bg-emerald-950/40">
              {preview.header && <p className="font-medium">{preview.header}</p>}
              <p className="whitespace-pre-wrap">{preview.body}</p>
              {template.footer && <p className="mt-1 text-[12px] text-muted-foreground">{template.footer}</p>}
              {template.buttons.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-1.5 border-t border-black/5 pt-2 dark:border-white/10">
                  {template.buttons.map((b) => <span key={b} className="text-[13px] font-medium text-sky-700 dark:text-sky-400">{b}</span>)}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      <div className="flex items-center gap-2 px-3 pb-2.5 pt-1.5 md:px-5">
        <p className="min-w-0 flex-1 truncate text-[12px] text-muted-foreground max-sm:invisible">
          {tab === "template" && missing ? `Fill in {{${missing.key}}} to send.` : `Sends from your business number to +${win.number}.`}
        </p>
        <Button size="sm" onClick={send} disabled={!canSend || sending} className="h-8 gap-1.5 bg-foreground text-background hover:bg-foreground/85">
          {sending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
          {tab === "template" ? "Send template" : "Send"}
        </Button>
      </div>
    </div>
  );
}
