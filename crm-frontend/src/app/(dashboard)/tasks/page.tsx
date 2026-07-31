import { MobileHeader } from "@/components/layout/mobile-header";

export default function TasksPage() {
  return (
    <div className="flex flex-col space-y-6 animate-in fade-in duration-500">
      <MobileHeader title="Tasks" />
      <div className="px-4 md:px-0">
        <div className="hidden md:flex items-center justify-between">
          <h1 className="text-[28px] font-bold tracking-tight">Tasks</h1>
        </div>
        <div className="bg-card border rounded-2xl p-10 shadow-sm flex flex-col items-center justify-center text-center h-[50vh]">
          <h3 className="text-xl font-bold text-foreground mb-2">Tasks module is coming soon</h3>
          <p className="text-muted-foreground">Your daily follow-ups, calls, and assignments will appear here.</p>
        </div>
      </div>
    </div>
  );
}
