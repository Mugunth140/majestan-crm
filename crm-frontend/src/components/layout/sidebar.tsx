"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { useState, useEffect } from "react";
import { cn } from "@/lib/utils";
import { useSidebar } from "./sidebar-context";
import { 
  Users, 
  Home, 
  Astroid,
  Activity, 
  Settings,
  Database,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  Inbox,
  Route,
  Network,
  Briefcase,
  Package,
  TrendingUp,
  Target,
  UserPen
} from "lucide-react";
import Image from "next/image";

const navigation = [
  { name: "Dashboard", href: "/", icon: Astroid },
  { name: "Leads", href: "/leads", icon: TrendingUp },
  { name: "Inbound", href: "/inbound", icon: Inbox },
  { name: "Lead Routing", href: "/lead-routing", icon: Route },
  { name: "Agent Network", href: "/agent-network", icon: Network },
  { name: "Projects", href: "/projects", icon: Briefcase },
  { name: "Properties", href: "/properties", icon: Home },
  { name: "Asset Inventory", href: "/asset-inventory", icon: Package },
  { name: "HR Panel", href: "/hr", icon: UserPen },
  { name: "Target Insights", href: "/insights", icon: Target },
  { name: "Activity Logs", href: "/activity-logs", icon: Activity },
    { 
    name: "Users", 
    icon: Users, 
    adminOnly: true,
    href: "/users"
  },
  { 
    name: "Master Registry", 
    icon: Database,
    adminOnly: true,
    subItems: [
      { name: "Lead Status", href: "/master/lead-status" },
      { name: "Lead Sources", href: "/master/sources" },
      { name: "Property Types", href: "/master/property-types" }
    ]
  },
];

export function Sidebar() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { isCollapsed, setIsCollapsed } = useSidebar();
  const [userRole, setUserRole] = useState<string | null>(null);
  const [expandedItems, setExpandedItems] = useState<Record<string, boolean>>({});

  useEffect(() => {
    try {
      const userStr = localStorage.getItem("crm_user");
      if (userStr) {
        const user = JSON.parse(userStr);
        setUserRole(user.role);
      }
    } catch (err) {
      console.error("Failed to parse user from local storage");
    }
  }, []);

  // Initialize expanded state based on active path
  useEffect(() => {
    setExpandedItems(prev => {
      const next = { ...prev };
      navigation.forEach(item => {
        if (item.subItems && item.subItems.some(sub => pathname.startsWith(sub.href))) {
          next[item.name] = true;
        }
      });
      return next;
    });
  }, [pathname]);

  const toggleExpand = (name: string) => {
    setExpandedItems(prev => ({ ...prev, [name]: !prev[name] }));
  };

  const isAdmin = userRole === "Admin" || userRole === "Super Admin";

  return (
    <aside
      className={cn(
        "flex flex-col my-3 ml-3 rounded-xl border bg-card shadow-sm transition-all duration-300 overflow-hidden relative group",
        isCollapsed ? "w-16" : "w-64"
      )}
    >
      {/* Toggle Button */}
      <button
        onClick={() => setIsCollapsed(!isCollapsed)}
        className="absolute -right-2 top-13 z-20 flex h-7 w-7 items-center justify-center rounded-lg border bg-background shadow-sm transition-all hover:bg-accent opacity-0 group-hover:opacity-100"
      >
        {isCollapsed ? <ChevronRight size={14} /> : <ChevronLeft size={14} />}
      </button>

      <div className={cn(
        "flex h-16 items-center border-b transition-all",
        isCollapsed ? "justify-center px-0" : "px-6"
      )}>
        <Link href="/" className="flex items-center gap-3">
          <div className="relative flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden">
            <Image src="/logo/logo.png" alt="Majestan CRM" width={30} height={30} className="object-contain" />
          </div>
          {!isCollapsed && (
            <span className="font-semibold tracking-normal truncate whitespace-nowrap">
              Majestan CRM
            </span>
          )}
        </Link>
      </div>

      <div className="flex-1 overflow-x-hidden overflow-y-auto py-3 scrollbar-none">
        <nav className="grid items-start px-2 gap-1 text-[15px] font-medium">
          {navigation.map((item) => {
            if (item.adminOnly && !isAdmin) return null;

            const hasSub = item.subItems && item.subItems.length > 0;
            const isActive = item.href ? (pathname === item.href || pathname.startsWith(item.href + "/")) : (hasSub && item.subItems?.some(sub => pathname.startsWith(sub.href)));
            const isExpanded = expandedItems[item.name] || false;

            const ItemContent = (
              <>
                <item.icon className={cn("h-[22px] w-[22px] shrink-0", isActive ? "text-[#0052FF]" : "text-muted-foreground")} />
                {!isCollapsed && <span className="truncate whitespace-nowrap flex-1 text-left">{item.name}</span>}
                {!isCollapsed && hasSub && (
                  <ChevronDown className={cn("h-4 w-4 transition-transform duration-200 text-muted-foreground", isExpanded && "rotate-180")} />
                )}
              </>
            );

            return (
              <div key={item.name} className="flex flex-col gap-1">
                {hasSub ? (
                  <button
                    title={isCollapsed ? item.name : undefined}
                    onClick={() => toggleExpand(item.name)}
                    className={cn(
                      "flex items-center gap-3 rounded-xl px-3 py-3 transition-all duration-200 ease-out active:scale-[0.98] hover:scale-[1.01]",
                      isActive 
                        ? "bg-blue-50 text-[#0052FF] font-semibold dark:bg-blue-900/20 shadow-sm" 
                        : "text-muted-foreground hover:bg-muted/50 hover:text-foreground",
                      isCollapsed && "justify-center px-0"
                    )}
                  >
                    {ItemContent}
                  </button>
                ) : (
                  <Link
                    href={item.href || "#"}
                    title={isCollapsed ? item.name : undefined}
                    className={cn(
                      "flex items-center gap-3 rounded-xl px-3 py-3 transition-all duration-200 ease-out active:scale-[0.98] hover:scale-[1.01]",
                      isActive 
                        ? "bg-blue-50 text-[#0052FF] font-semibold dark:bg-blue-900/20 shadow-sm" 
                        : "text-muted-foreground hover:bg-muted/50 hover:text-foreground",
                      isCollapsed && "justify-center px-0"
                    )}
                  >
                    {ItemContent}
                  </Link>
                )}
                
                {/* Sub Items */}
                {!isCollapsed && hasSub && (
                  <div className={cn(
                    "grid transition-all duration-200 ease-in-out",
                    isExpanded ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0"
                  )}>
                    <div className="overflow-hidden">
                      <div className="ml-9 mt-1 flex flex-col gap-1 border-l-2 border-muted/50 pl-3">
                        {item.subItems?.map((sub) => {
                          let isSubActive = false;
                          if (sub.href.includes("?")) {
                            const paramString = sub.href.split("?")[1];
                            const urlParams = new URLSearchParams(paramString);
                            isSubActive = pathname === sub.href.split("?")[0];
                            urlParams.forEach((val, key) => {
                              if (searchParams.get(key) !== val) isSubActive = false;
                            });
                          } else {
                            isSubActive = pathname === sub.href;
                            // Don't highlight the base "All Users" if a specific department filter is active
                            if (sub.href === "/users" && searchParams.get("dept")) {
                              isSubActive = false;
                            }
                          }
                                              
                          return (
                            <Link
                              key={sub.name}
                              href={sub.href}
                              className={cn(
                                "rounded-lg px-3 py-2 text-[14px] transition-colors",
                                isSubActive 
                                  ? "text-[#0052FF] font-semibold bg-blue-50/50 dark:bg-blue-900/10" 
                                  : "text-muted-foreground hover:text-foreground hover:bg-muted/30"
                              )}
                            >
                              {sub.name}
                            </Link>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </nav>
      </div>

      <div className={cn("p-3 mt-auto border-t border-border/40", isCollapsed && "p-2")}>
        <Link
          href="/settings"
          title={isCollapsed ? "System Settings" : undefined}
          className={cn(
            "flex items-center gap-3 rounded-xl p-2.5 transition-all duration-300 ease-out active:scale-[0.98] border shadow-sm group",
            pathname.startsWith("/settings") 
              ? "bg-[#0052FF] text-white border-[#0052FF] shadow-md" 
              : "bg-gradient-to-b from-background to-muted/20 hover:from-muted/50 hover:to-muted/50 text-foreground border-border/60"
          )}
        >
          <Settings className={cn(
            "h-[22px] w-[22px] shrink-0 transition-transform duration-500 group-hover:rotate-90", 
            pathname.startsWith("/settings") ? "text-white" : "text-muted-foreground group-hover:text-foreground"
          )} />
          {!isCollapsed && (
            <div className="flex flex-col flex-1 overflow-hidden text-left">
              <span className="truncate text-[14px] font-bold leading-tight">
                System Settings
              </span>
              <span className={cn("truncate text-[10px] font-medium leading-tight mt-0.5", pathname.startsWith("/settings") ? "text-blue-100" : "text-muted-foreground")}>
                Preferences & Config
              </span>
            </div>
          )}
        </Link>
      </div>
    </aside>
  );
}
