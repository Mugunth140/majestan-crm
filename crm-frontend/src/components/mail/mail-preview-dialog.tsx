"use client";

import { useEffect, useState } from "react";
import { AlertTriangle, FlaskConical, Info, Loader2, Send } from "lucide-react";
import { toast } from "sonner";
import { ApiError } from "@/lib/api-fetch";
import { mailApi, MailPreview, MailTarget } from "@/lib/mail-api";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";

type Props = {
  target: MailTarget | null;
  entityId: number;
  onClose: () => void;
  /** Called after the email was queued or the draft discarded. */
  onDone: () => void;
};

/** Shows exactly what will be sent. Send is disabled while the server reports blocking issues. */
export function MailPreviewDialog(props: Props) {
  return props.target ? <OpenMailPreviewDialog key={JSON.stringify(props.target)} {...props} target={props.target} /> : null;
}

function OpenMailPreviewDialog({ target, entityId, onClose, onDone }: Props & { target: MailTarget }) {
  const [preview, setPreview] = useState<MailPreview | null>(null);
  const [note, setNote] = useState("");
  // The request a result belongs to; loading = the latest request has not answered yet.
  const [loadedFor, setLoadedFor] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState<"send" | "discard" | null>(null);
  const [reloadToken, setReloadToken] = useState(0);

  // Re-render on the server whenever the note changes (debounced): the preview
  // hash proves to the server which version the user approved.
  const requestKey = `${note.trim()}|${reloadToken}`;
  const loading = loadedFor !== requestKey;
  useEffect(() => {
    let live = true;
    const timer = setTimeout(() => {
      mailApi
        .preview(target, entityId, note.trim())
        .then((result) => { if (live) { setPreview(result); setError(""); } })
        .catch((reason) => { if (live) setError(reason instanceof Error ? reason.message : "Could not load the preview"); })
        .finally(() => { if (live) setLoadedFor(requestKey); });
    }, note ? 450 : 0);
    return () => { live = false; clearTimeout(timer); };
  }, [target, entityId, note, requestKey]);

  const send = async () => {
    if (!preview) return;
    setBusy("send");
    try {
      await mailApi.send(target, entityId, note.trim(), preview.hash);
      toast.success(preview.enabled ? "Email queued for sending." : "Email queued. It will go out once sending is switched on.");
      onDone();
    } catch (reason) {
      if (reason instanceof ApiError && reason.status === 409) {
        toast.error("The email changed while you were reviewing it. Please check the updated version.");
        setReloadToken((n) => n + 1);
      } else {
        toast.error(reason instanceof Error ? reason.message : "Could not send the email");
      }
    } finally {
      setBusy(null);
    }
  };

  const discard = async () => {
    if (target.kind !== "draft") return onClose();
    setBusy("discard");
    try {
      await mailApi.cancel(target.id);
      toast.success("Draft discarded.");
      onDone();
    } catch (reason) {
      toast.error(reason instanceof Error ? reason.message : "Could not discard the draft");
    } finally {
      setBusy(null);
    }
  };

  const blocked = !preview || preview.issues.length > 0;

  return (
    <Dialog open onOpenChange={(open) => { if (!open && !busy) onClose(); }}>
      <DialogContent className="sm:max-w-3xl max-h-[92vh] flex flex-col gap-0 p-0 overflow-hidden" showCloseButton={!busy}>
        <DialogHeader className="px-6 pt-6 pb-4 border-b shrink-0">
          <DialogTitle>{preview?.label ?? "Email preview"}</DialogTitle>
          <DialogDescription>Check the email below. It is sent exactly as shown.</DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-4">
          {error && !preview && (
            <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800 dark:border-red-900 dark:bg-red-950/40 dark:text-red-200">{error}</div>
          )}

          {preview && (
            <>
              <dl className="grid grid-cols-[72px_1fr] gap-x-3 gap-y-1.5 text-sm">
                <dt className="text-muted-foreground">From</dt>
                <dd className="font-medium break-all">{preview.from}</dd>
                <dt className="text-muted-foreground">To</dt>
                <dd className="font-medium break-all">{preview.to.join(", ") || "—"}</dd>
                {preview.cc.length > 0 && (<><dt className="text-muted-foreground">Cc</dt><dd className="break-all">{preview.cc.join(", ")}</dd></>)}
                <dt className="text-muted-foreground">Subject</dt>
                <dd className="font-semibold">{preview.subject}</dd>
              </dl>

              {preview.redirectTo && (
                <div className="flex gap-2.5 rounded-xl border border-violet-200 bg-violet-50 px-4 py-3 text-sm text-violet-900 dark:border-violet-900 dark:bg-violet-950/40 dark:text-violet-200">
                  <FlaskConical className="h-4 w-4 mt-0.5 shrink-0" />
                  <span>Test mode is on: this email will be delivered to <strong>{preview.redirectTo}</strong>, not to the candidate.</span>
                </div>
              )}
              {!preview.enabled && (
                <div className="flex gap-2.5 rounded-xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-900 dark:border-blue-900 dark:bg-blue-950/40 dark:text-blue-200">
                  <Info className="h-4 w-4 mt-0.5 shrink-0" />
                  <span>Email sending is switched off on the server. The email will wait in the queue until it is switched on.</span>
                </div>
              )}
              {preview.issues.length > 0 && (
                <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-200">
                  <p className="flex items-center gap-2 font-semibold"><AlertTriangle className="h-4 w-4" /> Fix these before sending</p>
                  <ul className="mt-1.5 list-disc pl-6 space-y-0.5">
                    {preview.issues.map((issue) => <li key={issue}>{issue}</li>)}
                  </ul>
                </div>
              )}

              <div className="relative rounded-xl border overflow-hidden bg-white">
                {loading && (
                  <div className="absolute inset-0 z-10 flex items-center justify-center bg-white/60">
                    <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                  </div>
                )}
                {/* sandbox="" blocks scripts, forms and navigation inside the preview */}
                <iframe title="Email preview" sandbox="" srcDoc={preview.html} className="block h-[420px] w-full" />
              </div>
            </>
          )}

          {!preview && !error && (
            <div className="flex h-60 items-center justify-center"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
          )}

          <div className="space-y-1.5">
            <label htmlFor="mail-note" className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Personal note (optional)</label>
            <Textarea
              id="mail-note"
              value={note}
              maxLength={1000}
              onChange={(e) => setNote(e.target.value)}
              placeholder="e.g. Please bring your original certificates."
              className="bg-muted/30 rounded-xl resize-none text-[14px]"
              rows={2}
            />
            <p className="text-xs text-muted-foreground">Added above the signature.</p>
          </div>
        </div>

        <DialogFooter className="px-6 py-4 border-t shrink-0 sm:justify-between gap-2">
          <Button variant="outline" onClick={discard} disabled={busy !== null} className="rounded-xl">
            {busy === "discard" && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {target.kind === "draft" ? "Discard draft" : "Cancel"}
          </Button>
          <Button onClick={send} disabled={blocked || loading || busy !== null} className="rounded-xl px-6 bg-[#0052FF] text-white hover:bg-[#0040CC]">
            {busy === "send" ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Send className="mr-2 h-4 w-4" />}
            Send email
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
