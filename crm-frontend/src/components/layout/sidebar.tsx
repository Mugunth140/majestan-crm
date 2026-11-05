"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useCallback, useEffect, useState, type CSSProperties, type ReactElement } from "react";
import { Tooltip } from "@cloudflare/kumo/components/tooltip";
import { Bell, ChevronRight, Search } from "lucide-react";
import { useNotifications } from "@/context/notification-context";
import { cn } from "@/lib/utils";
import { useSidebar } from "./sidebar-context";
import { NotificationsPanel } from "./notifications-panel";
import { UpdateButton } from "./app-update";
import { useNavViewer } from "@/hooks/use-nav-viewer";
import { NAVIGATION, canSee } from "./nav-items";
import { SearchPalette, useSearchShortcut } from "./search-palette";
import { WorkspaceMenu } from "./workspace-menu";
import "./sidebar.css";

const isActivePath = (pathname: string, href: string) =>
  href === "/" ? pathname === "/" : pathname === href || pathname.startsWith(href + "/");

// Row styles shared by links and buttons
const rowClass = (active: boolean, collapsed: boolean) =>
  cn(
    "group/row relative flex h-8 w-full shrink-0 items-center gap-2.5 rounded-md px-2 text-[14px] outline-none transition-colors",
    "focus-visible:ring-2 focus-visible:ring-[#017D58]/40",
    active
      ? "bg-background font-medium text-foreground shadow-[0_0_0_1px_rgba(0,0,0,0.06),0_1px_2px_rgba(0,0,0,0.06)] dark:bg-white/10 dark:shadow-[0_0_0_1px_rgba(255,255,255,0.06)]"
      : "text-foreground/75 hover:bg-black/[0.045] hover:text-foreground dark:hover:bg-white/[0.06]",
    collapsed && "justify-center px-0",
  );

const mutedIcon = "size-4 shrink-0 text-muted-foreground group-hover/row:text-foreground";

// In the collapsed rail, every row gets a tooltip with its label.
function RailTip({ label, collapsed, children }: { label: string; collapsed: boolean; children: ReactElement }) {
  if (!collapsed) return children;
  return <Tooltip content={label} side="right" render={children} />;
}

export function Sidebar() {
  // Rows reveal once on first load; afterwards collapsing (which remounts rows) shouldn't replay it.
  const [entering, setEntering] = useState(true);
  useEffect(() => {
    const t = setTimeout(() => setEntering(false), 1400);
    return () => clearTimeout(t);
  }, []);
  const pathname = usePathname();
  const { isCollapsed, setIsCollapsed } = useSidebar();
  const { unreadCount } = useNotifications();
  const user = useNavViewer();
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const closeNotifications = useCallback(() => setNotificationsOpen(false), []);
  const [searchOpen, setSearchOpen] = useState(false);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  useSearchShortcut(setSearchOpen);

  return (
    <aside
      className={cn(
        "relative hidden h-full shrink-0 flex-col border-r bg-sidebar transition-[width] duration-200 ease-out md:flex",
        isCollapsed ? "w-[52px]" : "w-[232px]",
      )}
    >
      {/* Workspace menu */}
      <div className={cn(entering && "sb-enter", "p-2")} style={{ "--sb-base": 0 } as CSSProperties}>
        <WorkspaceMenu
          userName={user?.name ?? ""}
          role={user?.role ?? ""}
          avatar={user?.avatar ?? null}
          collapsed={isCollapsed}
          onToggleCollapsed={() => setIsCollapsed(!isCollapsed)}
        />
      </div>

      {/* Quick actions */}
      <div className={cn(entering && "sb-enter", "flex flex-col gap-0.5 px-2")} style={{ "--sb-base": 1 } as CSSProperties}>
        <RailTip label="Search (⌘K)" collapsed={isCollapsed}>
          <button type="button" onClick={() => setSearchOpen(true)} className={rowClass(false, isCollapsed)}>
            <Search className={mutedIcon} strokeWidth={1.75} />
            {!isCollapsed && (
              <>
                <span className="flex-1 truncate text-left">Search</span>
                <kbd className="flex h-5 items-center gap-0.5 rounded border bg-background px-1.5 font-sans text-[11px] font-medium text-muted-foreground">
                  <span className="text-[13px] leading-none">⌘</span>K
                </kbd>
              </>
            )}
          </button>
        </RailTip>
        <RailTip label="Notifications" collapsed={isCollapsed}>
          <button
            type="button"
            id="notifications-btn"
            aria-expanded={notificationsOpen}
            onClick={() => setNotificationsOpen((o) => !o)}
            className={rowClass(notificationsOpen, isCollapsed)}
          >
            <span className="relative">
              <Bell className={mutedIcon} strokeWidth={1.75} />
              {unreadCount > 0 && isCollapsed && (
                <span className="absolute -right-0.5 -top-0.5 size-1.5 rounded-full bg-red-500 ring-1 ring-sidebar" />
              )}
            </span>
            {!isCollapsed && (
              <>
                <span className="flex-1 truncate text-left">Notifications</span>
                {unreadCount > 0 && (
                  <span className="min-w-5 rounded-full bg-red-500 px-1.5 text-center text-[11px] font-semibold leading-5 text-white">
                    {unreadCount > 99 ? "99+" : unreadCount}
                  </span>
                )}
              </>
            )}
          </button>
        </RailTip>
      </div>

      {/* Navigation: scrolls on its own, rows keep their height */}
      <nav className="sb-scroll mt-2 min-h-0 flex-1 overflow-y-auto overflow-x-hidden px-2 pb-2">
        <div className={cn(entering && "sb-enter", "flex flex-col gap-0.5")} style={{ "--sb-base": 3 } as CSSProperties}>
          {NAVIGATION.map((item) => {
            if (!canSee(item, user)) return null;
            const Icon = item.icon;

            if (item.subItems) {
              const childActive = item.subItems.some((s) => isActivePath(pathname, s.href));
              const open = !isCollapsed && (expanded[item.name] ?? childActive);
              return (
                <div key={item.name} className="flex flex-col">
                  <RailTip label={item.name} collapsed={isCollapsed}>
                    <button
                      type="button"
                      aria-expanded={open}
                      onClick={() =>
                        isCollapsed
                          ? (setIsCollapsed(false), setExpanded((e) => ({ ...e, [item.name]: true })))
                          : setExpanded((e) => ({ ...e, [item.name]: !open }))
                      }
                      className={rowClass(isCollapsed && childActive, isCollapsed)}
                    >
                      <Icon className={cn("size-4 shrink-0", item.color)} strokeWidth={1.75} />
                      {!isCollapsed && (
                        <>
                          <span className="flex-1 truncate text-left">{item.name}</span>
                          <ChevronRight
                            className={cn("size-3.5 text-muted-foreground transition-transform duration-200", open && "rotate-90")}
                          />
                        </>
                      )}
                    </button>
                  </RailTip>
                  <div className={cn("grid transition-[grid-template-rows] duration-200 ease-out", open ? "grid-rows-[1fr]" : "grid-rows-[0fr]")}>
                    <div className="overflow-hidden">
                      {/* A tree under the parent's icon: a trunk, and a curved branch into each row */}
                      <div className="ml-[15px] mt-0.5 flex flex-col gap-0.5 py-0.5">
                        {item.subItems.map((sub, i) => {
                          const active = isActivePath(pathname, sub.href);
                          const last = i === item.subItems!.length - 1;
                          return (
                            <div key={sub.href} className="relative pl-[14px]">
                              {!last && (
                                <span aria-hidden className={cn("pointer-events-none absolute -bottom-0.5 left-0 w-px bg-border", i === 0 ? "-top-2" : "-top-0.5")} />
                              )}
                              <span
                                aria-hidden
                                className={cn(
                                  "pointer-events-none absolute left-0 w-[11px] rounded-bl-[8px] border-b border-l transition-colors",
                                  i === 0 ? "-top-2 h-[calc(50%+8px)]" : "-top-0.5 h-[calc(50%+2px)]",
                                  active ? "border-foreground/35" : "border-border",
                                )}
                              />
                              <Link
                                href={sub.href}
                                tabIndex={open ? undefined : -1}
                                aria-current={active ? "page" : undefined}
                                className={cn(rowClass(active, false), "h-7 text-[13px]")}
                              >
                                <span className="truncate">{sub.name}</span>
                              </Link>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                </div>
              );
            }

            const active = isActivePath(pathname, item.href!);
            return (
              <RailTip key={item.name} label={item.name} collapsed={isCollapsed}>
                <Link href={item.href!} aria-current={active ? "page" : undefined} className={rowClass(active, isCollapsed)}>
                  <Icon className={cn("size-4 shrink-0", item.color)} strokeWidth={active ? 2 : 1.75} />
                  {!isCollapsed && <span className="truncate">{item.name}</span>}
                </Link>
              </RailTip>
            );
          })}
        </div>
      </nav>

      {/* Footer: only appears when an update is waiting */}
      <UpdateButton collapsed={isCollapsed} className="border-t p-2" />

      <NotificationsPanel open={notificationsOpen} onClose={closeNotifications} toggleId="notifications-btn" />
      <SearchPalette open={searchOpen} onOpenChange={setSearchOpen} viewer={user} />
    </aside>
  );
}
