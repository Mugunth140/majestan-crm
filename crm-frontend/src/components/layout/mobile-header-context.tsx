"use client";

import { createContext, useContext, useMemo, useState, type ReactNode } from "react";
import { usePathname } from "next/navigation";

interface MobileHeaderState {
  title: string | null;
  resolvedTitle: string;
  showBack: boolean;
  isScrolled: boolean;
  setTitle: (title: string | null) => void;
  setShowBack: (showBack: boolean) => void;
  setIsScrolled: (scrolled: boolean) => void;
}

const MobileHeaderContext = createContext<MobileHeaderState | null>(null);

const LIST_TITLES: [string, string][] = [
  ["/tasks", "Tasks"],
  ["/inbox", "Inbox"],
  ["/settings", "Settings"],
  ["/leads", "Leads Dashboard"],
  ["/inbound", "Inbound"],
  ["/asset-inventory", "Assets"],
  ["/agent-network", "Agents"],
  ["/hr", "HR Panel"],
  ["/users", "Users"],
  ["/projects", "Projects"],
  ["/properties", "Properties"],
  ["/lead-routing", "Lead Routing"],
  ["/activity-logs", "Activity Logs"],
  ["/master", "Master Registry"],
  ["/roles", "Roles"],
  ["/departments", "Departments"],
];

const NEW_PAGE_TITLES: [string, string][] = [
  ["/leads/new", "Add Lead"],
  ["/inbound/new", "Add Inbound"],
  ["/asset-inventory/new", "Add Asset"],
  ["/agent-network/new", "Add Agent"],
  ["/hr/new", "Add Candidate"],
  ["/users/new", "Add User"],
  ["/projects/new", "New Project"],
];

const DETAIL_TITLES: [string, string][] = [
  ["/leads/", "Lead Details"],
  ["/inbound/", "Inbound Details"],
  ["/asset-inventory/", "Asset Details"],
  ["/agent-network/", "Agent Details"],
  ["/hr/", "Candidate Details"],
  ["/users/", "User Details"],
];

function defaultTitle(pathname: string): string {
  for (const [p, t] of NEW_PAGE_TITLES) if (pathname === p) return t;
  for (const [p, t] of DETAIL_TITLES) {
    if (pathname.startsWith(p) && !pathname.startsWith(p + "new")) return t;
  }
  if (pathname === "/") return "Dashboard";
  let best = "";
  let title = "Majestan";
  for (const [p, t] of LIST_TITLES) {
    if (p.length > best.length && (pathname === p || pathname.startsWith(p + "/"))) {
      best = p;
      title = t;
    }
  }
  return title;
}

export function MobileHeaderProvider({ children }: { children: ReactNode }) {
  const pathname = usePathname() ?? "/";
  const [title, setTitle] = useState<string | null>(null);
  const [showBack, setShowBack] = useState(false);
  const [isScrolled, setIsScrolled] = useState(false);

  const resolvedTitle = title ?? defaultTitle(pathname);

  const value = useMemo<MobileHeaderState>(
    () => ({ title, resolvedTitle, setTitle, showBack, setShowBack, isScrolled, setIsScrolled }),
    [title, resolvedTitle, showBack, isScrolled]
  );

  return <MobileHeaderContext.Provider value={value}>{children}</MobileHeaderContext.Provider>;
}

export function useMobileHeader() {
  const ctx = useContext(MobileHeaderContext);
  if (!ctx) throw new Error("useMobileHeader must be used within MobileHeaderProvider");
  return ctx;
}
