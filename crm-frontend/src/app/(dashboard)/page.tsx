"use client";
import { Suspense } from "react";
import { useIsClient } from "@/hooks/use-is-client";
import { MobileHeader } from "@/components/layout/mobile-header";
import { Dashboard } from "@/components/dashboard/dashboard";
import { DashboardSkeleton } from "@/components/dashboard/skeleton";

export default function DashboardPage() {
  const ready = useIsClient();

  return (
    <>
      <MobileHeader title="Home" />
      {ready && (
        <Suspense fallback={<DashboardSkeleton />}>
          <Dashboard />
        </Suspense>
      )}
    </>
  );
}
