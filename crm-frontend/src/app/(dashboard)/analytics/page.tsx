"use client";

import { MobileHeader } from "@/components/layout/mobile-header";
import { SiteAnalyticsDashboard } from "@/components/site-analytics/dashboard";
import { useIsClient } from "@/hooks/use-is-client";

export default function AnalyticsPage() {
  const ready = useIsClient();
  return (
    <>
      <MobileHeader title="Analytics" />
      {ready && <SiteAnalyticsDashboard />}
    </>
  );
}
