"use client";

import Link from "next/link";
import { createContext, useContext, type ReactNode } from "react";
import { ChevronRight } from "lucide-react";
import { NameAvatar } from "@/components/shared/name-avatar";
import type { KanbanCardData } from "@/components/views/kanban-board";
import { cn } from "@/lib/utils";

// On phones a module's DataTable renders its rows as a native list instead of a
// wide table. The module says what a row shows once (the same mapping its board
// cards use), through this context, so every page gets the list for free.

/** What a list row shows: the board card's fields, plus a status beside the subtitle. */
export interface MobileRowData extends KanbanCardData {
  status?: { label: string; dot?: string };
}

interface MobileRowsConfig {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  row: (item: any) => MobileRowData;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  onOpen?: (item: any) => void;
}

const MobileRowsContext = createContext<MobileRowsConfig | null>(null);

export function MobileRowsProvider<T>({
  row,
  onOpen,
  children,
}: {
  row: (item: T) => MobileRowData;
  onOpen?: (item: T) => void;
  children: ReactNode;
}) {
  return <MobileRowsContext.Provider value={{ row, onOpen }}>{children}</MobileRowsContext.Provider>;
}

export const useMobileRows = () => useContext(MobileRowsContext);

const rowClass =
  "flex min-h-[68px] w-full items-center gap-3 pl-4 text-left outline-none transition-colors duration-100 active:bg-muted focus-visible:bg-muted";

/** Rows as a full-bleed list: avatar, title over a muted line, ID and tag on the right. */
export function MobileRecordList<T>({ items, config }: { items: T[]; config: MobileRowsConfig }) {
  return (
    <ul className="m-list">
      {items.map((item, i) => {
        const r = config.row(item);
        const body = (
          <>
            {r.avatar !== false && <NameAvatar name={r.title} className="size-10 text-[15px]" />}
            <span className="m-row-divider flex min-h-[68px] min-w-0 flex-1 items-center gap-2 py-2.5 pr-3">
              <span className="min-w-0 flex-1">
                <span className="flex items-baseline gap-2">
                  <span className="min-w-0 flex-1 truncate text-[16px] font-medium text-foreground">{r.title || "—"}</span>
                  {r.id != null && <span className="shrink-0 text-[13px] tabular-nums text-muted-foreground">{r.id}</span>}
                </span>
                {(r.subtitle || r.status) && (
                  <span className="mt-0.5 flex items-center gap-1.5 text-[14px] text-muted-foreground">
                    {r.status && (
                      <span className="inline-flex shrink-0 items-center gap-1.5 text-foreground/80">
                        {r.status.dot && <span className={cn("size-2 rounded-full", r.status.dot)} />}
                        <span className="capitalize">{r.status.label}</span>
                      </span>
                    )}
                    {r.status && r.subtitle && <span aria-hidden>·</span>}
                    {r.subtitle && <span className="min-w-0 truncate">{r.subtitle}</span>}
                  </span>
                )}
                {(r.footer || r.tag) && (
                  <span className="mt-1 flex items-center gap-2 text-[13px] text-muted-foreground">
                    {r.footer && <span className="flex min-w-0 items-center gap-1.5 truncate">{r.footer}</span>}
                    {r.tag && <span className="ml-auto shrink-0 rounded bg-muted px-1.5 py-px text-[12px] capitalize">{r.tag}</span>}
                  </span>
                )}
              </span>
              <ChevronRight className="size-[18px] shrink-0 text-muted-foreground/50" strokeWidth={2} />
            </span>
          </>
        );
        return (
          <li key={i}>
            {r.href ? (
              <Link href={r.href} className={rowClass}>
                {body}
              </Link>
            ) : (
              <button type="button" className={rowClass} onClick={() => config.onOpen?.(item)}>
                {body}
              </button>
            )}
          </li>
        );
      })}
    </ul>
  );
}
