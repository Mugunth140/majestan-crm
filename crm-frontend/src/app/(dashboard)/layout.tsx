"use client";

import { InboundLocationSync } from "@/components/layout/inbound-location-sync";
import { Suspense } from "react";
import { Sidebar } from "@/components/layout/sidebar";
import { PageHeader } from "@/components/layout/page-header";
import { PageActionsProvider } from "@/components/layout/page-actions";
import { RefreshPill } from "@/components/layout/refresh-pill";
import { SidebarProvider } from "@/components/layout/sidebar-context";
import { NavGuard } from "@/components/layout/nav-guard";
import { MobileNavbar } from "@/components/layout/mobile-navbar";
import { MobileGlassHeader } from "@/components/layout/mobile-glass-header";
import { MobileHeaderProvider } from "@/components/layout/mobile-header-context";
import { MainScrollArea } from "@/components/layout/mobile-main-scroller";
import { NotificationProvider } from "@/context/notification-context";
import { Onboarding } from "@/components/onboarding/onboarding";
import { useIsClient } from "@/hooks/use-is-client";
import DashboardLoading from "./loading";
import "@/components/mobile/mobile.css";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Pages restore their saved tabs/filters/page from localStorage on first
  // render, which the server can't see — so mount them client-side only. In-app
  // navigation is unaffected; a hard reload shows the loading skeleton a frame.
  const isClient = useIsClient();
  return (
    <NotificationProvider>
      <InboundLocationSync />
      <SidebarProvider>
        <MobileHeaderProvider>
          <PageActionsProvider>
            <RefreshPill />
            {/* `isolate` keeps page z-indexes (sticky table headers etc.) below portalled Kumo overlays */}
            <div className="relative isolate flex w-full min-h-[100dvh] bg-background md:h-[100dvh] md:overflow-hidden">
              <Suspense fallback={<div className="hidden h-full w-[232px] shrink-0 border-r bg-sidebar md:block" />}>
                <Sidebar />
              </Suspense>
              <div className="relative flex w-full min-w-0 flex-1 flex-col md:overflow-hidden">
                <PageHeader />
                <MobileGlassHeader />
                <MainScrollArea>
                  {isClient ? <NavGuard>{children}</NavGuard> : <DashboardLoading />}
                </MainScrollArea>
                <MobileNavbar />
                {isClient && <Onboarding />}
              </div>
            </div>
          </PageActionsProvider>
        </MobileHeaderProvider>
      </SidebarProvider>
    </NotificationProvider>
  );
}