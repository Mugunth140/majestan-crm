"use client";

import { Suspense } from "react";
import { Sidebar } from "@/components/layout/sidebar";
import { Topbar } from "@/components/layout/topbar";
import { SidebarProvider } from "@/components/layout/sidebar-context";
import { MobileNavbar } from "@/components/layout/mobile-navbar";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <SidebarProvider>
      <div className="flex h-[100dvh] overflow-hidden bg-muted/30 transition-colors duration-500 relative">
        <Suspense fallback={<div className="w-64 bg-card border-r h-full hidden lg:block" />}>
          <Sidebar />
        </Suspense>
        <div className="flex flex-col flex-1 overflow-hidden relative">
          <Topbar />
          <main className="flex-1 overflow-y-auto px-4 lg:px-8 pb-32 lg:pb-8 pt-[calc(3.5rem+env(safe-area-inset-top))] lg:pt-8">
            {children}
          </main>
          <MobileNavbar />
        </div>
      </div>
    </SidebarProvider>
  );
}