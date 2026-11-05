"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { AnimatePresence, LayoutGroup, MotionConfig, motion } from "motion/react";
import { CircleCheckBig, House, Inbox, LayoutGrid, Plus, type LucideIcon } from "lucide-react";
import { CreateSheet, createLabelFor, createRouteFor } from "./mobile-create";
import { cn } from "@/lib/utils";
import { useNotifications } from "@/context/notification-context";

interface Tab {
  href: string;
  icon: LucideIcon;
  label: string;
}

const TABS: Tab[] = [
  { href: "/", icon: House, label: "Home" },
  { href: "/tasks", icon: CircleCheckBig, label: "Tasks" },
  { href: "/inbox", icon: Inbox, label: "Inbox" },
  { href: "/more", icon: LayoutGrid, label: "More" },
];

const under = (pathname: string, href: string) => pathname === href || pathname.startsWith(href + "/");

/** The tab a page belongs to: every module opened from Home or More keeps More selected. */
function activeTab(pathname: string) {
  if (pathname === "/") return "/";
  return TABS.find((t) => t.href !== "/" && t.href !== "/more" && under(pathname, t.href))?.href ?? "/more";
}

/** Forms get the whole screen, like a pushed editor in a native app. */
export const hidesTabBar = (pathname: string) => /\/(new|edit)(\/|$)/.test(pathname);

const SPRING = { type: "spring", stiffness: 500, damping: 38 } as const;

/**
 * Phone dock: a frosted island floating above the home indicator. Tabs are
 * icons; the current one opens into a tinted pill with its name. Beside it, a
 * "+" pops in on pages that can create something: the module's form, or the
 * Create sheet on Home.
 */
export function MobileNavbar() {
  const router = useRouter();
  const pathname = usePathname() ?? "/";
  const { unreadCount } = useNotifications();
  const [createOpen, setCreateOpen] = useState(false);
  if (hidesTabBar(pathname)) return null;
  const current = activeTab(pathname);
  const createRoute = createRouteFor(pathname);
  const createLabel = createLabelFor(pathname);

  return (
    <>
    <nav
      aria-label="Main"
      className="pointer-events-none fixed inset-x-0 bottom-[calc(env(safe-area-inset-bottom)+10px)] z-50 flex items-center justify-center gap-2.5 px-4 select-none max-[359px]:gap-1.5 max-[359px]:px-2 md:hidden"
    >
      <MotionConfig reducedMotion="user">
        <LayoutGroup>
          <motion.ul layout transition={SPRING} className="m-bar m-dock pointer-events-auto flex h-[60px] items-center gap-1 rounded-full border p-1.5">
            {TABS.map(({ href, icon: Icon, label }) => {
              const active = current === href;
              const badge = href === "/inbox" && unreadCount > 0 ? (unreadCount > 99 ? "99+" : String(unreadCount)) : null;
              return (
                <motion.li key={href} layout transition={SPRING}>
                  <Link
                    href={href}
                    aria-label={label}
                    aria-current={active ? "page" : undefined}
                    // Tapping the tab you're on scrolls back to the top, as native tab bars do.
                    onClick={() => {
                      if (pathname === href) window.scrollTo({ top: 0, behavior: "smooth" });
                    }}
                    className={cn(
                      "relative flex h-12 min-w-12 items-center justify-center gap-2 rounded-full outline-none transition-transform duration-150 active:scale-[0.92]",
                      active ? "px-4 max-[359px]:px-3" : "px-3 max-[359px]:px-2.5",
                    )}
                  >
                    {active && (
                      <motion.span
                        layoutId="dock-active"
                        transition={SPRING}
                        className="absolute inset-0 rounded-full bg-[#017D58]/12 dark:bg-[#2FB585]/18"
                      />
                    )}
                    <span className="relative">
                      <Icon
                        className={cn("size-[22px]", active ? "text-[#017D58] dark:text-[#2FB585]" : "text-foreground/55")}
                        strokeWidth={active ? 2.25 : 1.9}
                      />
                      {badge && (
                        <span className="absolute -right-2.5 -top-1.5 flex h-[17px] min-w-[17px] items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-semibold leading-none text-white ring-2 ring-background">
                          {badge}
                        </span>
                      )}
                    </span>
                    {active && (
                      <motion.span
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ duration: 0.18, delay: 0.06 }}
                        className="relative text-[14px] font-semibold text-[#017D58] dark:text-[#2FB585]"
                      >
                        {label}
                      </motion.span>
                    )}
                  </Link>
                </motion.li>
              );
            })}
          </motion.ul>
          <AnimatePresence initial={false} mode="popLayout">
            {createLabel && (
              <motion.button
                key="create"
                type="button"
                aria-label={createLabel}
                onClick={() => (createRoute ? router.push(createRoute) : setCreateOpen(true))}
                initial={{ opacity: 0, scale: 0.4 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.4 }}
                whileTap={{ scale: 0.9 }}
                transition={SPRING}
                className="pointer-events-auto flex size-[60px] shrink-0 max-[359px]:size-[52px] items-center justify-center rounded-full bg-[#017D58] text-white shadow-[0_8px_24px_-6px_rgba(1,125,88,0.55),0_2px_6px_-2px_rgba(0,0,0,0.2)] outline-none focus-visible:ring-2 focus-visible:ring-[#017D58]/40 focus-visible:ring-offset-2 dark:bg-[#2FB585] dark:text-black"
              >
                <Plus className="size-6" strokeWidth={2.5} />
              </motion.button>
            )}
          </AnimatePresence>
        </LayoutGroup>
      </MotionConfig>
    </nav>
    <CreateSheet open={createOpen} onClose={() => setCreateOpen(false)} />
    </>
  );
}
