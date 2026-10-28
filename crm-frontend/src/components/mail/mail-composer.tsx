"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { AlertTriangle, ArrowLeft, FileText, ImageIcon, Info, Loader2, Paperclip, Send, X } from "lucide-react";
import { toast } from "sonner";
import { ApiError } from "@/lib/api-fetch";
import {
  formatBytes,
  mailApi,
  MAX_ATTACHMENT_BYTES,
  parseAddresses,
  type ComposeInput,
  type ComposePreview,
  type MailAttachment,
} from "@/lib/mail-api";
import { mailTemplatesApi, type MailTemplateCatalog } from "@/lib/mail-templates-api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { FormSelect } from "@/components/shared/form-select";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { EmailEditor } from "./email-editor";
import { VariablePicker } from "./variable-picker";

/** Where the composer starts: a blank email, a saved template, a system email, or an existing draft. */
export type ComposerStart =
  | { kind: "blank" }
  | { kind: "saved"; id: number }
  | { kind: "system"; key: string }
  | { kind: "draft"; id: number; eventKey: string };

type Props = {
  entityType: string;
  entityId: number;
  /** null = closed. */
  start: ComposerStart | null;
  /** The record's own address(es), shown as fixed recipients. */
  recipients?: string[];
  onClose: () => void;
  onSent: () => void;
};

export function MailComposer(props: Props) {
  return props.start ? <OpenComposer key={JSON.stringify(props.start)} {...props} start={props.start} /> : null;
}

const startValue = (start: ComposerStart) =>
  start.kind === "saved" ? `saved:${start.id}` : start.kind === "system" ? `system:${start.key}` : start.kind === "draft" ? `draft:${start.id}` : "blank";

function OpenComposer({ entityType, entityId, start, recipients = [], onClose, onSent }: Props & { start: ComposerStart }) {
  const [catalog, setCatalog] = useState<MailTemplateCatalog | null>(null);
  const [source, setSource] = useState(startValue(start));
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("<p></p>");
  const [ccText, setCcText] = useState("");
  const [files, setFiles] = useState<MailAttachment[]>([]);
  const [uploading, setUploading] = useState(0);
  const [stage, setStage] = useState<"write" | "review">("write");
  const [preview, setPreview] = useState<ComposePreview | null>(null);
  const [busy, setBusy] = useState<"review" | "send" | null>(null);
  const [touched, setTouched] = useState(false);
  const subjectRef = useRef<HTMLInputElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const sentRef = useRef(false);
  const filesRef = useRef<MailAttachment[]>([]);
  useEffect(() => { filesRef.current = files; }, [files]);

  const draft = start.kind === "draft" ? start : null;

  // Load variables and templates once, then fill in the starting text.
  useEffect(() => {
    let live = true;
    mailTemplatesApi
      .catalog(entityType)
      .then((next) => {
        if (!live) return;
        setCatalog(next);
        const text = textFor(next, startValue(start), draft?.eventKey);
        if (text) { setSubject(text.subject); setBody(text.body); }
      })
      .catch(() => toast.error("Could not load email templates"));
    return () => { live = false; };
  }, [entityType, start, draft?.eventKey]);

  // Files uploaded but never sent are removed when the composer closes.
  useEffect(() => () => {
    if (!sentRef.current) for (const file of filesRef.current) mailApi.removeAttachment(file.id).catch(() => {});
  }, []);

  const cc = useMemo(() => parseAddresses(ccText), [ccText]);
  const totalBytes = files.reduce((sum, f) => sum + f.size, 0);

  const sourceOptions = useMemo(() => {
    if (!catalog) return [{ label: "Blank email", value: "blank" }];
    const options = [{ label: "Blank email", value: "blank" }];
    for (const tpl of catalog.savedTemplates.filter((t) => t.isActive)) options.push({ label: `Template: ${tpl.name}`, value: `saved:${tpl.id}` });
    for (const email of catalog.systemEmails) options.push({ label: `Standard: ${email.label}`, value: `system:${email.key}` });
    return options;
  }, [catalog]);

  const chooseSource = (value: string) => {
    if (!catalog || value === source) return;
    if (touched && !window.confirm("Replace what you have written with this template?")) return;
    const text = textFor(catalog, value);
    setSource(value);
    setSubject(text?.subject ?? "");
    setBody(text?.body ?? "<p></p>");
    setTouched(false);
  };

  const input = (): ComposeInput => ({
    entityType,
    entityId,
    subject,
    body,
    cc: cc.valid,
    eventKey: !draft && source.startsWith("system:") ? source.slice("system:".length) : undefined,
    draftId: draft?.id,
    attachmentIds: files.map((f) => f.id),
  });

  const review = async () => {
    if (cc.invalid.length) return toast.error(`Check the Cc address: ${cc.invalid.join(", ")}`);
    setBusy("review");
    try {
      setPreview(await mailApi.composePreview(input()));
      setStage("review");
    } catch (reason) {
      toast.error(reason instanceof Error ? reason.message : "Could not prepare the email");
    } finally {
      setBusy(null);
    }
  };

  const send = async () => {
    if (!preview) return;
    setBusy("send");
    try {
      await mailApi.composeSend(input(), preview.hash);
      sentRef.current = true;
      toast.success(preview.enabled ? "Email queued for sending." : "Email queued. It will go out once sending is switched on.");
      onSent();
    } catch (reason) {
      if (reason instanceof ApiError && reason.status === 409) {
        toast.error("Something changed since you reviewed it. Please check the updated version.");
        await review();
      } else {
        toast.error(reason instanceof Error ? reason.message : "Could not send the email");
      }
    } finally {
      setBusy(null);
    }
  };

  const attach = async (list: FileList | null) => {
    const picked = Array.from(list ?? []);
    if (fileRef.current) fileRef.current.value = "";
    let total = totalBytes;
    for (const file of picked) {
      if (!/^(application\/pdf|image\/(png|jpe?g|webp))$/.test(file.type)) { toast.error(`${file.name}: only PDF and image files can be attached`); continue; }
      if (total + file.size > MAX_ATTACHMENT_BYTES) { toast.error(`${file.name}: attachments can be at most 10 MB in total`); continue; }
      total += file.size;
      setUploading((n) => n + 1);
      try {
        const uploaded = await mailApi.uploadAttachment(file);
        setFiles((current) => [...current, uploaded]);
      } catch (reason) {
        toast.error(`${file.name}: ${reason instanceof Error ? reason.message : "upload failed"}`);
      } finally {
        setUploading((n) => n - 1);
      }
    }
  };

  const detach = (id: number) => {
    setFiles((current) => current.filter((f) => f.id !== id));
    mailApi.removeAttachment(id).catch(() => {});
  };

  const insertIntoSubject = (token: string) => {
    const el = subjectRef.current;
    const at = el?.selectionStart ?? subject.length;
    const end = el?.selectionEnd ?? at;
    setSubject(subject.slice(0, at) + token + subject.slice(end));
    setTouched(true);
    requestAnimationFrame(() => { el?.focus(); el?.setSelectionRange(at + token.length, at + token.length); });
  };

  const draftLabel = draft && catalog?.systemEmails.find((e) => e.key === draft.eventKey)?.label;
  const canReview = !busy && uploading === 0 && subject.trim() && catalog;

  return (
    <Dialog open onOpenChange={(open) => { if (!open && !busy && (!touched || window.confirm("Discard this email?"))) onClose(); }}>
      <DialogContent className="sm:max-w-4xl max-h-[94vh] flex flex-col gap-0 p-0 overflow-hidden" showCloseButton={!busy}>
        <DialogHeader className="px-6 pt-5 pb-4 border-b shrink-0">
          <DialogTitle>{draft ? `Edit before sending: ${draftLabel ?? "draft"}` : "New email"}</DialogTitle>
          <DialogDescription>
            {catalog ? <>From <span className="font-medium text-foreground">{catalog.from}</span></> : "Loading…"}
            {recipients.length > 0 && <> to <span className="font-medium text-foreground">{recipients.join(", ")}</span></>}
          </DialogDescription>
        </DialogHeader>

        {stage === "write" ? (
          <div className="flex-1 overflow-y-auto px-6 py-5 space-y-4">
            {!draft && (
              <div className="grid gap-1.5 sm:grid-cols-[120px_1fr] sm:items-center">
                <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Start from</label>
                <FormSelect name="mailSource" value={source} onValueChange={(v: string) => chooseSource(v)} options={sourceOptions} placeholder="Blank email" />
              </div>
            )}
            <div className="grid gap-1.5 sm:grid-cols-[120px_1fr] sm:items-center">
              <label htmlFor="mail-cc" className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Cc</label>
              <div>
                <Input id="mail-cc" value={ccText} onChange={(e) => setCcText(e.target.value)} placeholder="Optional, e.g. manager@majestanrealty.com"
                  className={`h-10 rounded-xl ${cc.invalid.length ? "border-red-400 focus-visible:ring-red-200" : ""}`} />
                {cc.invalid.length > 0 && <p className="mt-1 text-[11px] text-red-600">Not a valid address: {cc.invalid.join(", ")}</p>}
              </div>
            </div>
            <div className="grid gap-1.5 sm:grid-cols-[120px_1fr] sm:items-center">
              <label htmlFor="mail-subject" className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Subject</label>
              <div className="flex gap-2">
                <Input id="mail-subject" ref={subjectRef} value={subject} maxLength={500} placeholder="Subject line"
                  onChange={(e) => { setSubject(e.target.value); setTouched(true); }} className="h-10 rounded-xl" />
                <VariablePicker variables={catalog?.variables ?? []} allowBlocks={false} onPick={insertIntoSubject} label="Field" />
              </div>
            </div>

            <EmailEditor
              value={body}
              variables={catalog?.variables ?? []}
              minHeight={300}
              onChange={(html) => { setBody(html); setTouched(true); }}
            />

            <div className="space-y-2">
              <div className="flex flex-wrap items-center gap-2">
                <input ref={fileRef} type="file" multiple hidden accept="application/pdf,image/png,image/jpeg,image/webp" onChange={(e) => attach(e.target.files)} />
                <Button type="button" variant="outline" size="sm" onClick={() => fileRef.current?.click()} className="h-8 rounded-lg gap-1.5 text-[13px]">
                  {uploading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Paperclip className="h-3.5 w-3.5" />} Attach file
                </Button>
                <span className="text-[11px] text-muted-foreground">PDF or images · {formatBytes(totalBytes)} of 10 MB</span>
              </div>
              {files.length > 0 && (
                <ul className="flex flex-wrap gap-2">
                  {files.map((f) => (
                    <li key={f.id} className="flex items-center gap-2 rounded-lg border bg-muted/40 py-1.5 pl-2.5 pr-1.5 text-[12px]">
                      {f.contentType === "application/pdf" ? <FileText className="h-3.5 w-3.5 text-red-600" /> : <ImageIcon className="h-3.5 w-3.5 text-blue-600" />}
                      <span className="max-w-[220px] truncate font-medium">{f.filename}</span>
                      <span className="text-muted-foreground">{formatBytes(f.size)}</span>
                      <button type="button" onClick={() => detach(f.id)} aria-label={`Remove ${f.filename}`} className="rounded p-0.5 text-muted-foreground hover:bg-muted hover:text-foreground">
                        <X className="h-3.5 w-3.5" />
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        ) : (
          <div className="flex-1 overflow-y-auto px-6 py-5 space-y-3">
            {preview && (
              <>
                <dl className="grid grid-cols-[72px_1fr] gap-x-3 gap-y-1 text-sm">
                  <dt className="text-muted-foreground">To</dt><dd className="font-medium break-all">{preview.to.join(", ") || "—"}</dd>
                  {preview.cc.length > 0 && (<><dt className="text-muted-foreground">Cc</dt><dd className="break-all">{preview.cc.join(", ")}</dd></>)}
                  <dt className="text-muted-foreground">Subject</dt><dd className="font-semibold">{preview.subject}</dd>
                  {preview.attachments.length > 0 && (<><dt className="text-muted-foreground">Files</dt><dd>{preview.attachments.map((a) => a.filename).join(", ")}</dd></>)}
                </dl>
                {preview.redirectTo && (
                  <p className="flex gap-2 rounded-xl border border-violet-200 bg-violet-50 px-3 py-2 text-[13px] text-violet-900 dark:border-violet-900 dark:bg-violet-950/40 dark:text-violet-200">
                    <Info className="h-4 w-4 mt-0.5 shrink-0" /> Test mode: this email goes to {preview.redirectTo} instead.
                  </p>
                )}
                {!preview.enabled && (
                  <p className="flex gap-2 rounded-xl border border-blue-200 bg-blue-50 px-3 py-2 text-[13px] text-blue-900 dark:border-blue-900 dark:bg-blue-950/40 dark:text-blue-200">
                    <Info className="h-4 w-4 mt-0.5 shrink-0" /> Email sending is switched off on the server. It will wait in the queue.
                  </p>
                )}
                {preview.issues.length > 0 && (
                  <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-200">
                    <p className="flex items-center gap-2 font-semibold"><AlertTriangle className="h-4 w-4" /> Fix these before sending</p>
                    <ul className="mt-1.5 list-disc pl-6 space-y-0.5">{preview.issues.map((i) => <li key={i}>{i}</li>)}</ul>
                  </div>
                )}
                <div className="overflow-hidden rounded-xl border bg-white">
                  {/* sandbox="" blocks scripts, forms and navigation inside the preview */}
                  <iframe title="Email preview" sandbox="" srcDoc={preview.html} className="block h-[480px] w-full" />
                </div>
              </>
            )}
          </div>
        )}

        <div className="flex flex-wrap items-center justify-between gap-2 border-t px-6 py-3.5 shrink-0">
          {stage === "write" ? (
            <>
              <Button variant="outline" onClick={() => { if (!touched || window.confirm("Discard this email?")) onClose(); }} disabled={busy !== null} className="rounded-xl">Cancel</Button>
              <Button onClick={review} disabled={!canReview} className="rounded-xl px-6 bg-[#0052FF] text-white hover:bg-[#0040CC]">
                {busy === "review" && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Review email
              </Button>
            </>
          ) : (
            <>
              <Button variant="outline" onClick={() => setStage("write")} disabled={busy !== null} className="rounded-xl">
                <ArrowLeft className="mr-2 h-4 w-4" /> Back to editing
              </Button>
              <Button onClick={send} disabled={busy !== null || !preview || preview.issues.length > 0} className="rounded-xl px-6 bg-[#0052FF] text-white hover:bg-[#0040CC]">
                {busy === "send" ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Send className="mr-2 h-4 w-4" />} Send email
              </Button>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

/** The starting subject/body for a source value ("blank", "saved:3", "system:key", "draft:7"). */
function textFor(catalog: MailTemplateCatalog, value: string, draftEventKey?: string): { subject: string; body: string } | null {
  if (value.startsWith("saved:")) {
    const tpl = catalog.savedTemplates.find((t) => t.id === Number(value.slice(6)));
    return tpl ? { subject: tpl.subject, body: tpl.body } : null;
  }
  const key = value.startsWith("system:") ? value.slice(7) : value.startsWith("draft:") ? draftEventKey : null;
  const email = key ? catalog.systemEmails.find((e) => e.key === key) : null;
  return email ? { subject: email.subject, body: email.body } : null;
}
