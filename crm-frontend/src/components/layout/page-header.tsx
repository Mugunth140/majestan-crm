"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Fragment, useEffect } from "react";
import { NAVIGATION } from "./nav-items";
import { useMobileHeader } from "./mobile-header-context";
import { PageActionsSlot, PageCrumbSlot, usePageSlots } from "./page-actions";

// href → sidebar name, so crumbs match the sidebar.
const LABELS = new Map<string, string>();
for (const item of NAVIGATION) {
  if (item.href) LABELS.set(item.href, item.name);
  if (item.subItems) {
    LABELS.set("/master", item.name);
    for (const sub of item.subItems) LABELS.set(sub.href, sub.name);
  }
}

const SEGMENT_LABELS: Record<string, string> = { new: "New", edit: "Edit" };
const looksLikeId = (s: string) => /^\d+$/.test(s) || /^[0-9a-f-]{16,}$/i.test(s);
const titleCase = (s: string) =>
  s
    .split("-")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");

// Top row of every page: Frappe-style breadcrumbs on the left, the page's actions on the right.
export function PageHeader() {
  const pathname = usePathname() ?? "/";
  // Detail pages publish the record's name (e.g. the lead's) through <MobileHeader title>.
  const { title: pageTitle } = useMobileHeader();
  // A page crumb (e.g. the view switcher) follows; the route crumb then reads as a parent.
  const { hasCrumb } = usePageSlots();
  const segments = pathname.split("/").filter(Boolean);

  const crumbs = (segments.length ? segments : [""]).map((seg, i) => {
    const href = "/" + segments.slice(0, i + 1).join("/");
    const last = i === segments.length - 1;
    let label = LABELS.get(href) ?? SEGMENT_LABELS[seg];
    if (!label && looksLikeId(seg)) label = (last && pageTitle) || "…";
    return { href, label: label ?? titleCase(decodeURIComponent(seg)) };
  });

  // Browser tab reads just the page, e.g. "Leads", or "Asha Raman" on a record.
  const pageName = crumbs[crumbs.length - 1]?.label;
  useEffect(() => {
    if (!pageName || pageName === "…") return;
    document.title = pageName;
  }, [pageName, pathname]);

  return (
    <header className="hidden h-12 shrink-0 items-center gap-4 border-b bg-background px-5 md:flex">
      <nav aria-label="Breadcrumb" className="flex min-w-0 flex-1 items-center">
        {crumbs.map((crumb, i) => {
          const last = i === crumbs.length - 1 && !hasCrumb;
          return (
            <Fragment key={crumb.href}>
              {i > 0 && (
                <span aria-hidden className="mx-1 text-[15px] text-muted-foreground/50">
                  /
                </span>
              )}
              {last ? (
                <span aria-current="page" className="truncate px-0.5 py-1 text-[16px] font-medium text-foreground">
                  {crumb.label}
                </span>
              ) : (
                <Link
                  href={crumb.href}
                  className="truncate rounded px-0.5 py-1 text-[16px] font-medium text-muted-foreground outline-none transition-colors hover:text-foreground focus-visible:ring-2 focus-visible:ring-[#017D58]/40"
                >
                  {crumb.label}
                </Link>
              )}
            </Fragment>
          );
        })}
        <PageCrumbSlot className="contents" />
      </nav>
      <PageActionsSlot className="flex shrink-0 items-center gap-2" />
    </header>
  );
}
