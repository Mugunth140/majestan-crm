"use client";

import { usePathname } from "next/navigation";
import { DashboardSkeleton, DetailPageSkeleton, ListPageSkeleton } from "@/components/layout/page-skeletons";

// Shown while a page's code loads. The shell (sidebar, top row) stays put, so
// only the content area needs a placeholder, shaped like the page being opened.
export default function DashboardLoading() {
  const pathname = usePathname() ?? "/";
  const segments = pathname.split("/").filter(Boolean);
  if (segments.length === 0) return <DashboardSkeleton />;
  const last = segments[segments.length - 1];
  if (segments.length > 1 && last !== "master" && (/^\d+$/.test(last) || last === "new" || last === "edit" || segments.includes("edit"))) {
    return <DetailPageSkeleton />;
  }
  return <ListPageSkeleton />;
}
