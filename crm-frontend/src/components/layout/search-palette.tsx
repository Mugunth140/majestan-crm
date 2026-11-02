"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { CommandPalette } from "@cloudflare/kumo/components/command-palette";
import { Database } from "lucide-react";
import { cn } from "@/lib/utils";
import { NAVIGATION, canSee, type NavViewer } from "./nav-items";

interface Entry {
  title: string;
  href: string;
  breadcrumbs?: string[];
  icon: React.ReactNode;
}
interface Group {
  label: string;
  items: Entry[];
}

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

// Jump-to-page search over the sidebar navigation.
export function SearchPalette({
  open,
  onOpenChange,
  viewer,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  viewer: NavViewer | null;
}) {
  const router = useRouter();
  const [query, setQuery] = useState("");

  const groups = useMemo<Group[]>(() => {
    const pages: Entry[] = [];
    const registry: Entry[] = [];
    for (const item of NAVIGATION) {
      if (!canSee(item.access, viewer)) continue;
      const Icon = item.icon;
      if (item.href) {
        pages.push({ title: item.name, href: item.href, icon: <Icon className={cn("size-4", item.color)} strokeWidth={1.75} /> });
      }
      for (const sub of item.subItems ?? []) {
        registry.push({
          title: sub.name,
          href: sub.href,
          breadcrumbs: [item.name],
          icon: <Database className={cn("size-4", item.color)} strokeWidth={1.75} />,
        });
      }
    }
    const q = query.trim().toLowerCase();
    const match = (e: Entry) => !q || e.title.toLowerCase().includes(q) || e.breadcrumbs?.some((b) => b.toLowerCase().includes(q));
    return [
      { label: "Pages", items: pages.filter(match) },
      { label: "Master Registry", items: registry.filter(match) },
    ].filter((g) => g.items.length);
  }, [query, viewer]);

  const go = (entry: Entry, newTab = false) => {
    onOpenChange(false);
    setQuery("");
    if (newTab) window.open(entry.href, "_blank");
    else router.push(entry.href);
  };

  return (
    <CommandPalette.Root<Group, Entry>
      open={open}
      onOpenChange={(o) => {
        onOpenChange(o);
        if (!o) setQuery("");
      }}
      items={groups}
      value={query}
      onValueChange={setQuery}
      itemToStringValue={(g) => g.label}
      filter={() => true}
      getSelectableItems={(gs) => gs.flatMap((g) => g.items)}
      onSelect={(entry, { newTab }) => go(entry, newTab)}
    >
      <CommandPalette.Input placeholder="Search pages…" />
      <CommandPalette.List>
        <CommandPalette.Results>
          {(group: Group) => (
            <CommandPalette.Group key={group.label} items={group.items}>
              <CommandPalette.GroupLabel>{group.label}</CommandPalette.GroupLabel>
              <CommandPalette.Items>
                {(entry: Entry) => (
                  <CommandPalette.ResultItem
                    key={entry.href}
                    title={entry.title}
                    breadcrumbs={entry.breadcrumbs}
                    icon={entry.icon}
                    value={entry}
                    onClick={(e) => go(entry, e.metaKey || e.ctrlKey)}
                  />
                )}
              </CommandPalette.Items>
            </CommandPalette.Group>
          )}
        </CommandPalette.Results>
        <CommandPalette.Empty>No pages match “{query}”</CommandPalette.Empty>
      </CommandPalette.List>
    </CommandPalette.Root>
  );
}
