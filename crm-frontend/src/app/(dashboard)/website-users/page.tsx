"use client";

import { apiFetch } from "@/lib/api-fetch";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import type { ColumnDef } from "@tanstack/react-table";
import { BadgeCheck, Heart, MessageSquareText } from "lucide-react";
import { MobileHeader } from "@/components/layout/mobile-header";
import { ListBody, ListFrame, ListToolbar, SegmentTabs, ToolbarEnd, ToolbarSearch } from "@/components/layout/list-page";
import { DataTable } from "@/components/tables/data-table";
import { TableSkeleton } from "@/components/tables/table-skeleton";
import { DateCell, NameCell, StatusCell } from "@/components/tables/cells";
import { EmptyState } from "@/components/shared/empty-state";
import { leadStatusPill } from "@/lib/lead-constants";
import { matchesWebsiteUser, type WebsiteUser, type WebsiteUserSummary } from "@/lib/website-users";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "/api/v1";

type View = "all" | "leads" | "none";

function LeadCell({ user }: { user: WebsiteUser }) {
  if (!user.lead) return <span className="text-[13px] text-amber-700 dark:text-amber-400">Not a lead yet</span>;
  return (
    <span className="inline-flex items-center gap-2 whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
      <Link href={`/leads/${user.lead.id}`} className="tabular-nums text-muted-foreground hover:text-foreground hover:underline">{user.lead.displayId}</Link>
      <StatusCell status={user.lead.status} pillClass={leadStatusPill(user.lead.status)} />
    </span>
  );
}

const count = (n: number) => <span className={n ? "tabular-nums" : "tabular-nums text-muted-foreground"}>{n}</span>;

const columns: ColumnDef<WebsiteUser>[] = [
  {
    id: "name",
    header: "Name",
    accessorFn: (u) => u.name ?? "",
    cell: ({ row }) => <NameCell name={row.original.name || "No name"} sub={row.original.email ?? undefined} avatar className="max-w-[280px]" />,
  },
  {
    id: "phone",
    header: "Mobile",
    accessorFn: (u) => u.phone ?? "",
    cell: ({ row }) => <span className="whitespace-nowrap tabular-nums">{row.original.phone || "—"}</span>,
  },
  {
    id: "registeredAt",
    header: "Registered on",
    accessorFn: (u) => u.registeredAt,
    cell: ({ row }) => <DateCell value={row.original.registeredAt} withTime />,
  },
  {
    id: "lead",
    header: "CRM lead",
    accessorFn: (u) => u.lead?.id ?? 0,
    cell: ({ row }) => <LeadCell user={row.original} />,
  },
  {
    id: "staff",
    header: "Lead owner",
    accessorFn: (u) => u.lead?.staff ?? "",
    cell: ({ row }) => row.original.lead ? <span className="whitespace-nowrap">{row.original.lead.staff || <span className="text-muted-foreground">Unassigned</span>}</span> : <span className="text-muted-foreground">—</span>,
  },
  { id: "enquiries", header: "Enquiries", accessorFn: (u) => u.enquiryCount, cell: ({ row }) => count(row.original.enquiryCount) },
  {
    id: "lastEnquiryAt",
    header: "Last enquiry",
    accessorFn: (u) => u.lastEnquiryAt ?? "",
    cell: ({ row }) => <DateCell value={row.original.lastEnquiryAt} />,
  },
  { id: "wishlist", header: "Wishlist", accessorFn: (u) => u.wishlistCount, cell: ({ row }) => count(row.original.wishlistCount) },
  {
    id: "verified",
    header: "Verified",
    meta: { defaultHidden: true },
    accessorFn: (u) => (u.verified ? 1 : 0),
    cell: ({ row }) => row.original.verified ? <span>Yes</span> : <span className="text-muted-foreground">No</span>,
  },
];

function UserCard({ user, onOpen }: { user: WebsiteUser; onOpen: () => void }) {
  return (
    <button type="button" onClick={onOpen} className="block w-full rounded-xl border bg-card p-3.5 text-left">
      <div className="flex items-start justify-between gap-3">
        <NameCell name={user.name || "No name"} sub={user.phone ?? undefined} avatar className="min-w-0" />
        <span className="shrink-0"><DateCell value={user.registeredAt} /></span>
      </div>
      <div className="mt-2.5 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-[13px] text-muted-foreground">
        <LeadCell user={user} />
        <span className="inline-flex items-center gap-1"><MessageSquareText className="size-3.5" />{user.enquiryCount}</span>
        <span className="inline-flex items-center gap-1"><Heart className="size-3.5" />{user.wishlistCount}</span>
        {user.verified && <span className="inline-flex items-center gap-1"><BadgeCheck className="size-3.5" />Verified</span>}
      </div>
    </button>
  );
}

export default function WebsiteUsersPage() {
  const router = useRouter();
  const [users, setUsers] = useState<WebsiteUser[]>([]);
  const [summary, setSummary] = useState<WebsiteUserSummary | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isAllowed, setIsAllowed] = useState(true);
  const [failed, setFailed] = useState(false);
  const [view, setView] = useState<View>("all");
  const [search, setSearch] = useState("");

  useEffect(() => {
    let live = true;
    apiFetch(`${API_URL}/website-users?limit=1000`)
      .then(async (r) => {
        if (!live) return;
        if (r.status === 403) return setIsAllowed(false);
        const d = await r.json();
        if (!d.success) throw new Error(d.message);
        setUsers(d.data);
        setSummary(d.summary);
      })
      .catch(() => { if (live) setFailed(true); })
      .finally(() => { if (live) setIsLoading(false); });
    return () => { live = false; };
  }, []);

  const shown = useMemo(() => users.filter((u) =>
    (view === "all" || (view === "leads" ? !!u.lead : !u.lead)) && matchesWebsiteUser(u, search),
  ), [users, view, search]);

  const open = (u: WebsiteUser) => { if (u.lead) router.push(`/leads/${u.lead.id}`); };

  if (!isAllowed) {
    return (
      <>
        <MobileHeader title="Website Users" />
        <EmptyState kind="records" className="py-24" title="No access to Website Users" description="Ask an admin to turn on Website Users on your Access tab." />
      </>
    );
  }

  const leads = summary?.leads ?? users.filter((u) => u.lead).length;
  const none = summary?.notLeads ?? users.filter((u) => !u.lead).length;
  const tabs = [
    { value: "all" as const, label: <>All <span className="tabular-nums text-muted-foreground">{summary?.total ?? users.length}</span></> },
    { value: "leads" as const, label: <>Already leads <span className="tabular-nums text-muted-foreground">{leads}</span></> },
    { value: "none" as const, label: <>Not a lead yet <span className="tabular-nums text-muted-foreground">{none}</span></> },
  ];
  const empty = failed
    ? <EmptyState kind="records" className="py-16" title="Couldn't load website users" description="The website database didn't answer. Refresh to try again." />
    : users.length === 0
      ? <EmptyState kind="records" className="py-16" title="No one has registered yet" description="People who sign up on the website with their mobile number show up here." />
      : <EmptyState kind="records" className="py-16" title="No website users match" description="Try another search or view." />;

  return (
    <div className="flex flex-col md:h-full">
      <MobileHeader title="Website Users" />
      <ListFrame>
        <ListToolbar>
          <SegmentTabs tabs={tabs} value={view} onChange={setView} label="Lead link" />
          {summary && summary.thisMonth > 0 && (
            <span className="hidden text-[13px] text-muted-foreground lg:inline"><span className="tabular-nums">{summary.thisMonth}</span> joined this month</span>
          )}
          <ToolbarEnd>
            <ToolbarSearch value={search} onChange={setSearch} placeholder="Search name, mobile, email or lead ID" className="w-full md:w-auto" />
          </ToolbarEnd>
        </ListToolbar>
        <ListBody>
          {isLoading ? <TableSkeleton columns={8} rows={8} flush /> : (
            <>
              <div className="space-y-3 px-4 pb-24 pt-1 md:hidden">
                {shown.length ? shown.map((u) => <UserCard key={u.id} user={u} onOpen={() => open(u)} />) : empty}
              </div>
              <div className="hidden min-h-0 flex-1 flex-col md:flex">
                <DataTable variant="list" columns={columns} data={shown} onRowClick={open} emptyState={empty} />
              </div>
            </>
          )}
        </ListBody>
      </ListFrame>
    </div>
  );
}
