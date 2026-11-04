"use client";

import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { motion, AnimatePresence } from "motion/react";
import { Building2, Check, ChevronDown, ChevronUp, House, ImageOff, Info, Loader2, Plus, Search, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { MobileHeader } from "@/components/layout/mobile-header";
import { PageActions } from "@/components/layout/page-actions";
import { HEADER_BUTTON, HEADER_PRIMARY } from "@/components/record/header-actions";
import { TabHeader } from "@/components/record/feed";
import { EmptyState, AttachmentsArt } from "@/components/record/empty-state";
import { usePersistedState } from "@/hooks/use-persisted-state";
import { useDebounce } from "@/hooks/use-debounce";
import { useLeaveGuard } from "@/hooks/use-leave-guard";
import { cn } from "@/lib/utils";
import {
  SHOWCASE_MAX_ITEMS,
  showcasesApi,
  type ShowcaseSection,
  type ShowcaseSummary,
} from "@/lib/showcases-api";

const SECTIONS: { value: ShowcaseSection; label: string; noun: string; description: string; icon: typeof House }[] = [
  {
    value: "handpicked_properties",
    icon: House,
    label: "Handpicked Properties",
    noun: "property",
    description: "The property carousel on the home page. Only available, approved properties can be picked.",
  },
  {
    value: "featured_projects",
    icon: Building2,
    label: "Featured Projects",
    noun: "project",
    description: "The project carousel on the home page. Only published projects can be picked.",
  },
];

const sameOrder = (a: ShowcaseSummary[], b: ShowcaseSummary[]) =>
  a.length === b.length && a.every((item, i) => item.id === b[i].id);

function Thumb({ src, className }: { src: string | null; className?: string }) {
  const [failed, setFailed] = useState(false);
  return (
    <div className={cn("flex shrink-0 items-center justify-center overflow-hidden rounded-md border bg-muted", className)}>
      {src && !failed ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={src} alt="" className="h-full w-full object-cover" onError={() => setFailed(true)} />
      ) : (
        <ImageOff className="h-4 w-4 text-muted-foreground" />
      )}
    </div>
  );
}

export default function ShowcasesPage() {
  const [section, setSection] = usePersistedState<ShowcaseSection>("showcases:section", "handpicked_properties", {
    allowed: SECTIONS.map((s) => s.value),
  });
  const spec = SECTIONS.find((s) => s.value === section) ?? SECTIONS[0];

  const [saved, setSaved] = useState<ShowcaseSummary[]>([]);
  const [draft, setDraft] = useState<ShowcaseSummary[]>([]);
  // Loading/searching are derived: a request's result is stored with the key
  // it was made for, and the view is "loading" until the current key lands.
  const loadKey = section;
  const [loadedKey, setLoadedKey] = useState<string | null>(null);
  const isLoading = loadedKey !== loadKey;
  const [isSaving, setIsSaving] = useState(false);
  const [pendingSection, setPendingSection] = useState<ShowcaseSection | null>(null);

  const [query, setQuery] = useState("");
  const debouncedQuery = useDebounce(query, 300);
  const searchKey = `${section}|${debouncedQuery}`;
  const [results, setResults] = useState<{ key: string; items: ShowcaseSummary[] }>({ key: "", items: [] });
  const candidates = results.items;
  const isSearching = results.key !== searchKey;

  const isDirty = !sameOrder(saved, draft);
  const pickedIds = useMemo(() => new Set(draft.map((d) => d.id)), [draft]);
  const isFull = draft.length >= SHOWCASE_MAX_ITEMS;

  const { pendingLeave, cancelLeave, confirmLeave } = useLeaveGuard(() => isDirty);

  useEffect(() => {
    let cancelled = false;
    showcasesApi
      .list(section)
      .then((items) => {
        if (cancelled) return;
        setSaved(items);
        setDraft(items);
      })
      .catch((err) => {
        if (cancelled) return;
        toast.error(err instanceof Error ? err.message : "Failed to load the showcase.");
        setSaved([]);
        setDraft([]);
      })
      .finally(() => {
        if (!cancelled) setLoadedKey(loadKey);
      });
    return () => { cancelled = true; };
  }, [section, loadKey]);

  useEffect(() => {
    let cancelled = false;
    showcasesApi
      .candidates(section, debouncedQuery)
      .catch(() => [] as ShowcaseSummary[])
      .then((items) => { if (!cancelled) setResults({ key: searchKey, items }); });
    return () => { cancelled = true; };
  }, [section, debouncedQuery, searchKey]);

  const changeSection = (next: ShowcaseSection) => {
    setSection(next);
    setQuery("");
  };

  const switchSection = (next: ShowcaseSection) => {
    if (next === section) return;
    if (isDirty) {
      setPendingSection(next);
      return;
    }
    changeSection(next);
  };

  const add = (item: ShowcaseSummary) => {
    if (pickedIds.has(item.id) || isFull) return;
    setDraft((d) => [...d, item]);
  };
  const remove = (id: number) => setDraft((d) => d.filter((x) => x.id !== id));
  const move = (index: number, dir: -1 | 1) =>
    setDraft((d) => {
      const next = index + dir;
      if (next < 0 || next >= d.length) return d;
      const copy = [...d];
      [copy[index], copy[next]] = [copy[next], copy[index]];
      return copy;
    });

  const save = async (): Promise<boolean> => {
    setIsSaving(true);
    try {
      const items = await showcasesApi.save(section, draft.map((d) => d.id));
      setSaved(items);
      setDraft(items);
      toast.success(`${spec.label} updated on the home page.`);
      return true;
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to save the showcase.");
      return false;
    } finally {
      setIsSaving(false);
    }
  };

  const notLiveCount = draft.filter((d) => !d.isLive).length;

  const plural = spec.noun === "property" ? "properties" : "projects";
  const NotLive = () => (
    <span className="shrink-0 rounded-md bg-amber-500/10 px-1.5 text-[12px] font-medium leading-5 text-amber-700 dark:text-amber-300">Not on site</span>
  );

  const sectionTabs = (
    <div role="tablist" aria-label="Showcase sections"
      className="flex shrink-0 gap-1.5 overflow-x-auto px-4 py-2 scrollbar-hide md:gap-5 md:border-b md:px-5 md:py-0">
      {SECTIONS.map((s) => {
        const active = section === s.value;
        return (
          <button
            key={s.value}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => switchSection(s.value)}
            className={cn(
              "relative flex h-8 shrink-0 items-center gap-1.5 rounded-full px-3.5 text-[14px] font-medium transition-colors md:h-11 md:rounded-none md:px-0.5",
              active
                ? "bg-[#017D58] text-white dark:bg-[#2FB585] dark:text-black md:bg-transparent md:text-foreground md:dark:bg-transparent md:dark:text-foreground"
                : "bg-foreground/[0.06] text-foreground/80 md:bg-transparent md:text-muted-foreground md:hover:text-foreground",
            )}
          >
            <s.icon className="hidden h-4 w-4 md:block" />
            {s.label}
            {active && !isLoading ? (
              <span className={cn("rounded-full px-1.5 text-[11px] leading-[18px] tabular-nums", "bg-white/20 md:bg-foreground/[0.08]")}>{draft.length}</span>
            ) : null}
            {active && <span aria-hidden className="absolute inset-x-0 -bottom-px hidden h-0.5 rounded-full bg-foreground md:block" />}
          </button>
        );
      })}
    </div>
  );

  const pickedList = (
    <div className="pb-6">
      <TabHeader title="On the home page" action={<span className="text-[13px] tabular-nums text-muted-foreground">{draft.length} of {SHOWCASE_MAX_ITEMS}</span>} />
      <div className="px-3 sm:px-10">
        <p className="mb-4 text-[14px] text-muted-foreground">{spec.description} Shown in this order.</p>
        {isLoading ? (
          <div className="space-y-2">
            {Array.from({ length: 4 }, (_, i) => <div key={i} className="h-[60px] animate-pulse rounded-lg bg-muted/60" />)}
          </div>
        ) : draft.length === 0 ? (
          <EmptyState art={<AttachmentsArt />} title="Nothing picked yet"
            hint={`Until you pick some, the home page shows the newest ${spec.noun === "property" ? "apartments" : "published projects"} automatically.`} />
        ) : (
          <ol className="overflow-hidden rounded-xl border bg-card">
            <AnimatePresence initial={false}>
              {draft.map((item, index) => (
                <motion.li
                  key={item.id}
                  layout
                  initial={{ opacity: 0, y: -4 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, height: 0 }}
                  transition={{ duration: 0.18 }}
                  className="group flex items-center gap-3 border-b px-3 py-2.5 last:border-b-0 md:px-4"
                >
                  <span className="w-5 shrink-0 text-center text-[13px] tabular-nums text-muted-foreground">{index + 1}</span>
                  <Thumb src={item.imageUrl} className="h-10 w-14" />
                  <div className="min-w-0 flex-1">
                    <div className="flex min-w-0 items-center gap-2">
                      <p className="truncate text-[14px] font-medium text-foreground">{item.title}</p>
                      {!item.isLive && <NotLive />}
                    </div>
                    <p className="truncate text-[13px] text-muted-foreground">{[item.meta, item.location].filter(Boolean).join(" · ")}</p>
                  </div>
                  <div className="flex items-center gap-0.5 text-muted-foreground md:opacity-60 md:transition-opacity md:group-hover:opacity-100">
                    <button type="button" onClick={() => move(index, -1)} disabled={index === 0} aria-label={`Move ${item.title} up`}
                      className="flex h-7 w-7 items-center justify-center rounded-md hover:bg-muted hover:text-foreground disabled:pointer-events-none disabled:opacity-30">
                      <ChevronUp className="h-4 w-4" />
                    </button>
                    <button type="button" onClick={() => move(index, 1)} disabled={index === draft.length - 1} aria-label={`Move ${item.title} down`}
                      className="flex h-7 w-7 items-center justify-center rounded-md hover:bg-muted hover:text-foreground disabled:pointer-events-none disabled:opacity-30">
                      <ChevronDown className="h-4 w-4" />
                    </button>
                    <button type="button" onClick={() => remove(item.id)} aria-label={`Remove ${item.title}`}
                      className="flex h-7 w-7 items-center justify-center rounded-md hover:bg-red-500/10 hover:text-red-600">
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                </motion.li>
              ))}
            </AnimatePresence>
          </ol>
        )}
        {notLiveCount > 0 && (
          <p className="mt-3 flex items-start gap-2 text-[13px] text-muted-foreground">
            <Info className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-600" />
            {notLiveCount === 1 ? "One item is" : `${notLiveCount} items are`} sold, unpublished or awaiting approval. The home page skips them until they&apos;re live again.
          </p>
        )}
      </div>
    </div>
  );

  const picker = (
    <div className="flex min-h-0 flex-col">
      <div className="space-y-2 border-b p-4">
        <h2 className="text-[15px] font-semibold text-foreground">Add {plural}</h2>
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={spec.noun === "property" ? "Search title, city or ID" : "Search name, location or builder"}
            aria-label={`Search ${plural}`}
            className="h-8 w-full rounded-md border bg-background pl-8 pr-8 text-[14px] outline-none placeholder:text-muted-foreground/70 focus:border-foreground/30 dark:bg-white/[0.04]"
          />
          {query && (
            <button type="button" onClick={() => setQuery("")} aria-label="Clear search" className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-0.5 text-muted-foreground hover:text-foreground">
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
        {isFull && <p className="text-[13px] text-amber-700 dark:text-amber-300">Full ({SHOWCASE_MAX_ITEMS}). Remove one to add another.</p>}
      </div>
      <ul className="max-h-[60vh] overflow-y-auto md:max-h-none md:flex-1">
        {isSearching && candidates.length === 0 ? (
          Array.from({ length: 6 }, (_, i) => <li key={i} className="px-4 py-2"><div className="h-11 animate-pulse rounded-md bg-muted/60" /></li>)
        ) : candidates.length === 0 ? (
          <li className="px-4 py-10 text-center text-[14px] text-muted-foreground">
            {query ? `No live ${plural} match “${query}”.` : `No live ${plural} yet.`}
          </li>
        ) : (
          candidates.map((item) => {
            const picked = pickedIds.has(item.id);
            return (
              <li key={item.id}>
                <button
                  type="button"
                  disabled={picked || isFull}
                  onClick={() => add(item)}
                  aria-label={picked ? `${item.title} is already added` : `Add ${item.title}`}
                  className="group flex w-full items-center gap-3 px-4 py-2 text-left transition-colors hover:bg-foreground/[0.04] disabled:cursor-default disabled:hover:bg-transparent"
                >
                  <Thumb src={item.imageUrl} className="h-9 w-12" />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[14px] text-foreground">{item.title}</span>
                    <span className="block truncate text-[12px] text-muted-foreground">{[item.meta, item.location].filter(Boolean).join(" · ")}</span>
                  </span>
                  {picked ? (
                    <Check className="h-4 w-4 shrink-0 text-emerald-600" />
                  ) : (
                    <Plus className={cn("h-4 w-4 shrink-0 text-muted-foreground transition-opacity group-hover:text-foreground", isFull ? "opacity-30" : "md:opacity-0 md:group-hover:opacity-100")} />
                  )}
                </button>
              </li>
            );
          })
        )}
      </ul>
    </div>
  );

  return (
    <>
      <MobileHeader title="Showcases" />
      <PageActions>
        {isDirty && !isLoading && (
          <div className="flex items-center gap-2">
            <span className="hidden text-[13px] text-muted-foreground lg:inline">Unsaved changes</span>
            <button type="button" className={HEADER_BUTTON} onClick={() => setDraft(saved)} disabled={isSaving}>Discard</button>
            <button type="button" className={HEADER_PRIMARY} onClick={() => void save()} disabled={isSaving}>
              {isSaving && <Loader2 className="h-3.5 w-3.5 animate-spin" />} Save changes
            </button>
          </div>
        )}
      </PageActions>

      <div className="flex flex-col pb-28 md:h-full md:pb-0 lg:-mx-6 lg:-mb-8 lg:-mt-6 lg:h-[calc(100%+3.5rem)]">
        <div className="flex min-h-0 flex-1 flex-col md:flex-row">
          <div className="flex min-w-0 flex-1 flex-col md:min-h-0">
            {sectionTabs}
            <div className="md:min-h-0 md:flex-1 md:overflow-y-auto">{pickedList}</div>
          </div>
          <aside className="mx-4 flex flex-col overflow-hidden rounded-xl border md:mx-0 md:w-[340px] md:shrink-0 md:rounded-none md:border-0 md:border-l xl:w-[360px]">{picker}</aside>
        </div>
      </div>

      {/* Phones have no top bar: save from a bar at the bottom. */}
      <AnimatePresence>
        {isDirty && !isLoading && (
          <motion.div
            initial={{ y: 24, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 24, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-x-4 bottom-24 z-50 md:hidden"
          >
            <div className="flex items-center justify-between gap-3 rounded-2xl border bg-card/95 px-4 py-3 shadow-lg backdrop-blur">
              <p className="text-sm font-medium">Unsaved changes</p>
              <div className="flex items-center gap-2">
                <Button variant="ghost" size="sm" onClick={() => setDraft(saved)} disabled={isSaving}>Discard</Button>
                <Button size="sm" onClick={save} disabled={isSaving} className="bg-foreground text-background hover:bg-foreground/85">
                  {isSaving ? "Saving…" : "Save"}
                </Button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Unsaved changes when switching sections or leaving the page */}
      <Dialog
        open={pendingSection !== null || pendingLeave !== null}
        onOpenChange={(open) => {
          if (open) return;
          setPendingSection(null);
          cancelLeave();
        }}
      >
        <DialogContent className="sm:max-w-[440px]">
          <DialogHeader>
            <DialogTitle>Save changes first?</DialogTitle>
            <DialogDescription>
              Your changes to {spec.label} haven&apos;t been saved yet.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="mt-4 gap-2">
            <Button
              variant="outline"
              disabled={isSaving}
              onClick={() => {
                setDraft(saved);
                if (pendingSection) { changeSection(pendingSection); setPendingSection(null); }
                if (pendingLeave) confirmLeave();
              }}
            >
              Discard
            </Button>
            <Button
              disabled={isSaving}
              className="bg-foreground text-background hover:bg-foreground/85"
              onClick={async () => {
                const ok = await save();
                if (!ok) return;
                if (pendingSection) { changeSection(pendingSection); setPendingSection(null); }
                if (pendingLeave) confirmLeave();
              }}
            >
              {isSaving ? "Saving…" : "Save"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
