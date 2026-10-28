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
    <div className="flex flex-col space-y-6 animate-in fade-in duration-500">
      <MobileHeader title="Settings" />
      <div className="px-4 md:px-0">
        <div className="hidden md:flex items-center justify-between">
          <h1 className="text-[28px] font-bold tracking-tight">System Settings</h1>
        </div>
        <div className="mt-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          <button
            type="button"
            onClick={() => router.push("/settings/email-templates")}
            className="group flex items-start gap-4 rounded-2xl border bg-card p-5 text-left shadow-sm transition-colors hover:border-[#0052FF]/40"
          >
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-blue-100 bg-blue-50 text-[#0052FF] dark:border-blue-900 dark:bg-blue-950/40">
              <Mail className="h-5 w-5" />
            </span>
            <span className="min-w-0 flex-1">
              <span className="flex items-center justify-between gap-2 text-[15px] font-bold text-foreground">
                Email templates
                <ChevronRight className="h-4 w-4 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
              </span>
              <span className="mt-1 block text-[13px] leading-snug text-muted-foreground">
                Wording of the emails the CRM sends, and saved templates for writing your own.
              </span>
            </span>
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
