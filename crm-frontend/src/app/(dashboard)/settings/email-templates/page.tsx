"use client";

import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { useRouter } from "next/navigation";
import type { Editor } from "@tiptap/react";
import { AlertTriangle, ArrowLeft, Eye, FilePlus2, Loader2, Lock, Mail, PencilLine, RotateCcw, Save, Trash2, Zap } from "lucide-react";
import { toast } from "sonner";
import {
  canEditTemplates,
  mailTemplatesApi,
  type MailTemplateCatalog,
  type MailTemplateEntity,
  type TemplatePreview,
} from "@/lib/mail-templates-api";
import { EmailEditor } from "@/components/mail/email-editor";
import { VariablePicker } from "@/components/mail/variable-picker";
import { MobileHeader } from "@/components/layout/mobile-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { FormSelect } from "@/components/shared/form-select";

const noopSubscribe = () => () => {};

type Selection = { kind: "system"; key: string } | { kind: "saved"; id: number } | { kind: "new" };
/** sender: the mailbox a saved template is written for (system emails keep the record's own). */
type Draft = { name: string; subject: string; body: string; isActive: boolean; sender?: string };

const EMPTY_BODY = "<p>Dear {{lead.name}},</p><p></p>";

export default function EmailTemplatesPage() {
  const router = useRouter();
  const [entities, setEntities] = useState<MailTemplateEntity[] | null>(null);
  const [entityType, setEntityType] = useState<string | null>(null);
  const [catalog, setCatalog] = useState<MailTemplateCatalog | null>(null);
  const [selection, setSelection] = useState<Selection | null>(null);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [saved, setSaved] = useState<Draft | null>(null);
  const [mode, setMode] = useState<"edit" | "preview">("edit");
  const [preview, setPreview] = useState<TemplatePreview | null>(null);
  const [busy, setBusy] = useState<"save" | "reset" | "delete" | null>(null);
  // Role comes from localStorage: read it on the client only (false during SSR).
  const editable = useSyncExternalStore(noopSubscribe, canEditTemplates, () => false);
  const subjectRef = useRef<HTMLInputElement>(null);
  const editorRef = useRef<Editor | null>(null);

  useEffect(() => {
    mailTemplatesApi
      .entities()
      .then((list) => { setEntities(list); setEntityType((current) => current ?? list[0]?.entityType ?? null); })
      .catch(() => { setEntities([]); toast.error("Could not load email templates"); });
  }, []);

  const applyCatalog = useCallback((next: MailTemplateCatalog, keep?: Selection | null) => {
    setCatalog(next);
    const first: Selection | null = next.systemEmails[0] ? { kind: "system", key: next.systemEmails[0].key } : null;
    selectIn(next, keep ?? first);
  }, []);

  const loadCatalog = useCallback(
    async (type: string, keep?: Selection | null) => applyCatalog(await mailTemplatesApi.catalog(type), keep),
    [applyCatalog],
  );

  useEffect(() => {
    if (!entityType) return;
    let live = true;
    mailTemplatesApi
      .catalog(entityType)
      .then((next) => { if (live) applyCatalog(next); })
      .catch(() => toast.error("Could not load email templates"));
    return () => { live = false; };
  }, [entityType, applyCatalog]);

  function selectIn(source: MailTemplateCatalog, target: Selection | null) {
    let next: Draft | null = null;
    if (target?.kind === "system") {
      const email = source.systemEmails.find((e) => e.key === target.key);
      if (email) next = { name: email.label, subject: email.subject, body: email.body, isActive: true };
    } else if (target?.kind === "saved") {
      const tpl = source.savedTemplates.find((t) => t.id === target.id);
      if (tpl) next = { name: tpl.name, subject: tpl.subject, body: tpl.body, isActive: tpl.isActive, sender: tpl.sender };
    } else if (target?.kind === "new") {
      const firstVar = source.variables.find((v) => !v.block && v.key.endsWith(".name"))?.key ?? "sender.name";
      next = { name: "", subject: "", body: EMPTY_BODY.replace("lead.name", firstVar), isActive: true, sender: source.senders[0]?.key };
    }
    setSelection(next ? target : null);
    setDraft(next);
    setSaved(target?.kind === "new" ? null : next);
    setMode("edit");
    setPreview(null);
  }

  const dirty = useMemo(() => JSON.stringify(draft) !== JSON.stringify(saved), [draft, saved]);

  const choose = (target: Selection) => {
    if (dirty && !window.confirm("Discard your unsaved changes?")) return;
    if (catalog) selectIn(catalog, target);
  };

  // Live preview while the Preview tab is open.
  useEffect(() => {
    if (mode !== "preview" || !draft || !entityType) return;
    let live = true;
    const timer = setTimeout(() => {
      mailTemplatesApi
        .preview(entityType, draft.subject || "(no subject)", draft.body, draft.sender)
        .then((result) => { if (live) setPreview(result); })
        .catch((reason) => { if (live) toast.error(reason instanceof Error ? reason.message : "Preview failed"); });
    }, 250);
    return () => { live = false; clearTimeout(timer); };
  }, [mode, draft, entityType]);

  const system = selection?.kind === "system" ? catalog?.systemEmails.find((e) => e.key === selection.key) : null;

  const save = async () => {
    if (!draft || !entityType || !selection) return;
    setBusy("save");
    try {
      if (selection.kind === "system") {
        await mailTemplatesApi.saveSystem(selection.key, draft.subject, draft.body);
        await loadCatalog(entityType, selection);
      } else if (selection.kind === "saved") {
        await mailTemplatesApi.updateSaved(selection.id, entityType, draft);
        await loadCatalog(entityType, selection);
      } else {
        const created = await mailTemplatesApi.createSaved(entityType, draft);
        await loadCatalog(entityType, { kind: "saved", id: created.id });
      }
      toast.success("Template saved.");
    } catch (reason) {
      toast.error(reason instanceof Error ? reason.message : "Could not save the template");
    } finally {
      setBusy(null);
    }
  };

  const reset = async () => {
    if (!system || !entityType || !window.confirm(`Restore the original wording of "${system.label}"?`)) return;
    setBusy("reset");
    try {
      await mailTemplatesApi.resetSystem(system.key);
      await loadCatalog(entityType, { kind: "system", key: system.key });
      toast.success("Original wording restored.");
    } catch (reason) {
      toast.error(reason instanceof Error ? reason.message : "Could not reset the template");
    } finally {
      setBusy(null);
    }
  };

  const remove = async () => {
    if (selection?.kind !== "saved" || !entityType || !window.confirm(`Delete the template "${draft?.name}"?`)) return;
    setBusy("delete");
    try {
      await mailTemplatesApi.deleteSaved(selection.id);
      await loadCatalog(entityType, null);
      toast.success("Template deleted.");
    } catch (reason) {
      toast.error(reason instanceof Error ? reason.message : "Could not delete the template");
    } finally {
      setBusy(null);
    }
  };

  const insertIntoSubject = (token: string) => {
    const input = subjectRef.current;
    if (!draft) return;
    const start = input?.selectionStart ?? draft.subject.length;
    const end = input?.selectionEnd ?? start;
    const subject = draft.subject.slice(0, start) + token + draft.subject.slice(end);
    setDraft({ ...draft, subject });
    requestAnimationFrame(() => { input?.focus(); input?.setSelectionRange(start + token.length, start + token.length); });
  };

  const readOnly = !editable;

  return (
    <div className="flex flex-col md:h-full animate-in fade-in duration-500">
      <MobileHeader title="Email templates" showBack />

      <div className="hidden md:flex items-center gap-4 pr-[150px] min-h-[48px] mb-6 shrink-0">
        <Button variant="outline" size="icon" className="h-9 w-9 rounded-full shrink-0" onClick={() => router.push("/settings")}>
          <ArrowLeft className="h-4 w-4 text-muted-foreground" />
        </Button>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Email templates</h1>
          <p className="text-sm text-muted-foreground">The wording of emails the CRM sends, and saved templates for writing your own.</p>
        </div>
      </div>

      {entities === null ? (
        <div className="flex flex-1 items-center justify-center py-20"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
      ) : entities.length === 0 ? (
        <div className="mx-4 md:mx-0 rounded-2xl border bg-card p-10 text-center text-sm text-muted-foreground">No emails are set up yet.</div>
      ) : (
        <div className="flex-1 min-h-0 flex flex-col gap-4 px-4 md:px-0 pb-6">
          {entities.length > 1 && (
            <div className="flex flex-wrap gap-2">
              {entities.map((entity) => (
                <button
                  key={entity.entityType}
                  type="button"
                  onClick={() => { if (!dirty || window.confirm("Discard your unsaved changes?")) { setSaved(null); setDraft(null); setEntityType(entity.entityType); } }}
                  className={`rounded-full border px-4 py-1.5 text-[13px] font-semibold transition-colors ${entity.entityType === entityType ? "border-[#0052FF] bg-[#0052FF] text-white" : "bg-card text-muted-foreground hover:text-foreground"}`}
                >
                  {entity.label}s <span className="font-normal opacity-75">· {entity.from.split("@")[0]}@</span>
                </button>
              ))}
            </div>
          )}

          {readOnly && (
            <div className="flex items-center gap-2 rounded-xl border bg-muted/40 px-4 py-2.5 text-[13px] text-muted-foreground">
              <Lock className="h-3.5 w-3.5 shrink-0" /> Only admins, managers and team leads can change templates. You can view them here.
            </div>
          )}

          <div className="grid flex-1 min-h-0 grid-cols-1 gap-4 lg:grid-cols-[300px_1fr]">
            {/* List */}
            <aside className="rounded-2xl border bg-card p-3 shadow-sm lg:overflow-y-auto">
              {!catalog ? (
                <div className="flex justify-center py-10"><Loader2 className="h-4 w-4 animate-spin text-muted-foreground" /></div>
              ) : (
                <>
                  <p className="flex items-center gap-1.5 px-2 pb-1.5 pt-1 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                    <Zap className="h-3 w-3" /> Automatic emails
                  </p>
                  {catalog.systemEmails.map((email) => (
                    <ListItem
                      key={email.key}
                      active={selection?.kind === "system" && selection.key === email.key}
                      title={email.label}
                      hint={email.description}
                      badge={email.customized ? "Edited" : undefined}
                      onClick={() => choose({ kind: "system", key: email.key })}
                    />
                  ))}

                  <div className="mt-4 flex items-center justify-between px-2 pb-1.5">
                    <p className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                      <Mail className="h-3 w-3" /> Saved templates
                    </p>
                    {editable && (
                      <button type="button" onClick={() => choose({ kind: "new" })} className="flex items-center gap-1 text-[12px] font-semibold text-[#0052FF] hover:underline">
                        <FilePlus2 className="h-3.5 w-3.5" /> New
                      </button>
                    )}
                  </div>
                  {catalog.savedTemplates.length === 0 && selection?.kind !== "new" && (
                    <p className="px-2 py-3 text-xs text-muted-foreground">
                      None yet. Saved templates are starting points staff pick when writing an email{editable ? ", e.g. “Project brochure” or “Documents needed”" : ""}.
                    </p>
                  )}
                  {selection?.kind === "new" && <ListItem active title={draft?.name || "New template"} hint="Not saved yet" onClick={() => {}} />}
                  {catalog.savedTemplates.map((tpl) => (
                    <ListItem
                      key={tpl.id}
                      active={selection?.kind === "saved" && selection.id === tpl.id}
                      title={tpl.name}
                      hint={tpl.subject}
                      badge={!tpl.isActive ? "Hidden" : tpl.sender !== catalog.senders[0]?.key ? `${tpl.sender}@` : undefined}
                      onClick={() => choose({ kind: "saved", id: tpl.id })}
                    />
                  ))}
                </>
              )}
            </aside>

            {/* Editor */}
            <section className="min-w-0 rounded-2xl border bg-card shadow-sm flex flex-col lg:overflow-hidden">
              {!draft || !catalog ? (
                <div className="flex flex-1 items-center justify-center p-10 text-sm text-muted-foreground">Choose a template on the left.</div>
              ) : (
                <>
                  <div className="flex flex-wrap items-center justify-between gap-3 border-b px-5 py-3.5">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <h2 className="truncate text-base font-bold">{selection?.kind === "new" ? "New template" : draft.name}</h2>
                        {system?.customized && <Badge className="border border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-300 text-[10px]">Edited</Badge>}
                        {dirty && <span className="text-[11px] text-muted-foreground">· Unsaved changes</span>}
                      </div>
                      <p className="truncate text-xs text-muted-foreground">
                        {system
                          ? `${system.description} Sent from ${catalog.from}.`
                          : `Staff can start from this when writing an email from ${catalog.senders.find((s) => s.key === draft.sender)?.from ?? catalog.from}.`}
                      </p>
                    </div>
                    <div className="flex items-center gap-1 rounded-lg border bg-muted/40 p-0.5">
                      {(["edit", "preview"] as const).map((m) => (
                        <button
                          key={m}
                          type="button"
                          onClick={() => setMode(m)}
                          className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-[12px] font-semibold ${mode === m ? "bg-background text-foreground shadow-sm" : "text-muted-foreground"}`}
                        >
                          {m === "edit" ? <PencilLine className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                          {m === "edit" ? "Edit" : "Preview"}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="flex-1 overflow-y-auto px-5 py-5 space-y-4">
                    {mode === "edit" ? (
                      <>
                        {selection?.kind !== "system" && catalog.senders.length > 1 && (
                          <div className="space-y-1.5">
                            <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Send from</label>
                            <FormSelect name="templateSender" value={draft.sender ?? catalog.senders[0].key} disabled={readOnly}
                              onValueChange={(v: string) => v && setDraft({ ...draft, sender: v })}
                              options={catalog.senders.map((s) => ({ label: s.from, value: s.key }))} placeholder="Choose a mailbox" />
                          </div>
                        )}
                        {selection?.kind !== "system" && (
                          <div className="grid gap-4 sm:grid-cols-[1fr_auto] sm:items-end">
                            <div className="space-y-1.5">
                              <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Template name</label>
                              <Input value={draft.name} disabled={readOnly} maxLength={150} placeholder="e.g. Project brochure"
                                onChange={(e) => setDraft({ ...draft, name: e.target.value })} className="h-10 rounded-xl" />
                            </div>
                            <label className="flex items-center gap-2 pb-2 text-[13px] text-muted-foreground">
                              <Switch checked={draft.isActive} disabled={readOnly} onCheckedChange={(v) => setDraft({ ...draft, isActive: Boolean(v) })} />
                              Show to staff
                            </label>
                          </div>
                        )}
                        <div className="space-y-1.5">
                          <div className="flex items-end justify-between gap-2">
                            <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Subject</label>
                            <VariablePicker variables={catalog.variables} allowBlocks={false} disabled={readOnly} onPick={insertIntoSubject} />
                          </div>
                          <Input ref={subjectRef} value={draft.subject} disabled={readOnly} maxLength={500} placeholder="Subject line"
                            onChange={(e) => setDraft({ ...draft, subject: e.target.value })} className="h-10 rounded-xl" />
                        </div>
                        <div className="space-y-1.5">
                          <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Message</label>
                          <EmailEditor
                            value={draft.body}
                            readOnly={readOnly}
                            variables={catalog.variables}
                            onReady={(editor) => { editorRef.current = editor; }}
                            onChange={(body) => setDraft((d) => (d ? { ...d, body } : d))}
                          />
                          <p className="text-[11px] text-muted-foreground">
                            Fields in {"{{double braces}}"} are filled in from the record when the email is sent. Your greeting, signature and the company footer are added automatically.
                          </p>
                        </div>
                      </>
                    ) : (
                      <div className="space-y-3">
                        {preview?.issues.map((issue) => (
                          <p key={issue} className="flex items-center gap-2 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-[13px] text-amber-900 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-200">
                            <AlertTriangle className="h-4 w-4 shrink-0" /> {issue}
                          </p>
                        ))}
                        <p className="text-sm"><span className="text-muted-foreground">Subject: </span><span className="font-semibold">{preview?.subject ?? "…"}</span></p>
                        <div className="relative overflow-hidden rounded-xl border bg-white">
                          {!preview && <div className="absolute inset-0 flex items-center justify-center"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>}
                          <iframe title="Template preview" sandbox="" srcDoc={preview?.html ?? ""} className="block h-[560px] w-full" />
                        </div>
                        <p className="text-[11px] text-muted-foreground">Preview uses sample details. Real emails use the record’s own.</p>
                      </div>
                    )}
                  </div>

                  {editable && (
                    <div className="flex flex-wrap items-center justify-between gap-2 border-t px-5 py-3">
                      <div className="flex gap-2">
                        {system?.customized && (
                          <Button variant="outline" onClick={reset} disabled={busy !== null} className="rounded-xl">
                            {busy === "reset" ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RotateCcw className="mr-2 h-4 w-4" />} Reset to original
                          </Button>
                        )}
                        {selection?.kind === "saved" && (
                          <Button variant="outline" onClick={remove} disabled={busy !== null} className="rounded-xl text-red-600 hover:text-red-700 border-red-200 hover:bg-red-50 dark:border-red-900 dark:hover:bg-red-950/40">
                            {busy === "delete" ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Trash2 className="mr-2 h-4 w-4" />} Delete
                          </Button>
                        )}
                      </div>
                      <Button onClick={save} disabled={busy !== null || !dirty || !draft.subject.trim() || (selection?.kind !== "system" && !draft.name.trim())}
                        className="rounded-xl px-6 bg-[#0052FF] text-white hover:bg-[#0040CC]">
                        {busy === "save" ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />} Save
                      </Button>
                    </div>
                  )}
                </>
              )}
            </section>
          </div>
        </div>
      )}
    </div>
  );
}

function ListItem({ active, title, hint, badge, onClick }: { active: boolean; title: string; hint?: string; badge?: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`w-full rounded-xl px-3 py-2.5 text-left transition-colors ${active ? "bg-[#0052FF]/10 ring-1 ring-[#0052FF]/30" : "hover:bg-muted/60"}`}
    >
      <span className="flex items-center justify-between gap-2">
        <span className={`truncate text-[13px] font-semibold ${active ? "text-[#0052FF]" : "text-foreground"}`}>{title}</span>
        {badge && <span className="shrink-0 rounded-full bg-amber-100 px-1.5 py-0.5 text-[10px] font-semibold text-amber-800 dark:bg-amber-950/50 dark:text-amber-300">{badge}</span>}
      </span>
      {hint && <span className="mt-0.5 block truncate text-[11px] text-muted-foreground">{hint}</span>}
    </button>
  );
}
