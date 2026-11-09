"use client";
import { Suspense } from "react";
import { useIsClient } from "@/hooks/use-is-client";
import { MobileHeader } from "@/components/layout/mobile-header";
import { TargetForm } from "@/components/tasks/target-form";

export default function NewTargetsPage() {
  const ready = useIsClient();
  return (
    <>
      <MobileHeader title="Set targets" showBack />
      <div className="dash-palette">
        {ready && <Suspense><TargetForm /></Suspense>}
      </div>
    </>
  );
}
