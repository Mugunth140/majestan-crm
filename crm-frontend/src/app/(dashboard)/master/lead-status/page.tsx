"use client";

import { useState } from "react";
import { DataTable } from "@/components/tables/data-table";
import { ColumnDef } from "@tanstack/react-table";
import { Badge } from "@/components/ui/badge";
import { MoreHorizontal, Edit, Trash2, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";

const dummyStatuses = [
  { id: 1, name: "INCOMING", color: "#9CA3AF", isActive: true },
  { id: 2, name: "REJECT", color: "#F59E0B", isActive: true },
  { id: 3, name: "OPPORTUNITY", color: "#FCD34D", isActive: true },
  { id: 4, name: "SITE VISIT DONE", color: "#93C5FD", isActive: true },
  { id: 5, name: "RSV DONE", color: "#818CF8", isActive: true },
];

const columns: ColumnDef<any>[] = [
  { accessorKey: "id", header: "ID" },
  { accessorKey: "name", header: "Status Name" },
  {
    accessorKey: "color",
    header: "Badge Color",
    cell: ({ row }) => {
      const color = row.original.color;
      return (
        <div className="flex items-center justify-center gap-2">
          <div className="w-4 h-4 rounded-full border shadow-sm shrink-0" style={{ backgroundColor: color }} />
          <span className="text-muted-foreground uppercase text-xs">{color}</span>
        </div>
      );
    }
  },
  {
    accessorKey: "isActive",
    header: "Active Status",
    cell: ({ row }) => (
      <Badge variant={row.original.isActive ? "default" : "secondary"} className="bg-emerald-100 text-emerald-800 hover:bg-emerald-200 border-none shadow-none">
        {row.original.isActive ? "Active" : "Inactive"}
      </Badge>
    )
  },
  {
    id: "actions",
    header: "Action",
    cell: ({ row }) => (
      <div className="flex items-center justify-center gap-2">
        <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-[#0052FF] hover:bg-blue-50"><Edit size={16} /></Button>
        <Button variant="ghost" size="icon" className="h-8 w-8 text-red-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950"><Trash2 size={16} /></Button>
      </div>
    )
  }
];

export default function LeadStatusMasterPage() {
  return (
    <div className="flex flex-col space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold tracking-tight">Master: Lead Statuses</h1>
        <Button className="bg-[#0052FF] text-white">
          <Plus className="mr-2 h-4 w-4" /> Add Status
        </Button>
      </div>

      <div className="bg-card border rounded-xl overflow-hidden shadow-sm p-6">
        <DataTable columns={columns} data={dummyStatuses} />
      </div>
    </div>
  );
}
