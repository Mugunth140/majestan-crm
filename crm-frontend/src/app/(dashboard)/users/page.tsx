"use client";

import { apiFetch } from "@/lib/api-fetch";

import { useEffect, useState, Suspense } from "react";
import { DataTable } from "@/components/tables/data-table";
import { Checkbox } from "@/components/ui/checkbox";
import { ColumnDef } from "@tanstack/react-table";
import { Badge } from "@/components/ui/badge";
import { Edit, Trash2, Plus, ShieldAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { TableSkeleton } from "@/components/tables/table-skeleton";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api/v1";

function UsersList() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const deptFilter = searchParams.get("dept");

  const [users, setUsers] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [deleteId, setDeleteId] = useState<number | null>(null);

  const [role, setRole] = useState<string>("");
  const [bulkDeleteIds, setBulkDeleteIds] = useState<number[] | null>(null);
  const [isDeletingBulk, setIsDeletingBulk] = useState(false);

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
    { accessorKey: "id", header: "ID" },
    { accessorKey: "name", header: "Name" },
    { accessorKey: "email", header: "Email" },
    { 
      accessorKey: "role", 
      header: "Role",
      cell: ({ row }) => (
        <Badge variant="outline" className="font-medium bg-muted/30">
          {row.original.role?.name || "No Role"}
        </Badge>
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
        <Badge variant="secondary" className={row.original.is_active ? "bg-emerald-50 text-emerald-600 border-emerald-200" : "bg-red-50 text-red-600 border-red-200"}>
          {row.original.is_active ? "Active" : "Inactive"}
        </Badge>
      )
    }
  ];

  return (
    <div className="flex flex-col space-y-6">
      <div className="flex h-[48px] items-center justify-between pr-[150px]">
        <div>
          <h1 className="text-[28px] font-bold tracking-tight">
            {deptFilter ? `${deptFilter} Users` : "Users Management"}
          </h1>
          <p className="text-muted-foreground text-sm mt-1 flex items-center gap-2">
            <ShieldAlert className="h-4 w-4" /> Only Administrators can view and manage this section.
          </p>
        </div>

        <Button onClick={() => router.push("/users/new")} className="bg-[#0052FF] text-white hover:bg-[#0040CC] shadow-md h-10 p-5 rounded-full font-semibold gap-2">
          <Plus size={16} />
          Add User
        </Button>
      </div>

      <div className="bg-card border rounded-xl overflow-hidden shadow-sm p-6">
        {isLoading ? <TableSkeleton /> : (
          <DataTable 
            columns={columns} 
            data={displayedUsers} 
            showToolbar={true} 
            showDeleteAction={role === "Admin"}
            onDeleteSelected={(rows) => setBulkDeleteIds(rows.map(r => r.id))}
            renderToolbarActions={(selectedRows) => {
              if (selectedRows.length !== 1) return null;
              const row = selectedRows[0];
              return (
                <Button variant="outline" size="sm" onClick={() => router.push("/users/new?edit=" + row.id)}>
                  <Edit size={15} className="mr-1.5" /> Edit
                </Button>
              );
            }}
          />
        )}
      </div>

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
    </div>
  );
}

export default function UsersPage() {
  return (
    <Suspense fallback={<TableSkeleton />}>
      <UsersList />
    </Suspense>
  );
}
