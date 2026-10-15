"use client";

import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { motion, AnimatePresence } from "motion/react";
import { ChevronDown, ChevronUp, ImageOff, Plus, RefreshCw, Search, X, Check, Info } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { MobileHeader } from "@/components/layout/mobile-header";
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

const SECTIONS: { value: ShowcaseSection; label: string; noun: string; description: string }[] = [
  {
    value: "handpicked_properties",
    label: "Handpicked Properties",
    noun: "property",
    description: "The property carousel on the home page. Only available, approved properties can be picked.",
  },
  {
    value: "featured_projects",
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
    <div className={cn("shrink-0 overflow-hidden rounded-lg bg-muted flex items-center justify-center", className)}>
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
  const [reloadToken, setReloadToken] = useState(0);
  const loadKey = `${section}:${reloadToken}`;
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

  const sectionTabs = (
    <div className="flex items-center gap-2 overflow-x-auto scrollbar-hide -mx-4 px-4 md:mx-0 md:px-0">
      {SECTIONS.map((s) => (
        <button
          key={s.value}
          onClick={() => switchSection(s.value)}
          className={cn(
            "h-10 px-5 rounded-full text-[14px] font-semibold whitespace-nowrap transition-all border active:scale-95",
            section === s.value
              ? "bg-[#0052FF] text-white border-[#0052FF] shadow-sm"
              : "bg-card text-muted-foreground border-border hover:bg-muted hover:text-foreground",
          )}
        >
          {s.label}
        </button>
      ))}
    </div>
  );

  const pickedList = (
    <section className="bg-card border rounded-xl shadow-sm overflow-hidden flex flex-col min-h-0">
      <div className="flex items-center justify-between gap-3 px-5 py-4 border-b bg-muted/10">
        <div>
          <h2 className="text-[16px] font-semibold">On the home page</h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            {draft.length} of {SHOWCASE_MAX_ITEMS} · shown in this order
          </p>
        </div>
        {notLiveCount > 0 && (
          <Badge variant="outline" className="border-amber-300 bg-amber-50 text-amber-800 dark:bg-amber-950/40 dark:text-amber-300">
            {notLiveCount} not on site
          </Badge>
        )}
      </div>

      {isLoading ? (
        <div className="p-5 space-y-3">
          {Array.from({ length: 4 }, (_, i) => (
            <div key={i} className="h-16 rounded-lg bg-muted/60 animate-pulse" />
          ))}
        </div>
      ) : draft.length === 0 ? (
        <div className="px-6 py-14 text-center">
          <p className="text-[15px] font-semibold">Nothing picked yet</p>
          <p className="text-sm text-muted-foreground mt-1 max-w-sm mx-auto">
            Until you pick some, the home page shows the newest {spec.noun === "property" ? "apartments" : "published projects"} automatically.
          </p>
        </div>
      ) : (
        <ol className="divide-y overflow-y-auto">
          <AnimatePresence initial={false}>
            {draft.map((item, index) => (
              <motion.li
                key={item.id}
                layout
                initial={{ opacity: 0, y: -4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, height: 0 }}
                transition={{ duration: 0.18 }}
                className="flex items-center gap-3 px-4 py-3"
              >
                <span className="w-6 text-center text-sm font-semibold tabular-nums text-muted-foreground">{index + 1}</span>
                <Thumb src={item.imageUrl} className="h-12 w-16" />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 min-w-0">
                    <p className="truncate text-[14px] font-semibold">{item.title}</p>
                    {!item.isLive && (
                      <Badge variant="outline" className="shrink-0 border-amber-300 bg-amber-50 text-amber-800 text-[11px] dark:bg-amber-950/40 dark:text-amber-300">
                        Not on site
                      </Badge>
                    )}
                  </div>
                  <p className="truncate text-xs text-muted-foreground mt-0.5">
                    {[item.meta, item.location].filter(Boolean).join(" · ")}
                  </p>
                </div>
                <div className="flex items-center gap-0.5">
                  <button
                    onClick={() => move(index, -1)}
                    disabled={index === 0}
                    className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted disabled:opacity-30 disabled:pointer-events-none"
                    aria-label={`Move ${item.title} up`}
                  >
                    <ChevronUp className="h-4 w-4" />
                  </button>
                  <button
                    onClick={() => move(index, 1)}
                    disabled={index === draft.length - 1}
                    className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted disabled:opacity-30 disabled:pointer-events-none"
                    aria-label={`Move ${item.title} down`}
                  >
                    <ChevronDown className="h-4 w-4" />
                  </button>
                  <button
                    onClick={() => remove(item.id)}
                    className="ml-1 p-1.5 rounded-md text-muted-foreground hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/40"
                    aria-label={`Remove ${item.title}`}
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              </motion.li>
            ))}
          </AnimatePresence>
        </ol>
      )}

      {notLiveCount > 0 && (
        <p className="flex items-start gap-2 border-t bg-amber-50/60 dark:bg-amber-950/20 px-5 py-3 text-xs text-amber-900 dark:text-amber-200">
          <Info className="h-3.5 w-3.5 mt-0.5 shrink-0" />
          Items marked “Not on site” were sold, unpublished or are awaiting approval. They are skipped on the home page until they are live again.
        </p>
      )}
    </section>
  );

  const picker = (
    <section className="bg-card border rounded-xl shadow-sm overflow-hidden flex flex-col min-h-0">
      <div className="px-5 py-4 border-b bg-muted/10">
        <h2 className="text-[16px] font-semibold">Add {spec.noun === "property" ? "properties" : "projects"}</h2>
        <div className="relative mt-3">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={spec.noun === "property" ? "Search by title, city or ID…" : "Search by name, location or builder…"}
            className="pl-9 h-10 bg-muted/30 rounded-xl border-border/60 text-[13.5px]"
          />
          {query && (
            <button onClick={() => setQuery("")} className="absolute right-3 top-1/2 -translate-y-1/2 p-1 rounded-full text-muted-foreground hover:bg-muted" aria-label="Clear search">
              <X className="h-3 w-3" />
            </button>
          )}
        </div>
        {isFull && (
          <p className="text-xs text-amber-700 dark:text-amber-300 mt-2">This section is full ({SHOWCASE_MAX_ITEMS}). Remove one to add another.</p>
        )}
      </div>

      <ul className="divide-y overflow-y-auto max-h-[60vh] md:max-h-none md:flex-1">
        {isSearching && candidates.length === 0 ? (
          Array.from({ length: 5 }, (_, i) => (
            <li key={i} className="px-4 py-3"><div className="h-12 rounded-lg bg-muted/60 animate-pulse" /></li>
          ))
        ) : candidates.length === 0 ? (
          <li className="px-6 py-12 text-center text-sm text-muted-foreground">
            {query ? `No live ${spec.noun === "property" ? "properties" : "projects"} match “${query}”.` : `No live ${spec.noun === "property" ? "properties" : "projects"} yet.`}
          </li>
        ) : (
          candidates.map((item) => {
            const picked = pickedIds.has(item.id);
            return (
              <li key={item.id} className="flex items-center gap-3 px-4 py-3">
                <Thumb src={item.imageUrl} className="h-11 w-14" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[14px] font-medium">{item.title}</p>
                  <p className="truncate text-xs text-muted-foreground mt-0.5">
                    {[item.meta, item.location].filter(Boolean).join(" · ")}
                  </p>
                </div>
                <Button
                  size="sm"
                  variant={picked ? "ghost" : "outline"}
                  disabled={picked || isFull}
                  onClick={() => add(item)}
                  className="shrink-0 rounded-full h-8"
                >
                  {picked ? (<><Check className="h-3.5 w-3.5 mr-1" /> Added</>) : (<><Plus className="h-3.5 w-3.5 mr-1" /> Add</>)}
                </Button>
              </li>
            );
          })
        )}
      </ul>
    </section>
  );

  return (
    <>
      <MobileHeader title="Showcases" />
      <div className="w-full flex flex-col gap-5 px-4 pt-4 pb-28 md:px-0 md:pt-0 md:pb-24 md:h-full">
        <div className="hidden md:flex items-center justify-between pr-[150px] min-h-[48px]">
          <div>
            <h1 className="text-[28px] font-bold tracking-tight">Showcases</h1>
            <p className="text-muted-foreground text-sm mt-0.5">Pick what the home page features, and in what order.</p>
          </div>
          <Button variant="outline" size="icon" className="h-10 w-10 rounded-full border-border/60" onClick={() => setReloadToken((t) => t + 1)} title="Refresh" disabled={isDirty}>
            <RefreshCw size={16} className={isLoading ? "animate-spin" : ""} />
          </Button>
        </div>

        <div className="flex flex-col gap-2">
          {sectionTabs}
          <p className="text-xs text-muted-foreground">{spec.description}</p>
        </div>

        <div className="grid gap-5 md:grid-cols-[minmax(0,1.25fr)_minmax(0,1fr)] md:flex-1 md:min-h-0">
          {pickedList}
          {picker}
        </div>
      </div>

      {/* Save bar: only while there are unsaved changes */}
      <AnimatePresence>
        {isDirty && !isLoading && (
          <motion.div
            initial={{ y: 24, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 24, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed bottom-4 left-1/2 -translate-x-1/2 z-50 w-[calc(100%-2rem)] max-w-xl"
          >
            <div className="flex items-center justify-between gap-3 rounded-2xl border bg-card/95 backdrop-blur px-4 py-3 shadow-lg">
              <p className="text-sm font-medium">Unsaved changes to {spec.label}</p>
              <div className="flex items-center gap-2">
                <Button variant="ghost" size="sm" onClick={() => setDraft(saved)} disabled={isSaving}>Discard</Button>
                <Button size="sm" onClick={save} disabled={isSaving} className="bg-[#0052FF] hover:bg-[#0052FF]/90 text-white rounded-full px-5">
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
              className="bg-[#0052FF] hover:bg-[#0052FF]/90 text-white"
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
