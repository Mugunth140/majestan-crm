"use client";

import { MobileHeader } from "@/components/layout/mobile-header";
import { EmptyState } from "@/components/shared/empty-state";

// Placeholder: Analytics is on the sidebar for Admins and Managers; the page comes later.
export default function AnalyticsPage() {
  return (
    <>
      <MobileHeader title="Analytics" />
      <EmptyState kind="records" className="py-24" title="Analytics is coming soon" description="Reports and charts for the whole team will show up here." />
    </>
  );
}
