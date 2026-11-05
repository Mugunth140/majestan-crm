"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "motion/react";
import { Briefcase, ChevronRight, CircleCheckBig, Home, Inbox, Network, Package, TrendingUp, UserPen, Users, type LucideIcon } from "lucide-react";

interface CreateItem {
  href: string;
  label: string;
  icon: LucideIcon;
  /** Solid tile behind the white glyph. */
  tile: string;
}

const ITEMS: CreateItem[] = [
  { href: "/leads/new", label: "Lead", icon: TrendingUp, tile: "bg-emerald-600" },
  { href: "/tasks/new", label: "Task", icon: CircleCheckBig, tile: "bg-red-500" },
  { href: "/inbound/new", label: "Inbound", icon: Inbox, tile: "bg-cyan-600" },
  { href: "/properties/new", label: "Property", icon: Home, tile: "bg-teal-600" },
  { href: "/projects/new", label: "Project", icon: Briefcase, tile: "bg-amber-500" },
  { href: "/asset-inventory/new", label: "Asset", icon: Package, tile: "bg-yellow-500" },
  { href: "/agent-network/new", label: "Agent", icon: Network, tile: "bg-indigo-500" },
  { href: "/hr/new", label: "Candidate", icon: UserPen, tile: "bg-rose-500" },
  { href: "/users/new", label: "User", icon: Users, tile: "bg-purple-500" },
];

// List pages whose "+" opens their form directly (Ads keeps its own button: it needs a placement).
const NEW_FORMS = [...ITEMS.map((i) => i.href), "/builders/new"];

/** The "new" form for the module a list page belongs to, if it has one. */
export function createRouteFor(pathname: string) {
  return NEW_FORMS.find((href) => pathname === href.replace(/\/new$/, "")) ?? null;
}

/** What the dock's "+" makes on this page: "New lead", or "Create" on Home. */
export function createLabelFor(pathname: string) {
  const route = createRouteFor(pathname);
  if (!route) return pathname === "/" ? "Create" : null;
  const label = ITEMS.find((i) => i.href === route)?.label ?? (route === "/builders/new" ? "Builder" : "record");
  return `New ${label.toLowerCase()}`;
}

/** Bottom sheet listing everything that can be created. */
export function CreateSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const router = useRouter();

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  return (
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-[60] md:hidden" role="dialog" aria-modal="true" aria-label="Create new">
          <motion.div
            className="absolute inset-0 bg-black/40"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            onClick={onClose}
          />
          <motion.div
            className="absolute inset-x-0 bottom-0 max-h-[85dvh] overflow-y-auto rounded-t-[20px] bg-background pb-[calc(env(safe-area-inset-bottom)+12px)] shadow-[0_-8px_40px_rgba(0,0,0,0.18)] dark:bg-[oklch(0.19_0_0)]"
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            exit={{ y: "100%" }}
            transition={{ type: "spring", stiffness: 420, damping: 40 }}
          >
            <div className="mx-auto mt-2 h-[5px] w-9 rounded-full bg-muted-foreground/30" />
            <div className="flex items-center justify-between px-5 pb-2 pt-3">
              <h2 className="text-[20px] font-semibold tracking-tight">Create</h2>
              <button type="button" onClick={onClose} className="h-9 rounded-full px-3 text-[16px] font-medium text-[#017D58] active:opacity-50 dark:text-[#2FB585]">
                Cancel
              </button>
            </div>
            <ul className="m-group mx-4">
              {ITEMS.map(({ href, label, icon: Icon, tile }) => (
                <li key={href}>
                  <button
                    type="button"
                    onClick={() => {
                      onClose();
                      router.push(href);
                    }}
                    className="m-cell"
                  >
                    <span className={`m-tile ${tile}`}>
                      <Icon className="size-[18px] text-white" strokeWidth={2} />
                    </span>
                    <span className="m-cell-body">
                      <span className="flex-1 text-[16px]">{label}</span>
                      <ChevronRight className="size-[18px] text-muted-foreground/50" />
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
