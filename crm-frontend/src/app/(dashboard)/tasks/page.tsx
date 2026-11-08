"use client";
import { Suspense } from "react";
import { useIsClient } from "@/hooks/use-is-client";
import { MobileHeader } from "@/components/layout/mobile-header";
import { BoardSkeleton, TargetsPage, readMe } from "@/components/tasks/targets-page";

export default function TasksPage() {
  const ready = useIsClient();
  return (
    <>
      <MobileHeader title={ready && readMe().role === "Staff" ? "My tasks" : "Tasks"} />
      <div className="dash-palette">
        {ready && (
          <Suspense fallback={<BoardSkeleton />}>
            <TargetsPage />
          </Suspense>
        )}
      </div>
    </>
  );
}
