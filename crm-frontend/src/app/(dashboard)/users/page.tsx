"use client";

import { isAdmin } from "@/lib/permissions";
import { apiFetch } from "@/lib/api-fetch";

import { useEffect, useState, Suspense } from "react";
import { DataTable } from "@/components/tables/data-table";
import { ModuleViews, useModuleView, type ViewField } from "@/components/views/module-views";
import { ActiveCell, IdCell, NameCell, statusDot } from "@/components/tables/cells";
import { Checkbox } from "@/components/ui/checkbox";
import { ColumnDef } from "@tanstack/react-table";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { UserForm } from "./_components/UserForm";
import { useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { TableSkeleton } from "@/components/tables/table-skeleton";
import { PageActions } from "@/components/layout/page-actions";
import { ListBody, ListFrame, ListToolbar, ToolbarEnd, ToolbarSearch, headerPrimaryClass } from "@/components/layout/list-page";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "/api/v1";

function UsersList() {
  const router = useRouter();
  const views = useModuleView("users", USER_FIELDS);
  const searchParams = useSearchParams();
  const deptFilter = searchParams.get("dept");

  const [users, setUsers] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [deleteId, setDeleteId] = useState<number | null>(null);

  const [role, setRole] = useState<string>("");
  const [bulkDeleteIds, setBulkDeleteIds] = useState<number[] | null>(null);
  const [isDeletingBulk, setIsDeletingBulk] = useState(false);
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    if (typeof window !== "undefined") {
      try {
        const user = JSON.parse(localStorage.getItem("crm_user") || "{}");
        setRole(user?.role?.name || user?.role || "");
      } catch {}
    }
  }, []);

  const fetchUsers = async () => {
    try {
      setIsLoading(true);
      const res = await apiFetch(API_URL + "/users");
      const data = await res.json();
      if (data.success) {
        setUsers(data.data);
      }
    } catch {
      toast.error("Failed to load users");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  const displayedUsers = deptFilter 
    ? users.filter(u => u.department?.name === deptFilter)
    : users;
  const [search, setSearch] = useState("");
  const q = search.trim().toLowerCase();
  const searchedUsers = q
    ? displayedUsers.filter((u: { name?: string; email?: string }) => u.name?.toLowerCase().includes(q) || u.email?.toLowerCase().includes(q))
    : displayedUsers;

  const handleDelete = async () => {
    if (!deleteId) return;
    try {
      const res = await apiFetch(`${API_URL}/users/${deleteId}`, { method: "DELETE" });
      if (res.ok) {
        toast.success("User deleted successfully");
        fetchUsers();
      } else {
        toast.error("Failed to delete user");
      }
    } catch {
      toast.error("Failed to delete user");
    } finally {
      setDeleteId(null);
    }
  };

  const handleBulkDelete = async () => {
    if (!bulkDeleteIds || bulkDeleteIds.length === 0) return;
    setIsDeletingBulk(true);
    try {
      const promises = bulkDeleteIds.map(id => apiFetch(`${API_URL}/users/${id}`, { method: "DELETE" }));
      await Promise.all(promises);
      toast.success(`${bulkDeleteIds.length} user(s) deleted successfully`);
      fetchUsers();
    } catch {
      toast.error("Failed to delete some or all users");
    } finally {
      setIsDeletingBulk(false);
      setBulkDeleteIds(null);
    }
  };

  const columns: ColumnDef<any>[] = [
    {
      id: "select",
      header: ({ table }) => (
        <div className="flex items-center justify-center">
          <Checkbox
            checked={table.getIsAllPageRowsSelected()}
            onCheckedChange={(value) => table.toggleAllPageRowsSelected(!!value)}
            aria-label="Select all"
            className="data-[state=checked]:bg-[#0052FF] data-[state=checked]:border-[#0052FF]"
          />
        </div>
      ),
      cell: ({ row }) => (
        <div className="flex items-center justify-center" onClick={(e) => e.stopPropagation()}>
          <Checkbox
            checked={row.getIsSelected()}
            onCheckedChange={(value) => row.toggleSelected(!!value)}
            aria-label="Select row"
            className="data-[state=checked]:bg-[#0052FF] data-[state=checked]:border-[#0052FF]"
          />
        </div>
      ),
      enableSorting: false,
      enableHiding: false,
    },
    { accessorKey: "id", header: "ID", cell: ({ row }) => <IdCell href={`/users/${row.original.id}`}>{row.original.id}</IdCell> },
    { accessorKey: "name", header: "Name", cell: ({ row }) => <NameCell name={row.original.name} image={row.original.avatar_url} staffId={row.original.id} avatar /> },
    { accessorKey: "email", header: "Email", cell: ({ row }) => <span className="text-muted-foreground">{row.original.email}</span> },
    { accessorKey: "phone", header: "Phone", cell: ({ row }) => <span className="tabular-nums text-muted-foreground">{row.original.phone || "—"}</span> },
    { 
      accessorKey: "role", 
      header: "Role",
      cell: ({ row }) => (
        <span>{row.original.role?.name || "No Role"}</span>
      )
    },
    { 
      accessorKey: "department", 
      header: "Department",
      cell: ({ row }) => row.original.department?.name || "—"
    },
    { 
      accessorKey: "is_active", 
      header: "Status",
      cell: ({ row }) => (
        <ActiveCell active={row.original.is_active} />
      )
    }
  ];

  return (
    <div className="flex flex-col md:h-full">
      {views.switcher}
      <PageActions>
        <button type="button" onClick={() => setCreating(true)} className={headerPrimaryClass}>
          <Plus className="size-4" />
          Add User
        </button>
      </PageActions>

      <ListFrame>
        <ListToolbar>
          {deptFilter && <span className="text-[14px] font-medium">{deptFilter} users</span>}
          <ToolbarEnd>
            {views.picker}
            <ToolbarSearch value={search} onChange={setSearch} placeholder="Search name or email" />
          </ToolbarEnd>
        </ListToolbar>
        <ListBody>
          {isLoading ? <TableSkeleton columns={7} rows={10} flush /> : (
            <ModuleViews
              state={views}
              data={searchedUsers}
              columns={columns}
              list={
                <DataTable
                variant="list"
                columns={columns}
                data={searchedUsers}
                showToolbar={true}
                showDeleteAction={isAdmin({ role })}
                onDeleteSelected={(rows) => setBulkDeleteIds(rows.map(r => r.id))}
                onRowClick={(u) => router.push(`/users/${u.id}`)}
              />
              }
              getKey={(u) => u.id}
              onOpen={(u) => router.push(`/users/${u.id}`)}
              card={(u) => ({ title: u.name, image: u.avatar_url, id: u.id, href: `/users/${u.id}`, subtitle: u.email, footer: u.department?.name, tag: u.role?.name })}
              noun="users"
            />
          )}
        </ListBody>
      </ListFrame>

      <Dialog open={deleteId !== null || bulkDeleteIds !== null} onOpenChange={(open) => {
        if (!open) {
          setDeleteId(null);
          setBulkDeleteIds(null);
        }
      }}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Deactivate User(s)</DialogTitle>
            <DialogDescription>Are you sure you want to deactivate {bulkDeleteIds ? `${bulkDeleteIds.length} user(s)` : 'this user'}? They will lose access to the system.</DialogDescription>
          </DialogHeader>
          <DialogFooter className="mt-4">
            <Button variant="outline" onClick={() => { setDeleteId(null); setBulkDeleteIds(null); }} disabled={isDeletingBulk}>Cancel</Button>
            <Button variant="destructive" onClick={bulkDeleteIds ? handleBulkDelete : handleDelete} disabled={isDeletingBulk}>
              {isDeletingBulk ? "Processing..." : "Deactivate"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {creating && <UserForm onClose={() => setCreating(false)} onCreated={(id) => router.push(`/users/${id}`)} />}
    </div>
  );
}

const USER_FIELDS: ViewField[] = [
  { id: "role", label: "Role", get: (u) => u.role?.name || "No Role" },
  { id: "department", label: "Department", get: (u) => u.department?.name },
  { id: "status", label: "Status", get: (u) => (u.is_active ? "Active" : "Inactive"), order: ["Active", "Inactive"], dot: (v) => statusDot(v) },
];

export default function UsersPage() {
  return (
    <Suspense fallback={<TableSkeleton />}>
      <UsersList />
    </Suspense>
  );
}
