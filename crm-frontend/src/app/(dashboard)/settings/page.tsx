"use client";

import { Settings, LogOut } from "lucide-react";
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
        <div className="bg-card border rounded-2xl p-10 shadow-sm flex flex-col items-center justify-center text-center h-[50vh]">
          <div className="h-16 w-16 bg-blue-50 text-[#0052FF] rounded-full flex items-center justify-center mb-4 shadow-sm border border-blue-100">
            <Settings className="h-8 w-8" />
          </div>
          <h3 className="text-xl font-bold text-foreground mb-2">Settings are coming soon</h3>
          <p className="text-muted-foreground max-w-sm">
            System configuration, user preferences, and platform integrations will be available in this module soon.
          </p>
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
