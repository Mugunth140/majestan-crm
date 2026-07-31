"use client";

import { Suspense } from "react";
import { Sidebar } from "@/components/layout/sidebar";
import { Topbar } from "@/components/layout/topbar";
import { SidebarProvider } from "@/components/layout/sidebar-context";
import { MobileNavbar } from "@/components/layout/mobile-navbar";
import { MobileGlassHeader } from "@/components/layout/mobile-glass-header";
import { MobileHeaderProvider } from "@/components/layout/mobile-header-context";
import { MainScrollArea } from "@/components/layout/mobile-main-scroller";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <SidebarProvider>
      <MobileHeaderProvider>
        <div className="flex h-[100dvh] overflow-hidden bg-muted/30 transition-colors duration-500 relative">
          <Suspense fallback={<div className="w-64 bg-card border-r h-full hidden lg:block" />}>
            <Sidebar />
          </Suspense>
          <div className="flex flex-col flex-1 overflow-hidden relative">
            <Topbar />
            <MobileGlassHeader />
            <MainScrollArea>
              {children}
            </MainScrollArea>
            <MobileNavbar />
          </div>
        </div>
      </MobileHeaderProvider>
    </SidebarProvider>
  );
}