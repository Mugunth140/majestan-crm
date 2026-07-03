
import { Settings } from "lucide-react";

export default function SettingsPage() {
  return (
    <div className="flex flex-col space-y-6 animate-in fade-in duration-500">
      <div className="flex items-center justify-between">
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
    </div>
  );
}
  