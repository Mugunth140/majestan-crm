"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { cn } from "@/lib/utils";
import { 
  LayoutDashboard, 
  Users, 
  ShieldAlert, 
  Building2, 
  Home, 
  Activity, 
  Settings,
  ChevronLeft,
  ChevronRight
} from "lucide-react";
import Image from "next/image";

const navigation = [
  { name: "Dashboard", href: "/", icon: LayoutDashboard },
  { name: "Users", href: "/users", icon: Users },
  { name: "Roles", href: "/roles", icon: ShieldAlert },
  { name: "Departments", href: "/departments", icon: Building2 },
  { name: "Properties", href: "/properties", icon: Home },
  { name: "Activity Logs", href: "/activity-logs", icon: Activity },
  { name: "Settings", href: "/settings", icon: Settings },
];

export function Sidebar() {
  const pathname = usePathname();
  const [isCollapsed, setIsCollapsed] = useState(false);

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
        <nav className="grid items-start px-3 gap-1 text-sm font-medium">
          {navigation.map((item) => {
            const isActive = pathname === item.href || pathname.startsWith(item.href + "/");
            return (
              <Link
                key={item.name}
                href={item.href}
                title={isCollapsed ? item.name : undefined}
                className={cn(
                  "flex items-center gap-3 rounded-lg px-3 py-2.5 transition-all",
                  isActive 
                    ? "bg-primary/10 text-primary" 
                    : "text-muted-foreground hover:bg-accent hover:text-accent-foreground",
                  isCollapsed && "justify-center px-0"
                )}
              >
                <item.icon className="h-5 w-5 shrink-0" />
                {!isCollapsed && <span className="truncate whitespace-nowrap">{item.name}</span>}
              </Link>
            );
          })}
        </nav>
      </div>
    </aside>
  );
}
