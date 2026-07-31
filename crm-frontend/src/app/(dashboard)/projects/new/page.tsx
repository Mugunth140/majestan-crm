import { MobileHeader } from "@/components/layout/mobile-header";

export default function NewProjectPage() {
  return (
    <div className="flex flex-col space-y-6 animate-in fade-in duration-500">
      <MobileHeader title="New Project" showBack />
      <div className="px-4 md:px-0">
        <div className="bg-card border rounded-2xl p-10 shadow-sm flex flex-col items-center justify-center text-center h-[50vh]">
          <h3 className="text-xl font-bold text-foreground mb-2">Projects is coming soon</h3>
          <p className="text-muted-foreground">This module is currently under development. Please check back later.</p>
        </div>
      </div>
    </div>
  );
}
