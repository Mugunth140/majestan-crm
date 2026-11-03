"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutGroup, MotionConfig, motion } from "motion/react";
import { CircleCheckBig, House, Inbox, LayoutGrid, type LucideIcon } from "lucide-react";
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
 * icons; the current one opens into a tinted pill with its name.
 */
export function MobileNavbar() {
  const pathname = usePathname() ?? "/";
  const { unreadCount } = useNotifications();
  if (hidesTabBar(pathname)) return null;
  const current = activeTab(pathname);

  return (
    <nav
      aria-label="Main"
      className="pointer-events-none fixed inset-x-0 bottom-[calc(env(safe-area-inset-bottom)+10px)] z-50 flex justify-center px-4 select-none md:hidden"
    >
      <MotionConfig reducedMotion="user">
        <LayoutGroup>
          <ul className="m-bar m-dock pointer-events-auto flex h-[60px] items-center gap-1 rounded-full border p-1.5">
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
                      active ? "px-4" : "px-3",
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
          </ul>
        </LayoutGroup>
      </MotionConfig>
    </nav>
  );
}
