"use client";

import { InboundLocationSync } from "@/components/layout/inbound-location-sync";
import { Suspense } from "react";
import { Sidebar } from "@/components/layout/sidebar";
import { Topbar } from "@/components/layout/topbar";
import { SidebarProvider } from "@/components/layout/sidebar-context";
import { MobileNavbar } from "@/components/layout/mobile-navbar";
import { MobileGlassHeader } from "@/components/layout/mobile-glass-header";
import { MobileHeaderProvider } from "@/components/layout/mobile-header-context";
import { MainScrollArea } from "@/components/layout/mobile-main-scroller";
import { NotificationProvider } from "@/context/notification-context";
import { useIsClient } from "@/hooks/use-is-client";
import DashboardLoading from "./loading";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Pages restore their saved tabs/filters/page from sessionStorage on first
  // render, which the server can't see — so mount them client-side only. In-app
  // navigation is unaffected; a hard reload shows the loading skeleton a frame.
  const isClient = useIsClient();
  return (
    <NotificationProvider>
      <InboundLocationSync />
      <SidebarProvider>
        <MobileHeaderProvider>
          <div className="flex w-full min-h-[100dvh] md:h-[100dvh] md:overflow-hidden bg-card md:bg-muted/30 transition-colors duration-500 relative">
            <Suspense fallback={<div className="w-64 bg-card border-r h-full hidden lg:block" />}>
              <Sidebar />
            </Suspense>
            <div className="flex flex-col flex-1 w-full relative md:overflow-hidden">
              <Topbar />
              <MobileGlassHeader />
              <MainScrollArea>
                {isClient ? children : <DashboardLoading />}
              </MainScrollArea>
              <MobileNavbar />
            </div>
          </div>
        </MobileHeaderProvider>
      </SidebarProvider>
    </NotificationProvider>
  );
}