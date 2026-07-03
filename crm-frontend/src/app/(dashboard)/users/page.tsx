"use client";

import { useEffect, useState, Suspense } from "react";
import { DataTable } from "@/components/tables/data-table";
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

  const fetchUsers = async () => {
    try {
      setIsLoading(true);
      const res = await fetch(API_URL + "/users");
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
      const res = await fetch(API_URL + "/users/" + deleteId, { method: "DELETE" });
      if (res.ok) {
        toast.success("User deactivated successfully");
        fetchUsers();
      } else {
        toast.error("Failed to deactivate user");
      }
    } catch {
      toast.error("Failed to deactivate user");
    } finally {
      setDeleteId(null);
    }
  };

  const columns: ColumnDef<any>[] = [
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
    },
    {
      id: "actions",
      header: "Actions",
      cell: ({ row }) => (
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="icon" onClick={() => router.push("/users/new?edit=" + row.original.id)} className="h-8 w-8 hover:text-[#0052FF]">
            <Edit className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="icon" onClick={() => setDeleteId(row.original.id)} className="h-8 w-8 hover:text-red-500 hover:bg-red-50">
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
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
        {isLoading ? <TableSkeleton /> : <DataTable columns={columns} data={displayedUsers} />}
      </div>

      <Dialog open={deleteId !== null} onOpenChange={(open) => !open && setDeleteId(null)}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Deactivate User</DialogTitle>
            <DialogDescription>Are you sure you want to deactivate this user? They will lose access to the system.</DialogDescription>
          </DialogHeader>
          <DialogFooter className="mt-4">
            <Button variant="outline" onClick={() => setDeleteId(null)}>Cancel</Button>
            <Button variant="destructive" onClick={handleDelete}>Deactivate</Button>
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
