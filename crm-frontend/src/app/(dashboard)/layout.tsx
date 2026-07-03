import { Suspense } from "react";
import { Sidebar } from "@/components/layout/sidebar";
import { Topbar } from "@/components/layout/topbar";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex h-screen overflow-hidden bg-muted/30 transition-colors duration-500">
      <Suspense fallback={<div className="w-64 bg-card border-r h-full hidden lg:block" />}>
        <Sidebar />
      </Suspense>
      <div className="flex flex-col flex-1 overflow-hidden relative">
        <Topbar />
        <main className="flex-1 overflow-y-auto px-8 pb-8 pt-8">
          {children}
        </main>
      </div>
    </div>
  );
}
