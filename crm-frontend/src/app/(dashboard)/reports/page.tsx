"use client";

import { MobileHeader } from "@/components/layout/mobile-header";
import { ReportBuilder } from "@/components/reports/report-builder";
import { useIsClient } from "@/hooks/use-is-client";

export default function ReportsPage() {
  const ready = useIsClient();
  return (
    <>
      <MobileHeader title="Reports" />
      {ready && <ReportBuilder />}
    </>
  );
}
