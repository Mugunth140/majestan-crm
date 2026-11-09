"use client";
import { useMemo, useRef, useState } from "react";
import { Building2, Check, ChevronDown, Search, Users } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Avatar } from "@/components/record/feed";
import { toolbarButtonClass } from "@/components/layout/list-page";
import { cn } from "@/lib/utils";
import type { Person, Subjects } from "./types";

type Option = { key: string; label: string; detail?: string; person?: Person; icon?: "all" | "dept"; group: string };

/** Everyone / a department / one person, searchable, grouped by department. */
export function subjectOptions(s: Subjects): Option[] {
  const out: Option[] = [];
  if (s.scope === "organization") out.push({ key: "all", label: "Everyone", detail: "The whole business", icon: "all", group: "" });
  if (s.scope !== "self") {
    for (const d of s.departments) out.push({ key: `dept:${d.id}`, label: d.label, detail: `${d.members} ${d.members === 1 ? "person" : "people"}`, icon: "dept", group: "Departments" });
  }
  const groupOf = (p: Person) => s.departments.find((d) => d.id === p.departmentId)?.label ?? p.department ?? "No department";
  const people = [...s.people].sort((a, b) => groupOf(a).localeCompare(groupOf(b)) || a.name.localeCompare(b.name));
  for (const p of people) out.push({ key: `user:${p.id}`, label: p.id === s.me.id ? `${p.name} (you)` : p.name, detail: p.role, person: p, group: groupOf(p) });
  return out;
}

export function SubjectIcon({ option, className }: { option: Pick<Option, "icon" | "person" | "label">; className?: string }) {
  if (option.person) return <Avatar name={option.person.name} src={option.person.avatar} userId={option.person.id} staff className={cn("size-5", className)} />;
  const Icon = option.icon === "all" ? Building2 : Users;
  return (
    <span className={cn("inline-flex size-5 shrink-0 items-center justify-center rounded-full bg-foreground/[0.07]", className)}>
      <Icon aria-hidden className="size-3 text-foreground/70" />
    </span>
  );
}

export function SubjectPicker({ subjects, value, onChange, className }: { subjects: Subjects; value: string; onChange: (key: string) => void; className?: string }) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [cursor, setCursor] = useState(0);
  const list = useRef<HTMLDivElement>(null);
  const options = useMemo(() => subjectOptions(subjects), [subjects]);
  const current = options.find((o) => o.key === value) ?? options[0];
  const q = query.trim().toLowerCase();
  const filtered = q ? options.filter((o) => `${o.label} ${o.detail ?? ""} ${o.group}`.toLowerCase().includes(q)) : options;

  const pick = (key: string) => {
    onChange(key);
    setOpen(false);
    setQuery("");
  };
  const move = (by: number) => {
    const next = Math.max(0, Math.min(filtered.length - 1, cursor + by));
    setCursor(next);
    list.current?.querySelector(`[data-index="${next}"]`)?.scrollIntoView({ block: "nearest" });
  };

  return (
    <Popover open={open} onOpenChange={(o) => { setOpen(o); if (o) setCursor(Math.max(0, filtered.findIndex((f) => f.key === value))); else setQuery(""); }}>
      <PopoverTrigger className={cn(toolbarButtonClass, "max-w-64 pl-1.5", className)} aria-label={`Showing ${current?.label ?? "dashboard"}. Change who to show`}>
        {current && <SubjectIcon option={current} />}
        <span className="truncate font-medium">{current?.label ?? "Choose"}</span>
        <ChevronDown aria-hidden className="size-3.5 shrink-0 text-muted-foreground" />
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 gap-0 p-0">
        <div className="relative border-b">
          <Search aria-hidden className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <input
            autoFocus
            value={query}
            onChange={(e) => { setQuery(e.target.value); setCursor(0); }}
            onKeyDown={(e) => {
              if (e.key === "ArrowDown") { e.preventDefault(); move(1); }
              else if (e.key === "ArrowUp") { e.preventDefault(); move(-1); }
              else if (e.key === "Enter" && filtered[cursor]) { e.preventDefault(); pick(filtered[cursor].key); }
            }}
            placeholder="Search people or departments"
            aria-label="Search people or departments"
            className="h-10 w-full bg-transparent pl-9 pr-3 text-[13px] outline-none placeholder:text-muted-foreground"
          />
        </div>
        <div ref={list} role="listbox" aria-label="Show dashboard for" className="max-h-[min(24rem,60vh)] overflow-y-auto p-1.5">
          {filtered.length === 0 && <p className="px-3 py-6 text-center text-[13px] text-muted-foreground">No match for “{query}”</p>}
          {filtered.map((o, i) => (
            <div key={o.key}>
              {(i === 0 || filtered[i - 1].group !== o.group) && o.group && (
                <div className="px-2.5 pb-1 pt-2.5 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">{o.group}</div>
              )}
              <button
                type="button"
                role="option"
                aria-selected={o.key === value}
                data-index={i}
                onPointerMove={() => cursor !== i && setCursor(i)}
                onClick={() => pick(o.key)}
                className={cn("flex w-full items-center gap-2.5 rounded-md px-2.5 py-1.5 text-left text-[13px] outline-none", cursor === i && "bg-muted")}
              >
                <SubjectIcon option={o} className="size-6" />
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-medium text-foreground">{o.label}</span>
                  {o.detail && <span className="block truncate text-xs text-muted-foreground">{o.detail}</span>}
                </span>
                {o.key === value && <Check aria-hidden className="size-4 text-foreground" />}
              </button>
            </div>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
}
