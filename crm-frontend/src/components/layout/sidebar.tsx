"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { useState, useEffect } from "react";
import { cn } from "@/lib/utils";
import { 
  LayoutDashboard, 
  Users, 
  ShieldAlert, 
  Building2, 
  Home, 
  Astroid,
  Activity, 
  Settings,
  ChevronLeft,
  ChevronRight
} from "lucide-react";
import Image from "next/image";

const navigation = [
  { name: "Dashboard", href: "/", icon: LayoutDashboard },
  { name: "Leads", href: "/leads", icon: Astroid },
  { 
    name: "Users", 
    icon: Users, 
    adminOnly: true,
    href: "/users"
  },
  { name: "Roles", href: "/roles", icon: ShieldAlert, adminOnly: true },
  { name: "Departments", href: "/departments", icon: Building2 },
  { name: "Properties", href: "/properties", icon: Home },
  { name: "Activity Logs", href: "/activity-logs", icon: Activity },
  { 
    name: "Master Data", 
    icon: Settings,
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
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [userRole, setUserRole] = useState<string | null>(null);

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
            <span className="font-semibold tracking-tight truncate whitespace-nowrap">
              Majestan CRM
            </span>
          )}
        </Link>
      </div>

      <div className="flex-1 overflow-x-hidden overflow-y-auto py-4 scrollbar-hide">
        <nav className="grid items-start px-2 gap-1 text-[15px] font-medium">
          {navigation.map((item) => {
            if (item.adminOnly && !isAdmin) return null;

            const hasSub = item.subItems && item.subItems.length > 0;
            const isActive = item.href ? (pathname === item.href || pathname.startsWith(item.href + "/")) : (hasSub && item.subItems?.some(sub => pathname.startsWith(sub.href)));

            return (
              <div key={item.name} className="flex flex-col gap-1">
                <Link
                  href={item.href || (item.subItems ? item.subItems[0].href : "#")}
                  title={isCollapsed ? item.name : undefined}
                  className={cn(
                    "flex items-center gap-3 rounded-xl px-3 py-3 transition-all duration-200 ease-out active:scale-[0.98] hover:scale-[1.01]",
                    isActive 
                      ? "bg-blue-50 text-[#0052FF] font-semibold dark:bg-blue-900/20 shadow-sm" 
                      : "text-muted-foreground hover:bg-muted/50 hover:text-foreground",
                    isCollapsed && "justify-center px-0"
                  )}
                >
                  <item.icon className={cn("h-[22px] w-[22px] shrink-0", isActive ? "text-[#0052FF]" : "text-muted-foreground")} />
                  {!isCollapsed && <span className="truncate whitespace-nowrap">{item.name}</span>}
                </Link>
                
                {/* Sub Items */}
                {!isCollapsed && hasSub && isActive && (
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
                )}
              </div>
            );
          })}
        </nav>
      </div>
    </aside>
  );
}
