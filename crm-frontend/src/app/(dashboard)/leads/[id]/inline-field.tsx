"use client";

import { useMemo, useRef, useState, type ReactNode } from "react";
import { ChevronDown, Loader2 } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";

// Frappe-style record fields: each row reads as plain text and turns into an
// input on hover/focus. A change saves on blur or Enter; Escape reverts.

const CONTROL =
  "h-8 w-full min-w-0 rounded-md border border-transparent bg-transparent px-2 text-[14px] text-foreground outline-none transition-colors placeholder:text-muted-foreground/60 hover:bg-foreground/[0.05] focus:border-border focus:bg-background focus:hover:bg-background disabled:cursor-default disabled:hover:bg-transparent";

export function FieldRow({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex min-h-9 items-center gap-2">
      <span className="w-[112px] shrink-0 truncate text-[13px] text-muted-foreground">{label}</span>
      <div className="relative flex min-w-0 flex-1 items-center">{children}</div>
    </div>
  );
}

type Save = (value: string) => Promise<unknown> | void;

function useSaving(onSave: Save) {
  const [saving, setSaving] = useState(false);
  const run = async (value: string) => {
    setSaving(true);
    try {
      await onSave(value);
    } finally {
      setSaving(false);
    }
  };
  return { saving, run };
}

function Spinner() {
  return <Loader2 className="absolute right-2 h-3.5 w-3.5 animate-spin text-muted-foreground" />;
}

export function InlineText({
  label,
  value,
  onSave,
  disabled,
  placeholder = "Add…",
  type = "text",
  multiline,
}: {
  label: string;
  value: string | number | null | undefined;
  onSave: Save;
  disabled?: boolean;
  placeholder?: string;
  type?: "text" | "tel" | "email" | "number";
  multiline?: boolean;
}) {
  const stored = value == null ? "" : String(value);
  const [draft, setDraft] = useState(stored);
  const [synced, setSynced] = useState(stored);
  const { saving, run } = useSaving(onSave);
  const skipBlur = useRef(false);

  // A refetch brings a new stored value: show it instead of the old draft.
  if (synced !== stored) {
    setSynced(stored);
    setDraft(stored);
  }

  const commit = async () => {
    if (skipBlur.current) {
      skipBlur.current = false;
      return;
    }
    if (draft.trim() === stored.trim()) return;
    try {
      await run(draft.trim());
    } catch {
      setDraft(stored);
    }
  };

  const shared = {
    "aria-label": label,
    value: draft,
    disabled: disabled || saving,
    placeholder: disabled ? "—" : placeholder,
    onBlur: commit,
  };

  return (
    <FieldRow label={label}>
      {multiline ? (
        <textarea
          {...shared}
          rows={1}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Escape") {
              skipBlur.current = true;
              setDraft(stored);
              e.currentTarget.blur();
            }
          }}
          className={cn(CONTROL, "field-sizing-content h-auto min-h-8 resize-none py-1.5 leading-5")}
        />
      ) : (
        <input
          {...shared}
          type={type}
          inputMode={type === "number" ? "decimal" : undefined}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") e.currentTarget.blur();
            if (e.key === "Escape") {
              skipBlur.current = true;
              setDraft(stored);
              e.currentTarget.blur();
            }
          }}
          className={cn(CONTROL, saving && "pr-7")}
        />
      )}
      {saving && <Spinner />}
    </FieldRow>
  );
}

export type Option = { label: string; value: string; dot?: string };

export function InlineSelect({
  label,
  value,
  options,
  onSave,
  disabled,
  placeholder = "Select…",
}: {
  label: string;
  value: string | null | undefined;
  options: Option[];
  onSave: Save;
  disabled?: boolean;
  placeholder?: string;
}) {
  const { saving, run } = useSaving(onSave);
  const byValue = useMemo(() => new Map(options.map((o) => [o.value, o])), [options]);
  const current = value ? byValue.get(value) : undefined;

  if (disabled) {
    return (
      <FieldRow label={label}>
        <span className="flex h-8 items-center gap-2 px-2 text-[14px] text-foreground">
          {current?.dot && <span className={cn("h-2 w-2 rounded-full", current.dot)} />}
          {current?.label ?? (value || "—")}
        </span>
      </FieldRow>
    );
  }

  return (
    <FieldRow label={label}>
      <Select
        value={value ?? ""}
        onValueChange={(next) => {
          if (next && next !== value) run(String(next)).catch(() => {});
        }}
        disabled={saving}
      >
        <SelectTrigger
          aria-label={label}
          className="h-8 w-full border-transparent bg-transparent px-2 text-[14px] shadow-none hover:bg-foreground/[0.05] dark:bg-transparent dark:hover:bg-foreground/[0.05] [&>svg]:opacity-0 hover:[&>svg]:opacity-100"
        >
          <SelectValue placeholder={placeholder}>
            {(val: string | null) => {
              const opt = val ? byValue.get(val) : undefined;
              if (!val) return <span className="text-muted-foreground/60">{placeholder}</span>;
              return (
                <span className="flex min-w-0 items-center gap-2">
                  {opt?.dot && <span className={cn("h-2 w-2 shrink-0 rounded-full", opt.dot)} />}
                  <span className="truncate">{opt?.label ?? val}</span>
                </span>
              );
            }}
          </SelectValue>
        </SelectTrigger>
        <SelectContent className="max-h-[320px]" alignItemWithTrigger={false} side="bottom" align="start">
          {options.map((opt) => (
            <SelectItem key={opt.value} value={opt.value} className="py-1.5 text-[14px]">
              <span className="flex items-center gap-2">
                {opt.dot && <span className={cn("h-2 w-2 rounded-full", opt.dot)} />}
                {opt.label}
              </span>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      {saving && <Spinner />}
    </FieldRow>
  );
}

// A value that opens something else to change it (e.g. the reassign dialog).
export function InlineAction({
  label,
  children,
  onClick,
  disabled,
}: {
  label: string;
  children: ReactNode;
  onClick?: () => void;
  disabled?: boolean;
}) {
  return (
    <FieldRow label={label}>
      <button
        type="button"
        onClick={onClick}
        disabled={disabled || !onClick}
        className="group flex h-8 w-full min-w-0 items-center gap-2 rounded-md px-2 text-left text-[14px] text-foreground transition-colors hover:bg-foreground/[0.05] disabled:cursor-default disabled:hover:bg-transparent"
      >
        <span className="flex min-w-0 flex-1 items-center gap-2 truncate">{children}</span>
        {onClick && !disabled && (
          <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" />
        )}
      </button>
    </FieldRow>
  );
}

export function Section({
  title,
  children,
  defaultOpen = true,
  action,
}: {
  title: string;
  children: ReactNode;
  defaultOpen?: boolean;
  action?: ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <section className="border-b px-3 py-2 last:border-b-0 md:px-4">
      <div className="flex h-9 items-center gap-1">
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          aria-expanded={open}
          className="-ml-1 flex flex-1 items-center gap-1 rounded-md px-1 py-1 text-left text-[14px] font-semibold text-foreground"
        >
          <ChevronDown className={cn("h-4 w-4 text-muted-foreground transition-transform", !open && "-rotate-90")} />
          {title}
        </button>
        {action}
      </div>
      {open && <div className="pb-2">{children}</div>}
    </section>
  );
}
