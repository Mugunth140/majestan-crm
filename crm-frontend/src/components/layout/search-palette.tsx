"use client";

import { Fragment, useEffect, useMemo, useRef, useState, type ComponentType, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { Dialog as DialogPrimitive } from "@base-ui/react/dialog";
import { ArrowRight, Clock, CornerDownLeft, Database, Loader2, Search, X, type LucideProps } from "lucide-react";
import { apiJson } from "@/lib/api-fetch";
import { NameAvatar } from "@/components/shared/name-avatar";
import { cn } from "@/lib/utils";
import { NAVIGATION, canSee, type NavViewer } from "./nav-items";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "/api/v1";

// Opens on ⌘K / Ctrl+K anywhere in the app.
export function useSearchShortcut(setOpen: (fn: (open: boolean) => boolean) => void) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key.toLowerCase() === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setOpen((o) => !o);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [setOpen]);
}

/** The modules records can be searched in: the server's scopes, with how they look here. */
export const SCOPES = [
  { key: "leads", label: "Leads", href: "/leads", words: ["leads", "customers"], hint: "ID, name, phone or email" },
  { key: "inbound", label: "Inbound", href: "/inbound", words: ["inbound", "owners"], hint: "ID, title, owner, locality or phone" },
  { key: "partners", label: "Agent Network", href: "/agent-network", words: ["agents", "partners", "network", "brokers"], hint: "ID, name, company, city or phone" },
  { key: "properties", label: "Properties", href: "/properties", words: ["properties", "listings"], hint: "code, title or city" },
  { key: "projects", label: "Projects", href: "/projects", words: ["projects"], hint: "code, name, builder or city" },
  { key: "builders", label: "Builders", href: "/builders", words: ["builders", "developers"], hint: "name, email or phone" },
  { key: "hr", label: "HR Candidates", href: "/hr", words: ["hr", "candidates", "hiring"], hint: "ID, name, position or phone" },
  { key: "assets", label: "Asset Inventory", href: "/asset-inventory", words: ["assets", "inventory"], hint: "ID, owner or phone" },
  { key: "users", label: "Users", href: "/users", words: ["users", "staff", "team"], hint: "name, email or phone" },
] as const;
export type ScopeKey = (typeof SCOPES)[number]["key"];
type Scope = (typeof SCOPES)[number];

/** Scopes whose name starts with what was typed: "inb" → Inbound. */
export function scopesMatching(text: string, allowed: readonly string[]): Scope[] {
  const q = text.trim().toLowerCase().replace(/:$/, "");
  if (!q) return [];
  return SCOPES.filter((s) => allowed.includes(s.key) && (s.words.some((w) => w.startsWith(q)) || s.label.toLowerCase().startsWith(q)));
}

interface Hit {
  id: number;
  code: string;
  title: string;
  subtitle?: string;
  href: string;
  person?: { id: number | null; name: string } | null;
  avatar?: string | null;
}
interface Recent extends Hit { scope: ScopeKey }

type Row =
  | { kind: "scope"; key: string; scope: Scope }
  | { kind: "record"; key: string; scope: ScopeKey; hit: Hit; recent?: boolean }
  | { kind: "page"; key: string; title: string; href: string; crumb?: string; icon: ReactNode };

const RECENT_KEY = "search:recent";
const readRecent = (): Recent[] => {
  try { const v = JSON.parse(localStorage.getItem(RECENT_KEY) || "[]"); return Array.isArray(v) ? v.slice(0, 6) : []; } catch { return []; }
};
const remember = (r: Recent) => {
  try {
    const next = [r, ...readRecent().filter((x) => x.href !== r.href)].slice(0, 6);
    localStorage.setItem(RECENT_KEY, JSON.stringify(next));
  } catch { /* storage blocked: no recents */ }
};

const navFor = (href: string) => NAVIGATION.find((n) => n.href === href);
function ScopeIcon({ scope, className }: { scope: Scope; className?: string }) {
  const nav = navFor(scope.href);
  const Icon: ComponentType<LucideProps> = nav?.icon ?? Database;
  return <Icon className={cn("size-4", nav?.color, className)} strokeWidth={1.75} />;
}
const scopeOf = (key: string) => SCOPES.find((s) => s.key === key)!;

/** The matched part of a label in the foreground, the rest muted. */
function Highlight({ text, query }: { text: string; query: string }) {
  const q = query.trim();
  const i = q ? text.toLowerCase().indexOf(q.toLowerCase()) : -1;
  if (i < 0) return <>{text}</>;
  return <>{text.slice(0, i)}<mark className="rounded-[3px] bg-amber-200/70 px-px text-inherit dark:bg-amber-400/25">{text.slice(i, i + q.length)}</mark>{text.slice(i + q.length)}</>;
}

/**
 * ⌘K: find any record or page. Typing a module's name ("inb") offers it as a
 * filter; Enter or Tab pins it, and the search then looks only there.
 */
export function SearchPalette({ open, onOpenChange, viewer }: { open: boolean; onOpenChange: (open: boolean) => void; viewer: NavViewer | null }) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [scope, setScope] = useState<Scope | null>(null);
  const [allowed, setAllowed] = useState<string[]>([]);
  // Results carry the search they answer, so a stale answer never shows.
  const [results, setResults] = useState<{ key: string; groups: { scope: ScopeKey; items: Hit[] }[] }>({ key: "", groups: [] });
  const [pending, setPending] = useState("");
  const [recent, setRecent] = useState<Recent[]>([]);
  const input = useRef<HTMLInputElement>(null);
  const list = useRef<HTMLDivElement>(null);
  const seq = useRef(0);

  // Which modules this person can search, once per opening.
  useEffect(() => {
    if (!open) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- localStorage is read when the palette opens
    setRecent(readRecent());
    apiJson<{ data?: string[] }>(`${API_URL}/search/scopes`).then((r) => setAllowed(r.data ?? [])).catch(() => setAllowed([]));
  }, [open]);

  // Records, a moment after typing stops.
  const text = query.trim();
  const searchable = open && (text.length >= 2 || /^\d+$/.test(text));
  const searchKey = searchable ? `${scope?.key ?? ""}|${text}` : "";
  useEffect(() => {
    if (!searchKey) return;
    const id = ++seq.current;
    const t = setTimeout(() => {
      setPending(searchKey);
      const params = new URLSearchParams({ q: text });
      if (scope) params.set("scope", scope.key);
      apiJson<{ data?: { groups: { scope: ScopeKey; items: Hit[] }[] } }>(`${API_URL}/search?${params}`)
        .then((r) => { if (id === seq.current) setResults({ key: searchKey, groups: r.data?.groups ?? [] }); })
        .catch(() => { if (id === seq.current) setResults({ key: searchKey, groups: [] }); });
    }, 180);
    return () => clearTimeout(t);
  }, [searchKey, text, scope]);
  const groups = useMemo(() => (searchKey && results.key === searchKey ? results.groups : []), [searchKey, results]);
  const loading = !!searchKey && results.key !== searchKey && pending === searchKey;

  const pages = useMemo(() => {
    const out: Extract<Row, { kind: "page" }>[] = [];
    for (const item of NAVIGATION) {
      if (!canSee(item, viewer)) continue;
      const Icon = item.icon;
      if (item.href) out.push({ kind: "page", key: `p:${item.href}`, title: item.name, href: item.href, icon: <Icon className={cn("size-4", item.color)} strokeWidth={1.75} /> });
      for (const sub of item.subItems ?? []) {
        out.push({ kind: "page", key: `p:${sub.href}`, title: sub.name, href: sub.href, crumb: item.name, icon: <Database className={cn("size-4", item.color)} strokeWidth={1.75} /> });
      }
    }
    return out;
  }, [viewer]);

  // Everything on screen, in order, in sections; the arrow keys walk `rows`.
  const sections = useMemo(() => {
    const out: { label: string; rows: Row[] }[] = [];
    if (scope) {
      for (const g of groups) out.push({ label: scope.label, rows: g.items.map((hit) => ({ kind: "record", key: `${g.scope}:${hit.id}`, scope: g.scope, hit })) });
      return out;
    }
    const filters = text ? scopesMatching(text, allowed) : [];
    if (filters.length) out.push({ label: "Search in", rows: filters.map((s) => ({ kind: "scope", key: `s:${s.key}`, scope: s })) });
    if (!text) {
      const mine = recent.filter((r) => allowed.includes(r.scope));
      if (mine.length) out.push({ label: "Recently opened", rows: mine.map((r) => ({ kind: "record", key: `r:${r.href}`, scope: r.scope, hit: r, recent: true })) });
      out.push({ label: "Search in", rows: SCOPES.filter((s) => allowed.includes(s.key)).map((s) => ({ kind: "scope", key: `s:${s.key}`, scope: s })) });
    }
    for (const g of groups) out.push({ label: scopeOf(g.scope).label, rows: g.items.map((hit) => ({ kind: "record", key: `${g.scope}:${hit.id}`, scope: g.scope, hit })) });
    const q = text.toLowerCase();
    const pageRows = q ? pages.filter((p) => p.title.toLowerCase().includes(q) || p.crumb?.toLowerCase().includes(q)) : [];
    if (pageRows.length) out.push({ label: "Pages", rows: pageRows });
    return out.filter((s) => s.rows.length);
  }, [scope, groups, text, allowed, recent, pages]);
  const rows = useMemo(() => sections.flatMap((s) => s.rows), [sections]);

  // The first row is ready for Enter whenever the list changes.
  const listKey = `${searchKey}|${results.key === searchKey}|${text}|${scope?.key ?? ""}`;
  const [cursor, setCursor] = useState({ key: "", i: 0 });
  const active = cursor.key === listKey ? cursor.i : 0;
  const setActive = (next: number | ((i: number) => number)) =>
    setCursor((c) => ({ key: listKey, i: typeof next === "function" ? next(c.key === listKey ? c.i : 0) : next }));
  useEffect(() => {
    list.current?.querySelector(`[data-index="${active}"]`)?.scrollIntoView({ block: "nearest" });
  }, [active]);

  const reset = () => { setQuery(""); setScope(null); };
  const close = () => { onOpenChange(false); reset(); };
  const pickScope = (s: Scope) => { setScope(s); setQuery(""); input.current?.focus(); };
  const run = (row: Row, newTab = false) => {
    if (row.kind === "scope") return pickScope(row.scope);
    const href = row.kind === "page" ? row.href : row.hit.href;
    if (row.kind === "record") remember({ ...row.hit, scope: row.scope });
    close();
    if (newTab) window.open(href, "_blank");
    else router.push(href);
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "ArrowDown") { e.preventDefault(); setActive((a) => Math.min(rows.length - 1, a + 1)); }
    else if (e.key === "ArrowUp") { e.preventDefault(); setActive((a) => Math.max(0, a - 1)); }
    else if (e.key === "Enter") {
      e.preventDefault();
      const row = rows[active];
      if (row) run(row, e.metaKey || e.ctrlKey);
    } else if (e.key === "Tab" && !scope) {
      // Tab completes a module filter, wherever the cursor is in the list.
      const s = rows[active]?.kind === "scope" ? (rows[active] as Extract<Row, { kind: "scope" }>).scope : scopesMatching(text, allowed)[0];
      if (s) { e.preventDefault(); pickScope(s); }
    } else if (e.key === "Backspace" && !query && scope) {
      e.preventDefault();
      setScope(null);
    }
  };
  const onChange = (value: string) => {
    // "inbound:" pins the filter straight away.
    const m = !scope && /^(\S+):\s*(.*)$/.exec(value);
    const s = m ? scopesMatching(m[1], allowed)[0] : undefined;
    if (m && s) { setScope(s); setQuery(m[2]); return; }
    setQuery(value);
  };

  const placeholder = scope ? `Search ${scope.label.toLowerCase()} by ${scope.hint}…` : "Search leads, inbound, properties, people, pages…";
  let index = -1;

  return (
    <DialogPrimitive.Root open={open} onOpenChange={(o) => { onOpenChange(o); if (!o) reset(); }}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Backdrop className="fixed inset-0 z-50 bg-black/20 duration-100 data-open:animate-in data-open:fade-in-0 data-closed:animate-out data-closed:fade-out-0 dark:bg-black/50" />
        <DialogPrimitive.Popup
          initialFocus={input}
          className="fixed left-1/2 top-[10vh] z-50 flex max-h-[min(560px,80vh)] w-[calc(100%-24px)] max-w-[640px] -translate-x-1/2 flex-col overflow-hidden rounded-xl bg-popover text-popover-foreground shadow-[0_24px_64px_-12px_rgba(0,0,0,0.3),0_0_0_1px_rgba(0,0,0,0.08)] outline-none duration-100 data-open:animate-in data-open:fade-in-0 data-open:zoom-in-[0.98] data-closed:animate-out data-closed:fade-out-0 dark:shadow-[0_24px_64px_-12px_rgba(0,0,0,0.7),0_0_0_1px_rgba(255,255,255,0.1)]"
        >
          <DialogPrimitive.Title className="sr-only">Search</DialogPrimitive.Title>
          <div className="flex items-center gap-2 border-b px-3.5">
            {loading ? <Loader2 className="size-4 shrink-0 animate-spin text-muted-foreground" /> : <Search className="size-4 shrink-0 text-muted-foreground" strokeWidth={1.75} />}
            {scope && (
              <span className="flex h-6 shrink-0 items-center gap-1.5 rounded-md bg-muted pl-1.5 pr-1 text-[12.5px] font-medium">
                <ScopeIcon scope={scope} className="size-3.5" />
                {scope.label}
                <button type="button" aria-label={`Stop searching only ${scope.label}`} onClick={() => { setScope(null); input.current?.focus(); }}
                  className="flex size-4 items-center justify-center rounded text-muted-foreground hover:bg-foreground/10 hover:text-foreground">
                  <X className="size-3" />
                </button>
              </span>
            )}
            <input
              ref={input}
              value={query}
              onChange={(e) => onChange(e.target.value)}
              onKeyDown={onKeyDown}
              placeholder={placeholder}
              aria-label="Search"
              role="combobox"
              aria-expanded
              aria-controls="search-results"
              aria-activedescendant={rows[active] ? `search-row-${active}` : undefined}
              className="h-12 min-w-0 flex-1 bg-transparent text-[15px] outline-none placeholder:text-muted-foreground/80"
            />
            <kbd className="hidden rounded border px-1.5 py-0.5 text-[11px] text-muted-foreground sm:block">esc</kbd>
          </div>

          <div ref={list} id="search-results" role="listbox" className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-1.5">
            {sections.map((section) => (
              <Fragment key={section.label + section.rows[0]?.key}>
                <div className="px-2 pb-1 pt-2.5 text-[11.5px] font-medium text-muted-foreground">{section.label}</div>
                {section.rows.map((row) => {
                  index += 1;
                  const i = index;
                  const on = i === active;
                  return (
                    <div
                      key={row.key}
                      id={`search-row-${i}`}
                      data-index={i}
                      role="option"
                      aria-selected={on}
                      onMouseMove={() => { if (active !== i) setActive(i); }}
                      onClick={(e) => run(row, e.metaKey || e.ctrlKey)}
                      className={cn("flex min-h-10 cursor-pointer items-center gap-3 rounded-lg px-2 py-1.5", on && "bg-muted")}
                    >
                      <RowBody row={row} query={text} on={on} />
                    </div>
                  );
                })}
              </Fragment>
            ))}
            {!sections.length && (
              <p className="px-3 py-10 text-center text-[13.5px] text-muted-foreground">
                {loading ? "Searching…" : text || scope ? (text.length < 2 && !/^\d+$/.test(text) ? `Type to search ${scope ? scope.label.toLowerCase() : "everything"}` : `Nothing matches “${text}”${scope ? ` in ${scope.label}` : ""}`) : "Type to search"}
              </p>
            )}
          </div>

          <div className="hidden items-center gap-4 border-t px-3.5 py-2 text-[11.5px] text-muted-foreground sm:flex">
            <span className="flex items-center gap-1"><Kbd>↑</Kbd><Kbd>↓</Kbd> move</span>
            <span className="flex items-center gap-1"><Kbd><CornerDownLeft className="size-3" /></Kbd> open</span>
            {!scope && <span className="flex items-center gap-1"><Kbd>tab</Kbd> filter by module</span>}
            {scope && <span className="flex items-center gap-1"><Kbd>⌫</Kbd> all modules</span>}
            <span className="ml-auto flex items-center gap-1"><Kbd>ctrl</Kbd><Kbd><CornerDownLeft className="size-3" /></Kbd> new tab</span>
          </div>
        </DialogPrimitive.Popup>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}

const Kbd = ({ children }: { children: ReactNode }) => (
  <kbd className="inline-flex h-[18px] min-w-[18px] items-center justify-center rounded border bg-background px-1 font-sans text-[10.5px]">{children}</kbd>
);

function RowBody({ row, query, on }: { row: Row; query: string; on: boolean }) {
  if (row.kind === "scope") {
    return (
      <>
        <span className="flex size-6 items-center justify-center"><ScopeIcon scope={row.scope} /></span>
        <span className="flex-1 truncate text-[14px]">Search in <span className="font-medium">{row.scope.label}</span></span>
        <span className={cn("hidden text-[12px] text-muted-foreground sm:block", !on && "invisible")}>by {row.scope.hint}</span>
        <ArrowRight className={cn("size-3.5 text-muted-foreground", !on && "invisible")} />
      </>
    );
  }
  if (row.kind === "page") {
    return (
      <>
        <span className="flex size-6 items-center justify-center">{row.icon}</span>
        <span className="flex-1 truncate text-[14px]"><Highlight text={row.title} query={query} /></span>
        {row.crumb && <span className="text-[12px] text-muted-foreground">{row.crumb}</span>}
      </>
    );
  }
  const { hit } = row;
  const scope = scopeOf(row.scope);
  return (
    <>
      <span className="relative flex size-6 shrink-0 items-center justify-center">
        {row.recent ? <Clock className="size-4 text-muted-foreground" strokeWidth={1.75} /> : <ScopeIcon scope={scope} />}
      </span>
      <span className="min-w-0 flex-1">
        <span className="flex items-baseline gap-2">
          <span className="truncate text-[14px] font-medium"><Highlight text={hit.title} query={query} /></span>
          <span className="shrink-0 font-mono text-[11.5px] text-muted-foreground"><Highlight text={hit.code} query={query} /></span>
        </span>
        {hit.subtitle && <span className="block truncate text-[12.5px] text-muted-foreground"><Highlight text={hit.subtitle} query={query} /></span>}
      </span>
      {hit.person && (
        <span className="hidden max-w-[140px] shrink-0 items-center gap-1.5 text-[12px] text-muted-foreground sm:flex">
          <NameAvatar name={hit.person.name} src={hit.avatar} userId={hit.person.id} staff className="size-5 text-[10px]" />
          {row.scope !== "users" && <span className="truncate">{hit.person.name}</span>}
        </span>
      )}
      {row.recent && <span className="shrink-0 text-[11.5px] text-muted-foreground">{scope.label}</span>}
    </>
  );
}
