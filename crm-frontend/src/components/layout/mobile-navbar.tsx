"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { CircleCheckBig, House, Inbox, LayoutGrid, TrendingUp, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { useNotifications } from "@/context/notification-context";

interface Tab {
  href: string;
  icon: LucideIcon;
  label: string;
}

const TABS: Tab[] = [
  { href: "/", icon: House, label: "Home" },
  { href: "/leads", icon: TrendingUp, label: "Leads" },
  { href: "/tasks", icon: CircleCheckBig, label: "Tasks" },
  { href: "/inbox", icon: Inbox, label: "Inbox" },
  { href: "/more", icon: LayoutGrid, label: "More" },
];

const under = (pathname: string, href: string) => pathname === href || pathname.startsWith(href + "/");

/** The tab a page belongs to: every module opened from More keeps More selected. */
function activeTab(pathname: string) {
  if (pathname === "/") return "/";
  return TABS.find((t) => t.href !== "/" && t.href !== "/more" && under(pathname, t.href))?.href ?? "/more";
}

/** Forms get the whole screen, like a pushed editor in a native app. */
export const hidesTabBar = (pathname: string) => /\/(new|edit)(\/|$)/.test(pathname);

/** Phone tab bar, docked to the bottom edge above the home indicator. */
export function MobileNavbar() {
  const pathname = usePathname() ?? "/";
  const { unreadCount } = useNotifications();
  if (hidesTabBar(pathname)) return null;
  const current = activeTab(pathname);

  return (
    <nav
      aria-label="Main"
      className="m-bar fixed inset-x-0 bottom-0 z-50 select-none border-t pb-[env(safe-area-inset-bottom)] md:hidden"
    >
      <ul className="mx-auto flex h-[58px] max-w-lg">
        {TABS.map(({ href, icon: Icon, label }) => {
          const active = current === href;
          const badge = href === "/inbox" && unreadCount > 0 ? (unreadCount > 99 ? "99+" : String(unreadCount)) : null;
          return (
            <li key={href} className="flex-1">
              <Link
                href={href}
                aria-current={active ? "page" : undefined}
                // Tapping the tab you're on scrolls back to the top, as native tab bars do.
                onClick={() => {
                  if (pathname === href) window.scrollTo({ top: 0, behavior: "smooth" });
                }}
                className="group flex h-full flex-col items-center justify-center gap-[3px] outline-none"
              >
                <span
                  className={cn(
                    "relative flex h-7 w-14 items-center justify-center rounded-full transition-[background-color,transform] duration-150 group-active:scale-90",
                    active && "bg-[#017D58]/12 dark:bg-[#2FB585]/16",
                  )}
                >
                  <Icon
                    className={cn("size-[22px]", active ? "text-[#017D58] dark:text-[#2FB585]" : "text-muted-foreground")}
                    strokeWidth={active ? 2.25 : 1.75}
                  />
                  {badge && (
                    <span className="absolute -top-0.5 left-[34px] flex h-[17px] min-w-[17px] items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-semibold leading-none text-white ring-2 ring-background">
                      {badge}
                    </span>
                  )}
                </span>
                <span className={cn("text-[11px] leading-none", active ? "font-semibold text-foreground" : "font-medium text-muted-foreground")}>
                  {label}
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
