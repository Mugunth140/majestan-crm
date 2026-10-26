"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { useState, useEffect, useRef } from "react";
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
  UserPen,
  PhoneIncoming,
  Megaphone,
  Hammer,
  Sparkles,
  BookOpen
} from "lucide-react";
import { can } from "@/lib/permissions";
import { canViewAds } from "@/lib/ads-access";
import Image from "next/image";

const navigation = [
  { name: "Dashboard", href: "/", icon: Astroid },
  { name: "Leads", href: "/leads", icon: TrendingUp },
  { name: "Lead Routing", href: "/lead-routing", icon: Route },
  { name: "Inbound", href: "/inbound", icon: Inbox },
  { name: "Agent Network", href: "/agent-network", icon: Network },
  { name: "Projects", href: "/projects", icon: Briefcase },
  { name: "Properties", href: "/properties", icon: Home },
  { name: "Builder", href: "/builders", icon: Hammer },
  { name: "Advertisement", href: "/ads", icon: Megaphone, adsAccess: true },
  { name: "Blog", href: "/blog", icon: BookOpen, blogAccess: true },
  { name: "Showcases", href: "/showcases", icon: Sparkles, adsAccess: true },
  { name: "Asset Inventory", href: "/asset-inventory", icon: Package },
  { name: "HR Panel", href: "/hr", icon: UserPen },
  { name: "Tasks", href: "/tasks", icon: Target },
  { name: "Logger", href: "/logger", icon: PhoneIncoming, adminOrManager: true },
  { name: "Activity Logs", adminOnly: true, href: "/activity-logs", icon: Activity },
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
      { name: "Amenities", href: "/master/amenities" },
      { name: "Lead Sources", href: "/master/sources" },
      { name: "Property Types", href: "/master/property-types" },
      { name: "Cities", href: "/master/cities" },
      { name: "Sublocations", href: "/master/sublocations" },
      { name: "Road Names", href: "/master/road-names" },
      { name: "Registration Charges", href: "/master/registration-charges" },
      { name: "Furnishing Items", href: "/master/furnishing-items" },
      { name: "Room Names", href: "/master/room-names" },
      { name: "Room Dimensions", href: "/master/room-dimensions" },
      { name: "Specifications", href: "/master/specifications" },
      { name: "Utilities", href: "/master/utilities" },
    ]
  },
];

export function Sidebar() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { isCollapsed, setIsCollapsed } = useSidebar();
  const [userRole, setUserRole] = useState<string | null>(null);
  const [blogAccess, setBlogAccess] = useState(false);
  const [userDept, setUserDept] = useState<string>("");
  const [expandedItems, setExpandedItems] = useState<Record<string, boolean>>({});
  const itemRefs = useRef<Record<string, HTMLDivElement | null>>({});

  useEffect(() => {
    try {
      const userStr = localStorage.getItem("crm_user");
      if (userStr) {
        const user = JSON.parse(userStr);
        setBlogAccess(can("blog.manage", user));
        setUserRole(user?.role?.name || user?.role || "");
        setUserDept(((user?.department as any)?.name ?? user?.department ?? "") as string);
      }
    } catch (err) {
      console.error("FailLocationed to parse user from local storage");
    }
  }, []);

  // Initialize expanded state based on active path
  useEffect(() => {
    setExpandedItems(prev => {
      const next = { ...prev };
      navigation.forEach(item => {
        if (item.subItems && item.subItems.some((sub: any) => pathname.startsWith(sub.href))) {
          next[item.name] = true;
        }
      });
      return next;
    });
  }, [pathname]);

  const toggleExpand = (name: string) => {
    const opening = !expandedItems[name];
    setExpandedItems(prev => ({ ...prev, [name]: !prev[name] }));
    if (!opening) return;
    // After the expand animation, nudge only the sidebar's own scroll
    // container so the revealed sub-items are visible (never the page).
    setTimeout(() => {
      const el = itemRefs.current[name];
      const container = el?.closest(".sidebar-scroll") as HTMLElement | null;
      if (!el || !container) return;
      const cRect = container.getBoundingClientRect();
      const eRect = el.getBoundingClientRect();
      if (eRect.bottom > cRect.bottom) {
        container.scrollTo({ top: container.scrollTop + (eRect.bottom - cRect.bottom) + 8, behavior: "smooth" });
      } else if (eRect.top < cRect.top) {
        container.scrollTo({ top: container.scrollTop - (cRect.top - eRect.top) - 8, behavior: "smooth" });
      }
    }, 230);
  };

  const isAdmin = userRole === "Admin" || userRole === "Super Admin";
  const canViewLogger = isAdmin || userRole === "Manager";


  const navStyles = `
    .side-nav-item-v8 {
      position: relative;
      transition: all 0.5s ease;
      border: 1px solid transparent;
      z-index: 0;
      background-color: transparent;
      background-image: linear-gradient(to right, rgba(0, 0, 0, 0.04), rgba(0, 0, 0, 0.08));
      background-size: 0% 100%;
      background-repeat: no-repeat;
      background-position: left center;
    }
    .dark .side-nav-item-v8 {
      background-image: linear-gradient(to right, rgba(255, 255, 255, 0.06), rgba(255, 255, 255, 0.01));
    }
    
    .side-nav-active-v8 {
      color: #0052FF;
    }
    
    /* Crossfade overlays for Active State */
    .side-nav-active-fill {
      background-image: linear-gradient(to right, #dbeafe 0%, #eff6ff 100%);
    }
    .dark .side-nav-active-fill {
      background-image: linear-gradient(to right, rgba(59, 130, 246, 0.2) 0%, rgba(30, 58, 138, 0.1) 100%);
    }
    
    .side-nav-active-border {
      padding: 1px;
      background: linear-gradient(70deg, rgba(0, 82, 255, 0.8) 0%, rgba(0, 82, 255, 0.1) 100%);
      -webkit-mask: linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0);
      -webkit-mask-composite: xor; mask-composite: exclude;
    }
    .dark .side-nav-active-border {
      background: linear-gradient(70deg, rgba(59, 130, 246, 0.8) 0%, rgba(59, 130, 246, 0.1) 100%);
    }

    /* Hover State Border Shimmer on ::before */
    .side-nav-item-v8::before {
      content: ""; position: absolute; inset: 0; border-radius: inherit; padding: 1px;
      background: linear-gradient(70deg, rgba(0, 0, 0, 0.1) 0%, rgba(0, 0, 0, 0.1) 45%, rgba(0, 0, 0, 0.3) 50%, transparent 55%, transparent 100%);
      background-size: 300% 100%; background-position: 100% 0;
      -webkit-mask: linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0);
      -webkit-mask-composite: xor; mask-composite: exclude;
      z-index: 2; opacity: 0; transition: opacity 0.3s ease; pointer-events: none;
    }
    .dark .side-nav-item-v8::before {
      background: linear-gradient(70deg, rgba(255, 255, 255, 0.15) 0%, rgba(255, 255, 255, 0.15) 45%, rgba(255, 255, 255, 0.8) 50%, transparent 55%, transparent 100%);
      background-size: 300% 100%;
    }

    .side-nav-item-v8:not(.side-nav-active-v8):hover {
      color: var(--color-foreground);
      animation: nav-bg-wipe-v8 0.7s ease-out forwards;
    }
    .side-nav-item-v8:not(.side-nav-active-v8):hover::before {
      opacity: 1; animation: border-sweep-fill-v8 0.7s ease-out forwards;
    }

    @keyframes border-sweep-fill-v8 {
      0% { background-position: 100% 0; }
      100% { background-position: 0% 0; }
    }
    @keyframes nav-bg-wipe-v8 {
      0% { background-size: 0% 100%; }
      100% { background-size: 100% 100%; }
    }
  `;

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: navStyles }} />
      <aside

      className={cn(
        "hidden md:flex flex-col my-3 ml-3 rounded-xl border bg-card shadow-sm transition-all duration-300 overflow-hidden relative group",
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

      <div className="sidebar-scroll flex-1 overflow-x-hidden overflow-y-auto py-3 scrollbar-none">
        <nav className="grid items-start px-2 gap-1 text-[14px] font-medium">
          {navigation.map((item: any) => {
            if (item.blogAccess && !blogAccess) return null;
            if (item.adminOnly && !isAdmin) return null;
            if (item.adminOrManager && !canViewLogger) return null;
            if ((item as any).adsAccess && !canViewAds({ role: userRole ?? "", department: userDept })) return null;

            const hasSub = item.subItems && item.subItems.length > 0;
            const isActive = item.href ? (pathname === item.href || pathname.startsWith(item.href + "/")) : (hasSub && item.subItems?.some((sub: any) => pathname.startsWith(sub.href)));
            const isExpanded = expandedItems[item.name] || false;

            const ItemContent = (
              <>
                <div className={cn("absolute inset-0 rounded-xl z-0 transition-opacity duration-500 pointer-events-none side-nav-active-fill", isActive ? "opacity-100" : "opacity-0")} />
                <div className={cn("absolute inset-0 rounded-xl z-0 transition-opacity duration-500 pointer-events-none side-nav-active-border", isActive ? "opacity-100" : "opacity-0")} />
                <item.icon className={cn("h-[22px] w-[22px] shrink-0 relative z-10 transition-colors duration-500", isActive ? "text-[#0052FF]" : "text-muted-foreground")} />
                {!isCollapsed && <span className="truncate whitespace-nowrap flex-1 text-left relative z-10 transition-colors duration-500">{item.name}</span>}
                {!isCollapsed && hasSub && (
                  <ChevronDown className={cn("h-4 w-4 transition-transform duration-200 text-muted-foreground relative z-10", isExpanded && "rotate-180")} />
                )}
              </>
            );

            return (
              <div
                key={item.name}
                ref={(el) => {
                  itemRefs.current[item.name] = el;
                }}
                className="flex flex-col gap-1"
              >
                {hasSub ? (
                  <button
                    title={isCollapsed ? item.name : undefined}
                    onClick={() => toggleExpand(item.name)}
                    className={cn(
                      "side-nav-item-v8 relative flex items-center gap-3 rounded-xl px-3 py-3 transition-all duration-300 ease-out active:scale-[0.98]",
                      isActive 
                        ? "side-nav-active-v8 font-semibold shadow-sm" 
                        : "text-muted-foreground hover:text-foreground",
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
                      "side-nav-item-v8 relative flex items-center gap-3 rounded-xl px-3 py-3 transition-all duration-300 ease-out active:scale-[0.98]",
                      isActive 
                        ? "side-nav-active-v8 font-semibold shadow-sm" 
                        : "text-muted-foreground hover:text-foreground",
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
                        {item.subItems?.map((sub: any) => {
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
                                "side-nav-item-v8 overflow-hidden rounded-lg px-3 py-2 text-[13px] transition-all duration-300",
                                isSubActive 
                                  ? "side-nav-active-v8 font-semibold" 
                                  : "text-muted-foreground hover:text-foreground"
                              )}
                            >
                              <div className={cn("absolute inset-0 rounded-lg z-0 transition-opacity duration-500 pointer-events-none side-nav-active-fill", isSubActive ? "opacity-100" : "opacity-0")} />
                              <div className={cn("absolute inset-0 rounded-lg z-0 transition-opacity duration-500 pointer-events-none side-nav-active-border", isSubActive ? "opacity-100" : "opacity-0")} />
                              <span className="relative z-10 transition-colors duration-500">{sub.name}</span>
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

      <div className={cn("px-3 py-2 mt-auto border-t border-border/50", isCollapsed && "p-2")}>
        <Link
          href="/settings"
          title={isCollapsed ? (userRole ? userRole + " Settings" : "Settings") : undefined}
          className={cn(
            "side-nav-item-v8 relative flex items-center gap-3 rounded-xl px-3 py-3 transition-all duration-300 ease-out active:scale-[0.98]",
            pathname.startsWith("/settings")
              ? "side-nav-active-v8 font-semibold shadow-sm"
              : "text-muted-foreground hover:text-foreground",
            isCollapsed && "justify-center px-0"
          )}
        >
          <div className={cn("absolute inset-0 rounded-xl z-0 transition-opacity duration-500 pointer-events-none side-nav-active-fill", pathname.startsWith("/settings") ? "opacity-100" : "opacity-0")} />
          <div className={cn("absolute inset-0 rounded-xl z-0 transition-opacity duration-500 pointer-events-none side-nav-active-border", pathname.startsWith("/settings") ? "opacity-100" : "opacity-0")} />
          <Settings className={cn(
            "h-[22px] w-[22px] shrink-0 relative z-10 transition-colors duration-500",
            pathname.startsWith("/settings") ? "text-[#0052FF]" : "text-muted-foreground"
          )} />
          {!isCollapsed && (
            <span className="truncate whitespace-nowrap flex-1 text-left relative z-10 transition-colors duration-500">
              {userRole ? userRole + " Settings" : "Settings"}
            </span>
          )}
        </Link>
      </div>
    </aside>
    </>
  );
}
