"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useCallback, useEffect, useRef, useState, type CSSProperties, type ReactElement } from "react";
import { AnimatePresence, MotionConfig, motion } from "motion/react";
import { Tooltip } from "@cloudflare/kumo/components/tooltip";
import { ArrowLeft, Bell, ChevronDown, ChevronRight, Search } from "lucide-react";
import { useNotifications } from "@/context/notification-context";
import { cn } from "@/lib/utils";
import { useSidebar } from "./sidebar-context";
import { NotificationsPanel } from "./notifications-panel";
import { UpdateButton, useAppUpdate } from "./app-update";
import { useNavViewer } from "@/hooks/use-nav-viewer";
import { NAVIGATION, SETTINGS, canSee, type NavItem } from "./nav-items";
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

const PANELS = [...NAVIGATION.filter((i) => i.subItems), SETTINGS];
const panelHref = (p: NavItem) => p.href ?? p.subItems![0].href.replace(/\/[^/]+$/, "");
// A panel's first row can share its parent's address (/settings is Profile): match that one exactly.
const subActive = (pathname: string, href: string, parent?: string) =>
  href === parent ? pathname === href : pathname === href || pathname.startsWith(href + "/");

const slide = {
  enter: (d: number) => ({ x: d * 40, opacity: 0 }),
  center: { x: 0, opacity: 1 },
  exit: (d: number) => ({ x: d * -40, opacity: 0 }),
};
const slideTransition = { type: "tween", ease: [0.23, 1, 0.32, 1], duration: 0.22 } as const;

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
  useSearchShortcut(setSearchOpen);
  const deployed = useAppUpdate();
  const floating = !!deployed && !isCollapsed;

  // The panel follows the page (a registry page opens Master Registry); Back or a click
  // overrides it until the page changes.
  const routePanel = PANELS.find((p) => p.subItems!.some((s) => subActive(pathname, s.href, p.href)) || pathname === panelHref(p)) ?? null;
  const [pick, setPick] = useState<{ at: string; name: string | null } | null>(null);
  const panelName = pick && pick.at === pathname ? pick.name : (routePanel?.name ?? null);
  const panel = PANELS.find((p) => p.name === panelName && canSee(p, user)) ?? null;
  const dir = panel ? 1 : -1;
  const open = (name: string) => setPick({ at: pathname, name });
  const back = () => setPick({ at: pathname, name: null });

  // Whether rows are hidden below the visible part of the menu.
  const navRef = useRef<HTMLElement>(null);
  const [canScroll, setCanScroll] = useState(false);
  const measure = useCallback(() => {
    const el = navRef.current;
    if (el) setCanScroll(el.scrollTop + el.clientHeight < el.scrollHeight - 8);
  }, []);
  useEffect(() => {
    const el = navRef.current;
    if (!el) return;
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    if (el.firstElementChild) ro.observe(el.firstElementChild);
    return () => ro.disconnect();
  }, [floating, panelName, measure]);

  const hint = (
    <button
      type="button"
      onClick={() => navRef.current?.scrollBy({ top: 200, behavior: "smooth" })}
      aria-label="Scroll the menu down"
      tabIndex={canScroll ? 0 : -1}
      className={cn(
        "sb-hint mx-auto flex size-6 items-center justify-center rounded-full bg-background text-muted-foreground shadow-[0_0_0_1px_rgba(0,0,0,0.07),0_2px_6px_-1px_rgba(0,0,0,0.1)] transition-[opacity,transform] duration-200 hover:text-foreground dark:bg-white/10 dark:shadow-[0_0_0_1px_rgba(255,255,255,0.08)]",
        canScroll ? "pointer-events-auto opacity-100" : "translate-y-1 opacity-0",
      )}
    >
      <ChevronDown className="size-3.5" strokeWidth={2.25} />
    </button>
  );

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
          userId={user?.id ?? null}
          collapsed={isCollapsed}
          onToggleCollapsed={() => setIsCollapsed(!isCollapsed)}
          onOpenSettings={() => setPick({ at: "/settings", name: SETTINGS.name })}
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

      {/* Navigation: scrolls on its own, rows keep their height. Master Registry and
          Settings slide in as their own panel, with Back as the first row. */}
      <div className="relative flex min-h-0 flex-1 flex-col">
      <nav
        ref={navRef}
        onScroll={measure}
        className={cn("sb-scroll relative mt-2 min-h-0 flex-1 overflow-y-auto overflow-x-hidden px-2", floating ? "pb-[150px]" : "pb-2")}
      >
        <MotionConfig reducedMotion="user">
          <AnimatePresence mode="popLayout" initial={false} custom={dir}>
            {panel ? (
              <motion.div
                key={panel.name}
                custom={dir}
                variants={slide}
                initial="enter"
                animate="center"
                exit="exit"
                transition={slideTransition}
                className="flex w-full flex-col gap-0.5"
              >
                <RailTip label="Back" collapsed={isCollapsed}>
                  <button
                    type="button"
                    onClick={back}
                    className={cn(
                      "group/row flex h-8 w-full shrink-0 items-center gap-2.5 rounded-md px-2 text-[14px] font-medium outline-none transition-colors",
                      "text-[#017D58] hover:bg-[#017D58]/[0.08] focus-visible:ring-2 focus-visible:ring-[#017D58]/40 dark:text-[#2FB585] dark:hover:bg-[#2FB585]/10",
                      isCollapsed && "justify-center px-0",
                    )}
                  >
                    <ArrowLeft className="size-4 shrink-0 transition-transform duration-150 group-hover/row:-translate-x-0.5" strokeWidth={2} />
                    {!isCollapsed && <span className="truncate">Back</span>}
                  </button>
                </RailTip>
                {!isCollapsed && (
                  <p className="mb-1 mt-3 flex items-center gap-2 px-2 text-[12px] font-medium text-muted-foreground">
                    <panel.icon className={cn("size-3.5", panel.color)} strokeWidth={2} />
                    {panel.name}
                  </p>
                )}
                {isCollapsed && <div className="mx-auto my-1.5 h-px w-5 bg-border" />}
                {panel.subItems!.map((sub) => {
                  const active = subActive(pathname, sub.href, panel.href);
                  const Icon = sub.icon ?? panel.icon;
                  return (
                    <RailTip key={sub.href} label={sub.name} collapsed={isCollapsed}>
                      <Link href={sub.href} aria-current={active ? "page" : undefined} className={rowClass(active, isCollapsed)}>
                        <Icon className={cn("size-4 shrink-0", sub.color ?? panel.color)} strokeWidth={active ? 2 : 1.75} />
                        {!isCollapsed && <span className="truncate">{sub.name}</span>}
                      </Link>
                    </RailTip>
                  );
                })}
              </motion.div>
            ) : (
              <motion.div
                key="main"
                custom={dir}
                variants={slide}
                initial="enter"
                animate="center"
                exit="exit"
                transition={slideTransition}
                className={cn(entering && "sb-enter", "flex w-full flex-col gap-0.5")}
                style={{ "--sb-base": 3 } as CSSProperties}
              >
                {[...NAVIGATION, SETTINGS].map((item) => {
                  if (!canSee(item, user)) return null;
                  const Icon = item.icon;
                  const href = item.href ?? item.subItems![0].href.replace(/\/[^/]+$/, "");
                  const opensPanel = !!item.subItems;
                  const active = isActivePath(pathname, href);
                  return (
                    <RailTip key={item.name} label={item.name} collapsed={isCollapsed}>
                      <Link
                        href={href}
                        onClick={opensPanel ? () => open(item.name) : undefined}
                        aria-current={active ? "page" : undefined}
                        className={cn(rowClass(active, isCollapsed), item === SETTINGS && "mt-2")}
                      >
                        <Icon className={cn("size-4 shrink-0", item.color)} strokeWidth={active ? 2 : 1.75} />
                        {!isCollapsed && <span className="flex-1 truncate">{item.name}</span>}
                        {!isCollapsed && opensPanel && (
                          <ChevronRight className="size-3.5 shrink-0 text-muted-foreground/70 transition-transform duration-150 group-hover/row:translate-x-0.5" />
                        )}
                      </Link>
                    </RailTip>
                  );
                })}
              </motion.div>
            )}
          </AnimatePresence>
        </MotionConfig>
      </nav>
      {/* More rows below: a fade and a nudge at the bottom edge of the menu. */}
      {!floating && (
        <div aria-hidden={!canScroll} className={cn("sb-float pointer-events-none absolute inset-x-0 bottom-0 flex justify-center pb-2 pt-8 transition-opacity duration-200", canScroll ? "opacity-100" : "opacity-0")}>
          {hint}
        </div>
      )}
      </div>

      {/* Update: floats over the end of the nav on a fade, with a nudge to scroll when rows hide behind it */}
      {floating ? (
        <div className="sb-float pointer-events-none absolute inset-x-0 bottom-0 px-2 pb-3 pt-12">
          <div className="mb-2">{hint}</div>
          <UpdateButton deployed={deployed} collapsed={false} className="pointer-events-auto" />
        </div>
      ) : (
        <UpdateButton deployed={deployed} collapsed={isCollapsed} className="border-t p-2" />
      )}

      <NotificationsPanel open={notificationsOpen} onClose={closeNotifications} toggleId="notifications-btn" />
      <SearchPalette open={searchOpen} onOpenChange={setSearchOpen} viewer={user} />
    </aside>
  );
}
