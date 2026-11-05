"use client";

import { Menu } from "@base-ui/react/menu";
import { useRouter } from "next/navigation";
import { useTheme } from "next-themes";
import { toast } from "sonner";
import { ChevronDown, LogOut, Moon, PanelLeftClose, PanelLeftOpen, Settings, Sun, type LucideIcon } from "lucide-react";
import { PrismarkMark } from "@/components/brand/prismark-mark";
import { cn } from "@/lib/utils";
import { Avatar } from "@/components/record/feed";

// Frappe-style menu surface: elevated card, groups split by hairlines, compact rows.
const popupClass =
  "min-w-56 origin-[var(--transform-origin)] divide-y divide-black/[0.06] rounded-xl bg-popover text-popover-foreground shadow-[0_12px_32px_-8px_rgba(0,0,0,0.18),0_4px_8px_-4px_rgba(0,0,0,0.08)] ring-1 ring-black/[0.06] outline-none transition-[opacity,transform] duration-150 data-[ending-style]:scale-[0.97] data-[ending-style]:opacity-0 data-[starting-style]:scale-[0.97] data-[starting-style]:opacity-0 dark:divide-white/[0.08] dark:ring-white/10";
const itemClass =
  "flex h-7 cursor-pointer select-none items-center gap-2 rounded-md px-2 text-[14px] text-foreground/85 outline-none data-[highlighted]:bg-black/[0.05] dark:data-[highlighted]:bg-white/[0.08]";

function Item({ icon: Icon, label, onClick, danger }: { icon: LucideIcon; label: string; onClick: () => void; danger?: boolean }) {
  return (
    <Menu.Item onClick={onClick} className={cn(itemClass, danger && "text-red-600 data-[highlighted]:bg-red-500/10 dark:text-red-400")}>
      <Icon className={cn("size-4 shrink-0", danger ? "" : "text-muted-foreground")} strokeWidth={1.75} />
      <span className="truncate">{label}</span>
    </Menu.Item>
  );
}

// Workspace switcher at the top of the sidebar: brand, signed-in user, and account actions.
export function WorkspaceMenu({
  userName,
  role,
  avatar,
  collapsed,
  onToggleCollapsed,
}: {
  userName: string;
  role: string;
  avatar?: string | null;
  collapsed: boolean;
  onToggleCollapsed: () => void;
}) {
  const router = useRouter();
  const { resolvedTheme, setTheme } = useTheme();
  const isDark = resolvedTheme === "dark";

  const logout = () => {
    localStorage.removeItem("crm_token");
    localStorage.removeItem("crm_user");
    document.cookie = "crm_token=; path=/; max-age=0";
    toast.success("Logged out successfully");
    router.push("/login");
  };

  return (
    <Menu.Root>
      <Menu.Trigger
        aria-label="Workspace menu"
        className={cn(
          "flex h-12 w-full items-center gap-2.5 rounded-lg text-left outline-none transition-colors focus-visible:ring-2 focus-visible:ring-[#017D58]/40",
          // Collapsed, the mark stands on its own: no card outline around it.
          collapsed
            ? "justify-center px-0 hover:bg-black/[0.045] dark:hover:bg-white/[0.06]"
            : cn(
                "px-2.5 bg-background shadow-[0_0_0_1px_rgba(0,0,0,0.08),0_1px_2px_rgba(0,0,0,0.05)] hover:shadow-[0_0_0_1px_rgba(0,0,0,0.13),0_1px_2px_rgba(0,0,0,0.06)]",
                "dark:bg-white/[0.06] dark:shadow-[0_0_0_1px_rgba(255,255,255,0.1)] dark:hover:bg-white/[0.09]",
              ),
        )}
      >
        <PrismarkMark className="size-6 shrink-0 text-[#017D58] dark:text-[#2FB585]" />
        {!collapsed && (
          <>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-[15px] font-semibold leading-none tracking-[-0.01em] text-foreground">CRM</span>
              <span className="mt-1 block truncate text-xs leading-none text-muted-foreground">{userName || role || " "}</span>
            </span>
            <ChevronDown className="size-4 shrink-0 text-muted-foreground" />
          </>
        )}
      </Menu.Trigger>
      <Menu.Portal>
        <Menu.Positioner side="bottom" align="start" sideOffset={6} className="z-50 outline-none">
          <Menu.Popup className={popupClass}>
            {(userName || role) && (
              <div className="flex items-center gap-2.5 px-3.5 py-2.5">
                {userName && <Avatar name={userName} src={avatar} className="h-8 w-8 text-[11px]" />}
                <div className="min-w-0">
                  <p className="truncate text-[14px] font-medium leading-tight text-foreground">{userName}</p>
                  {role && <p className="mt-0.5 truncate text-xs text-muted-foreground">{role}</p>}
                </div>
              </div>
            )}
            <Menu.Group className="p-1.5">
              <Item icon={isDark ? Sun : Moon} label={isDark ? "Light mode" : "Dark mode"} onClick={() => setTheme(isDark ? "light" : "dark")} />
              <Item icon={collapsed ? PanelLeftOpen : PanelLeftClose} label={collapsed ? "Expand" : "Collapse"} onClick={onToggleCollapsed} />
              <Item icon={Settings} label="Settings" onClick={() => router.push("/settings")} />
            </Menu.Group>
            <Menu.Group className="p-1.5">
              <Item icon={LogOut} label="Log out" onClick={logout} danger />
            </Menu.Group>
          </Menu.Popup>
        </Menu.Positioner>
      </Menu.Portal>
    </Menu.Root>
  );
}
