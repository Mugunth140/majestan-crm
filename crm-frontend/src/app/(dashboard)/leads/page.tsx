"use client";

import { useState } from "react";
import { DataTable } from "@/components/tables/data-table";
import { ColumnDef } from "@tanstack/react-table";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { MoreHorizontal, Edit, Trash2, Plus, FileSpreadsheet } from "lucide-react";
import { Button } from "@/components/ui/button";

// Dummy Data exactly like the image
const dummyData = [
  { sno: 1, id: "L10001", date: "17 Dec 2024", name: "Esther Kiehn", mobile: "9994661767", propertyType: "Apartment", staff: "John Doe", source: "Website", status: "NEW", notes: "Looking for 3BHK" },
  { sno: 2, id: "L10002", date: "16 Dec 2024", name: "Denise Kuhn", mobile: "9876543210", propertyType: "Villa", staff: "Jane Smith", source: "Facebook", status: "SITE VISIT DONE", notes: "Budget 1Cr" },
  { sno: 3, id: "L10003", date: "16 Dec 2024", name: "Clint Hoppe", mobile: "9123456780", propertyType: "Commercial", staff: "Mike Ross", source: "Referral", status: "BOOKED", notes: "Closed deal" },
  { sno: 4, id: "L10004", date: "15 Dec 2024", name: "Jacquelyn Robel", mobile: "9988776655", propertyType: "Plot", staff: "John Doe", source: "Direct Walk-in", status: "OPPORTUNITY", notes: "Wants corner plot" },
];

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
      <div className="flex items-center justify-center">
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
  { accessorKey: "sno", header: "#" },
  { accessorKey: "id", header: "Id" },
  { accessorKey: "date", header: "Date" },
  {
    accessorKey: "name",
    header: "Name",
    cell: ({ row }) => (
      <div className="flex items-center gap-3">
        <div className="h-7 w-7 rounded-full bg-blue-100 flex items-center justify-center font-bold text-xs text-blue-900">
          {row.original.name.charAt(0)}
        </div>
        <span className="font-medium text-foreground">{row.original.name}</span>
      </div>
    )
  },
  { accessorKey: "mobile", header: "Mobile Number" },
  { accessorKey: "propertyType", header: "Property Type" },
  { accessorKey: "staff", header: "Staff" },
  { accessorKey: "source", header: "Lead Source" },
  {
    accessorKey: "status",
    header: "Status",
    cell: ({ row }) => {
      const s = row.original.status;
      let badgeClass = "bg-yellow-100 text-yellow-800 hover:bg-yellow-200 border-yellow-200";
      if (s === "BOOKED") badgeClass = "bg-emerald-100 text-emerald-800 hover:bg-emerald-200 border-emerald-200";
      if (s === "NEW") badgeClass = "bg-gray-100 text-gray-800 hover:bg-gray-200 border-gray-200";
      if (s === "SITE VISIT DONE") badgeClass = "bg-blue-100 text-blue-800 hover:bg-blue-200 border-blue-200";

      return (
        <Badge className={"font-medium shadow-sm " + badgeClass}>
          {s}
        </Badge>
      );
    }
  },
  { accessorKey: "notes", header: "Notes" },
  {
    id: "actions",
    header: "Action",
    cell: ({ row }) => (
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground"><Edit size={16} /></Button>
        <Button variant="ghost" size="icon" className="h-8 w-8 text-red-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950"><Trash2 size={16} /></Button>
        <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground"><MoreHorizontal size={16} /></Button>
      </div>
    )
  }
];

export default function LeadsPage() {
  const [activeTab, setActiveTab] = useState("All Leads");
  const [actionFilter, setActionFilter] = useState("Today");
  
  const tabs = ["All Leads", "Open Pipeline", "Action Required"];
  const actionFilters = ["Overdue", "Today", "Tomorrow", "All Scheduled"];

  return (
    <div className="flex flex-col space-y-6">
      {/* 
        We add pr-[150px] to ensure these buttons perfectly align 
        beside the global absolute Topbar pill without overlapping! 
        h-[48px] ensures pixel-perfect vertical alignment with the Topbar.
      */}
      <div className="flex h-[48px] items-center justify-between pr-[150px]">
        <h1 className="text-[28px] font-bold tracking-tight">Leads Dashboard</h1>
        
        {/* Distinct Action Buttons */}
        <div className="flex items-center gap-3">
          <Button 
            variant="outline" 
            className="h-10 rounded-full bg-card px-5 text-[14px] font-medium shadow-sm border-border/60 hover:bg-muted/50 flex items-center gap-2"
          >
            <FileSpreadsheet size={16} className="text-muted-foreground" />
            Bulk Import (Excel)
          </Button>
          <Button 
            className="h-10 rounded-full bg-[#0052FF] px-5 text-[14px] font-medium text-white shadow-md hover:bg-[#0052FF]/90 flex items-center gap-2"
          >
            <Plus size={18} />
            Add New Lead
          </Button>
        </div>
      </div>

      <div className="bg-card border rounded-xl overflow-hidden shadow-sm">
        {/* Top Tabs */}
        <div className="flex items-center gap-8 px-6 border-b bg-muted/20 pt-4 overflow-x-auto scrollbar-hide">
          {tabs.map(tab => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={
                "pb-4 text-[15px] whitespace-nowrap font-semibold transition-all border-b-[3px] " +
                (activeTab === tab 
                  ? "border-primary text-primary" 
                  : "border-transparent text-muted-foreground hover:text-foreground")
              }
            >
              {tab}
            </button>
          ))}
        </div>

        {/* Secondary Filters for "Action Required" */}
        {activeTab === "Action Required" && (
          <div className="flex items-center gap-2 px-6 pt-5 animate-in slide-in-from-top-2 fade-in duration-200">
            {actionFilters.map(filter => {
              const isActive = actionFilter === filter;
              let activeClass = "bg-primary/10 text-primary border-primary/30";
              
              if (filter === "Overdue" && isActive) {
                activeClass = "bg-red-50 text-red-600 border-red-200 dark:bg-red-950 dark:text-red-400";
              } else if (filter === "Today" && isActive) {
                activeClass = "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950 dark:text-amber-400";
              }

              return (
                <button
                  key={filter}
                  className={
                    "flex items-center justify-center cursor-pointer px-5 py-2 rounded-full text-[13.5px] font-medium transition-colors border " +
                    (isActive 
                      ? activeClass 
                      : "bg-transparent text-muted-foreground border-border/60 hover:bg-muted hover:text-foreground")
                  }
                  onClick={() => setActionFilter(filter)}
                >
                  {filter}
                </button>
              );
            })}
          </div>
        )}

        {/* Excel-like Data Table */}
        <div className="p-6">
          <DataTable columns={columns} data={dummyData} showToolbar={true} />
        </div>
      </div>
    </div>
  );
}
