"use client";

import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { useTheme } from "next-themes";
import { toast } from "sonner";
import { ChevronRight, LogOut, Mail, Moon } from "lucide-react";
import { MobileHeader } from "@/components/layout/mobile-header";
import { readUser } from "@/components/layout/nav-items";
import { moduleGroups } from "@/components/mobile/app-modules";
import { NameAvatar } from "@/components/shared/name-avatar";
import { cn } from "@/lib/utils";

const THEMES = [
  { value: "light", label: "Light" },
  { value: "dark", label: "Dark" },
  { value: "system", label: "Auto" },
] as const;

// The phone app's fifth tab: every module not on the tab bar, then the
// user's own preferences. Desktop reaches all of this from the sidebar.
export default function MorePage() {
  const router = useRouter();
  const [user] = useState(readUser);
  const { theme, setTheme } = useTheme();
  const groups = moduleGroups(user, ["/tasks"]);

  const logout = () => {
    localStorage.removeItem("crm_token");
    localStorage.removeItem("crm_user");
    document.cookie = "crm_token=; path=/; max-age=0";
    toast.success("Logged out successfully");
    router.push("/login");
  };

  return (
    <>
      <MobileHeader title="More" />
      <div className="mx-auto max-w-2xl space-y-7 pt-3 md:pt-0">
        {user && (
          <div className="mx-4 flex items-center gap-3.5 rounded-[14px] bg-[color-mix(in_oklab,var(--muted)_70%,var(--background))] p-3.5 dark:bg-[oklch(0.205_0_0)]">
            <NameAvatar name={user.name} className="size-14 text-[22px]" />
            <div className="min-w-0">
              <div className="truncate text-[19px] font-semibold tracking-tight">{user.name}</div>
              <div className="truncate text-[14px] text-muted-foreground">{[user.role, user.department].filter(Boolean).join(" · ")}</div>
            </div>
          </div>
        )}

        {groups.map((group) => (
          <section key={group.title}>
            <h2 className="m-group-title">{group.title}</h2>
            <ul className="m-group mx-4">
              {group.modules.map((m) => (
                <li key={m.href}>
                  <Link href={m.href} className="m-cell">
                    <span className={cn("m-tile", m.tile)}>
                      <m.icon className="size-[18px] text-white" strokeWidth={2} />
                    </span>
                    <span className="m-cell-body">
                      <span className="flex-1 truncate text-[16px]">{m.name}</span>
                      <ChevronRight className="size-[18px] text-muted-foreground/50" />
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        ))}

        <section>
          <h2 className="m-group-title">Preferences</h2>
          <ul className="m-group mx-4">
            <li>
              <div className="m-cell">
                <span className="m-tile bg-indigo-500">
                  <Moon className="size-[18px] text-white" strokeWidth={2} />
                </span>
                <span className="m-cell-body">
                  <span className="flex-1 text-[16px]">Appearance</span>
                  <span role="radiogroup" aria-label="Appearance" className="flex rounded-[9px] bg-foreground/[0.07] p-0.5">
                    {THEMES.map((t) => (
                      <button
                        key={t.value}
                        type="button"
                        role="radio"
                        aria-checked={theme === t.value}
                        onClick={() => setTheme(t.value)}
                        className={cn(
                          "h-7 rounded-[7px] px-2.5 text-[13px] font-medium transition-colors",
                          theme === t.value ? "bg-background text-foreground shadow-[0_1px_3px_rgba(0,0,0,0.12)] dark:bg-white/15" : "text-muted-foreground",
                        )}
                      >
                        {t.label}
                      </button>
                    ))}
                  </span>
                </span>
              </div>
            </li>
            <li>
              <Link href="/settings/email-templates" className="m-cell">
                <span className="m-tile bg-blue-500">
                  <Mail className="size-[18px] text-white" strokeWidth={2} />
                </span>
                <span className="m-cell-body">
                  <span className="flex-1 text-[16px]">Email templates</span>
                  <ChevronRight className="size-[18px] text-muted-foreground/50" />
                </span>
              </Link>
            </li>
          </ul>
        </section>

        <ul className="m-group mx-4">
          <li>
            <button type="button" onClick={logout} className="m-cell justify-center">
              <span className="m-cell-body justify-center pl-3">
                <LogOut className="size-[18px] text-red-600 dark:text-red-400" strokeWidth={2} />
                <span className="text-[16px] font-medium text-red-600 dark:text-red-400">Log out</span>
              </span>
            </button>
          </li>
        </ul>
      </div>
    </>
  );
}
