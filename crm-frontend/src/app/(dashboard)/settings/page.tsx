"use client";

import { ChevronRight, LogOut, Mail } from "lucide-react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { MobileHeader } from "@/components/layout/mobile-header";

export default function SettingsPage() {
  const router = useRouter();

  const handleLogout = () => {
    localStorage.removeItem("crm_token");
    localStorage.removeItem("crm_user");
    document.cookie = "crm_token=; path=/; max-age=0";
    toast.success("Logged out successfully");
    router.push("/login");
  };

  return (
    <div className="flex flex-col space-y-6 md:space-y-0">
      <MobileHeader title="Settings" />
      <div className="px-4 md:px-0">
        <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3 md:pt-1">
          <button
            type="button"
            onClick={() => router.push("/settings/email-templates")}
            className="group flex items-center gap-3 rounded-lg border bg-background px-3.5 py-3 text-left outline-none transition-[background-color,box-shadow] hover:bg-muted/40 hover:shadow-[0_2px_8px_-2px_rgba(0,0,0,0.08)] focus-visible:ring-2 focus-visible:ring-[#017D58]/40"
          >
            <span className="flex size-9 shrink-0 items-center justify-center rounded-md bg-muted/70">
              <Mail className="size-[18px] text-blue-600 dark:text-blue-400" strokeWidth={1.75} />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-[14px] font-medium text-foreground">Email templates</span>
              <span className="block truncate text-[13px] text-muted-foreground">Wording of the emails the CRM sends, and your saved templates.</span>
            </span>
            <ChevronRight className="size-4 shrink-0 text-muted-foreground/60 transition-transform group-hover:translate-x-0.5" />
          </button>
        </div>

        <button
          onClick={handleLogout}
          className="md:hidden mt-6 w-full flex items-center justify-center gap-2 rounded-2xl border border-red-200 bg-red-50/50 dark:border-red-900/40 dark:bg-red-950/30 py-4 text-red-600 dark:text-red-400 font-semibold active:scale-[0.98] transition-transform"
        >
          <LogOut className="w-5 h-5" />
          Log Out
        </button>
      </div>
    </div>
  );
}
