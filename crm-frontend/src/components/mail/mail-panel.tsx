"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ChevronDown, Loader2, Mail, RotateCcw, Send } from "lucide-react";
import { toast } from "sonner";
import { formatDistanceToNow } from "date-fns";
import { mailApi, MailCatalog, MailSummary, MailTarget, MAIL_STATUS, newDraftIds } from "@/lib/mail-api";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { MailPreviewDialog } from "./mail-preview-dialog";

type Props = {
  /** e.g. "hr_candidate", "lead". Must match the entityType of the mail events. */
  entityType: string;
  entityId: number;
  /** Change it after a save that may have created a draft (e.g. a status change). */
  refreshKey?: number;
};

const COLLAPSED = 4;

/** Drop-in email section for any CRM record: send menu, drafts waiting, and history. */
export function MailPanel({ entityType, entityId, refreshKey = 0 }: Props) {
  const [catalog, setCatalog] = useState<MailCatalog | null>(null);
  const [rows, setRows] = useState<MailSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [target, setTarget] = useState<MailTarget | null>(null);
  const [retrying, setRetrying] = useState<number | null>(null);
  const [expanded, setExpanded] = useState(false);
  const seen = useRef<Set<number> | null>(null);

  const fetchMail = useCallback(
    () => Promise.all([mailApi.catalog(entityType), mailApi.history(entityType, entityId)]),
    [entityType, entityId],
  );

  const apply = useCallback(([nextCatalog, history]: [MailCatalog, MailSummary[]]) => {
    setCatalog(nextCatalog);
    setRows(history);
    // A status change that just created a draft opens it straight away.
    const fresh = newDraftIds(seen.current, history);
    if (fresh.length && nextCatalog.events.some((event) => event.canSend)) setTarget({ kind: "draft", id: fresh[0] });
    seen.current = new Set(history.map((row) => row.id));
  }, []);

  // Older backends without the mail API: hide quietly rather than break the page.
  const fail = useCallback(() => setCatalog(null), []);
  const load = useCallback(() => fetchMail().then(apply, fail), [fetchMail, apply, fail]);

  useEffect(() => {
    let live = true;
    fetchMail()
      .then((result) => { if (live) apply(result); }, () => { if (live) fail(); })
      .finally(() => { if (live) setLoading(false); });
    return () => { live = false; };
  }, [fetchMail, apply, fail, refreshKey]);

  if (!loading && !catalog) return null;

  const sendable = catalog?.events.filter((event) => event.canSend) ?? [];
  const drafts = rows.filter((row) => row.status === "draft");
  const history = rows.filter((row) => row.status !== "draft");
  const visible = expanded ? history : history.slice(0, COLLAPSED);

  const retry = async (id: number) => {
    setRetrying(id);
    try {
      await mailApi.retry(id);
      toast.success("Email queued again.");
      await load();
    } catch (reason) {
      toast.error(reason instanceof Error ? reason.message : "Could not retry the email");
    } finally {
      setRetrying(null);
    }
  };

  return (
    <div className="bg-card border rounded-2xl p-6 shadow-sm">
      <div className="flex items-center justify-between border-b pb-3 mb-5">
        <h3 className="text-base font-bold text-foreground flex items-center gap-2">
          <Mail className="h-4 w-4 text-muted-foreground" /> Emails
        </h3>
        {sendable.length > 0 && (
          <DropdownMenu>
            <DropdownMenuTrigger
              render={<Button variant="outline" size="sm" className="h-8 rounded-lg gap-1.5 text-[13px] font-semibold" />}
            >
              <Send className="h-3.5 w-3.5" /> Send email <ChevronDown className="h-3.5 w-3.5" />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-72">
              {sendable.map((event) => (
                <DropdownMenuItem key={event.key} onClick={() => setTarget({ kind: "new", event: event.key })} className="flex-col items-start gap-0.5 py-2">
                  <span className="font-medium">{event.label}</span>
                  <span className="text-xs text-muted-foreground leading-snug">{event.description}</span>
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </div>

      {loading ? (
        <div className="flex justify-center py-6"><Loader2 className="h-4 w-4 animate-spin text-muted-foreground" /></div>
      ) : (
        <div className="space-y-4">
          {catalog?.redirectTo && (
            <p className="rounded-lg bg-violet-50 px-3 py-2 text-xs text-violet-900 border border-violet-200 dark:bg-violet-950/40 dark:text-violet-200 dark:border-violet-900">
              Test mode: emails go to {catalog.redirectTo}.
            </p>
          )}

          {drafts.map((draft) => (
            <div key={draft.id} className="rounded-xl border border-amber-200 bg-amber-50/70 p-3.5 dark:bg-amber-900/10 dark:border-amber-800">
              <p className="text-[13px] font-semibold text-amber-900 dark:text-amber-300">Ready to send: {draft.label}</p>
              <p className="mt-0.5 text-xs text-amber-900/70 dark:text-amber-300/70 truncate">To {draft.to.join(", ")}</p>
              {sendable.length > 0 && (
                <Button size="sm" onClick={() => setTarget({ kind: "draft", id: draft.id })} className="mt-3 h-8 w-full rounded-lg bg-[#0052FF] text-white hover:bg-[#0040CC]">
                  Preview &amp; send
                </Button>
              )}
            </div>
          ))}

          {history.length === 0 && drafts.length === 0 && (
            <p className="text-center text-xs text-muted-foreground py-2">No emails sent yet.</p>
          )}

          {visible.length > 0 && (
            <ul className="space-y-3">
              {visible.map((row) => {
                const status = MAIL_STATUS[row.status];
                const when = row.sentAt ?? row.confirmedAt ?? row.createdAt;
                return (
                  <li key={row.id} className="min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <p className="text-[13px] font-semibold text-foreground leading-snug">{row.label}</p>
                      <Badge className={`shrink-0 border text-[10px] font-semibold px-1.5 py-0 ${status.className}`}>{status.label}</Badge>
                    </div>
                    <p className="text-xs text-muted-foreground truncate" title={row.subject}>{row.subject}</p>
                    <p className="text-[11px] text-muted-foreground/80 mt-0.5">
                      {formatDistanceToNow(new Date(when), { addSuffix: true })}
                      {row.status === "pending" && row.attempts > 0 && ` · retrying (attempt ${row.attempts + 1})`}
                    </p>
                    {row.lastError && ["failed", "pending", "suppressed"].includes(row.status) && (
                      <p className="mt-1 text-[11px] text-red-700 dark:text-red-400 break-words">{row.lastError}</p>
                    )}
                    {row.status === "failed" && sendable.length > 0 && (
                      <Button variant="outline" size="sm" disabled={retrying === row.id} onClick={() => retry(row.id)} className="mt-1.5 h-7 rounded-lg text-xs">
                        {retrying === row.id ? <Loader2 className="mr-1.5 h-3 w-3 animate-spin" /> : <RotateCcw className="mr-1.5 h-3 w-3" />}
                        Retry
                      </Button>
                    )}
                  </li>
                );
              })}
            </ul>
          )}

          {history.length > COLLAPSED && (
            <button type="button" onClick={() => setExpanded((v) => !v)} className="text-xs font-semibold text-[#0052FF] hover:underline">
              {expanded ? "Show less" : `Show all ${history.length}`}
            </button>
          )}
        </div>
      )}

      <MailPreviewDialog
        target={target}
        entityId={entityId}
        onClose={() => setTarget(null)}
        onDone={() => { setTarget(null); void load(); }}
      />
    </div>
  );
}
