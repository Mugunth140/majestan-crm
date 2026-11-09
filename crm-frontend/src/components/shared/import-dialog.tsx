"use client";

import { useRef, useState, type ReactNode } from "react";
import { Download, FileSpreadsheet, Loader2, Upload } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { DIALOG_BUTTON } from "@/components/record/decision-dialog";
import { cn } from "@/lib/utils";

const ACCEPT = [".xlsx", ".xls", ".csv"];

/**
 * Upload a spreadsheet: a drop zone that is also a button, the sample
 * template beside it, and a progress bar while the rows are read.
 */
export function ImportDialog({ open, onOpenChange, title, description, onFile, onTemplate, busy, progress, note }: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: ReactNode;
  onFile: (file: File) => void;
  onTemplate?: () => void;
  busy: boolean;
  /** 0–100 while reading. */
  progress: number;
  /** A line under the drop zone, e.g. what happens after the upload. */
  note?: ReactNode;
}) {
  const input = useRef<HTMLInputElement>(null);
  const [over, setOver] = useState(false);
  const [wrongType, setWrongType] = useState("");

  const take = (file?: File | null) => {
    if (!file) return;
    if (!ACCEPT.some((ext) => file.name.toLowerCase().endsWith(ext))) {
      setWrongType(`${file.name} isn't a spreadsheet. Use an .xlsx, .xls or .csv file.`);
      return;
    }
    setWrongType("");
    onFile(file);
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!busy) { setWrongType(""); onOpenChange(o); } }}>
      <DialogContent className="gap-0 overflow-hidden p-0 sm:max-w-[480px]" showCloseButton={!busy}>
        <div className="space-y-1.5 px-5 pb-4 pt-5">
          <DialogTitle className="pr-6 text-[15px] font-semibold leading-5">{title}</DialogTitle>
          {description && <DialogDescription className="text-[13px] leading-5">{description}</DialogDescription>}
        </div>

        <div className="px-5 pb-5">
          {busy ? (
            <div role="status" aria-live="polite" className="flex h-[168px] flex-col items-center justify-center gap-3 rounded-lg border bg-muted/30 px-8">
              <Loader2 className="size-5 animate-spin text-muted-foreground" />
              <div className="w-full max-w-[260px] space-y-1.5">
                <div className="flex justify-between text-[12.5px] text-muted-foreground"><span>Reading rows…</span><span className="tabular-nums">{progress}%</span></div>
                <div className="h-1.5 overflow-hidden rounded-full bg-foreground/[0.08]">
                  <div className="h-full rounded-full bg-[#017D58] transition-[width] duration-200 dark:bg-[#2FB585]" style={{ width: `${progress}%` }} />
                </div>
              </div>
            </div>
          ) : (
            <button type="button" onClick={() => input.current?.click()}
              onDragOver={(e) => { e.preventDefault(); setOver(true); }}
              onDragLeave={() => setOver(false)}
              onDrop={(e) => { e.preventDefault(); setOver(false); take(e.dataTransfer.files?.[0]); }}
              className={cn("group flex h-[168px] w-full flex-col items-center justify-center gap-3 rounded-lg border border-dashed text-center transition-[border-color,background-color]",
                over ? "border-[#017D58] bg-[#017D58]/[0.06] dark:border-[#2FB585] dark:bg-[#2FB585]/[0.08]" : "border-foreground/20 bg-muted/20 hover:border-foreground/35 hover:bg-muted/40")}>
              <span className={cn("flex size-10 items-center justify-center rounded-lg border bg-card shadow-xs transition-transform", over ? "-translate-y-0.5" : "group-hover:-translate-y-0.5")}>
                <Upload className="size-4 text-muted-foreground" />
              </span>
              <span>
                <span className="block text-[13.5px] font-medium text-foreground">{over ? "Drop to upload" : <>Drop a file here or <span className="text-[#017D58] dark:text-[#2FB585]">browse</span></>}</span>
                <span className="mt-0.5 block text-[12.5px] text-muted-foreground">Excel (.xlsx, .xls) or CSV</span>
              </span>
            </button>
          )}
          <input ref={input} type="file" accept={ACCEPT.join(",")} className="hidden" onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ""; take(f); }} />
          {wrongType && <p role="alert" className="mt-2 text-[12.5px] text-red-600 dark:text-red-400">{wrongType}</p>}
          {note && !wrongType && <p className="mt-2 text-[12.5px] text-muted-foreground">{note}</p>}
        </div>

        {onTemplate && (
          <div className="flex items-center gap-3 border-t bg-muted/20 px-5 py-3">
            <span className="flex size-8 shrink-0 items-center justify-center rounded-md bg-[#017D58]/10 dark:bg-[#2FB585]/15">
              <FileSpreadsheet className="size-4 text-[#017D58] dark:text-[#2FB585]" strokeWidth={1.75} />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-[13px] font-medium text-foreground">Sample template</span>
              <span className="block text-[12px] text-muted-foreground">The columns and options the import expects</span>
            </span>
            <button type="button" onClick={onTemplate} disabled={busy} className={DIALOG_BUTTON}>
              <Download className="size-3.5" /> Download
            </button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
