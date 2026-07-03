"use client";

import { useState, useEffect, useCallback } from "react";
import { DataTable } from "@/components/tables/data-table";
import { ColumnDef } from "@tanstack/react-table";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Edit, Trash2, Plus, FileSpreadsheet, UploadCloud, RefreshCw, Eye } from "lucide-react";
import { motion } from "motion/react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import * as XLSX from "xlsx";
import { toast } from "sonner";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { TableSkeleton } from "@/components/tables/table-skeleton";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api/v1";

const STATUS_STYLES: Record<string, string> = {
  "INCOMING":        "bg-gray-100 text-gray-800 border-gray-200 dark:bg-gray-900 dark:text-gray-300",
  "NEW":             "bg-gray-100 text-gray-800 border-gray-200 dark:bg-gray-900 dark:text-gray-300",
  "OPPORTUNITY":     "bg-yellow-100 text-yellow-800 border-yellow-200 dark:bg-yellow-900/30 dark:text-yellow-400",
  "SITE VISIT DONE": "bg-blue-100 text-blue-800 border-blue-200 dark:bg-blue-900/30 dark:text-blue-400",
  "RSV DONE":        "bg-indigo-100 text-indigo-800 border-indigo-200 dark:bg-indigo-900/30 dark:text-indigo-400",
  "RSV SCHEDULE":    "bg-amber-100 text-amber-800 border-amber-200 dark:bg-amber-900/30 dark:text-amber-400",
  "PROSPECTIVE":     "bg-lime-100 text-lime-800 border-lime-200 dark:bg-lime-900/30 dark:text-lime-400",
  "DROPPED":         "bg-red-100 text-red-800 border-red-200 dark:bg-red-900/30 dark:text-red-400",
  "BOOKED":          "bg-emerald-100 text-emerald-800 border-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-400",
  "SV SCHEDULE":     "bg-purple-100 text-purple-800 border-purple-200 dark:bg-purple-900/30 dark:text-purple-400",
  "REJECT":          "bg-orange-100 text-orange-800 border-orange-200 dark:bg-orange-900/30 dark:text-orange-400",
};

export default function LeadsPage() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState("All Leads");
  const [actionFilter, setActionFilter] = useState("Today");
  const [leads, setLeads] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isImportOpen, setIsImportOpen] = useState(false);
  const [deleteId, setDeleteId] = useState<number | null>(null);
  
  const [isImporting, setIsImporting] = useState(false);
  const [importProgress, setImportProgress] = useState(0);
  const [pendingImports, setPendingImports] = useState<any[]>([]);
  const [isInserting, setIsInserting] = useState(false);

  const [todayViewMode, setTodayViewMode] = useState<"pending" | "completed">("pending");

  const tabs = ["All Leads", "Open Pipeline", "Action Required"];
  const actionFilters = ["Overdue", "Today", "Tomorrow", "All Scheduled"];

  const fetchLeads = useCallback(async () => {
    try {
      setIsLoading(true);
      const res = await fetch(API_URL + "/leads");
      const data = await res.json();
      if (data.success) setLeads(data.data);
    } catch {
      toast.error("Failed to load leads.");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchLeads();
  }, [fetchLeads]);

  const displayedLeads = () => {
    if (activeTab === "Open Pipeline") {
      return pendingImports;
    }

    if (activeTab === "Action Required") {
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const tomorrow = new Date(today);
      tomorrow.setDate(tomorrow.getDate() + 1);

      return leads.filter(lead => {
        const hasNext = !!lead.nextFollowUpDate;
        const fDate = lead.nextFollowUpDate ? new Date(lead.nextFollowUpDate) : null;
        if (fDate) fDate.setHours(0, 0, 0, 0);

        const hasLast = !!lead.lastFollowedUpDate;
        const lDate = lead.lastFollowedUpDate ? new Date(lead.lastFollowedUpDate) : null;
        if (lDate) lDate.setHours(0, 0, 0, 0);

        if (actionFilter === "Overdue") {
          return fDate && fDate < today;
        }
        if (actionFilter === "Today") {
          const isFollowedUpToday = lDate && lDate.getTime() === today.getTime();
          
          if (todayViewMode === "completed") {
            return isFollowedUpToday;
          } else {
            // pending
            return fDate && fDate.getTime() === today.getTime() && !isFollowedUpToday;
          }
        }
        if (actionFilter === "Tomorrow") {
          return fDate && fDate.getTime() === tomorrow.getTime();
        }
        if (actionFilter === "All Scheduled") {
          return fDate && fDate > tomorrow;
        }
        return false;
      });
    }

    // Default: All Leads
    return leads;
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    try {
      const res = await fetch(API_URL + "/leads/" + deleteId, { method: "DELETE" });
      if (res.ok) {
        toast.success("Lead deleted successfully");
        fetchLeads();
      } else {
        toast.error("Failed to delete lead");
      }
    } catch {
      toast.error("Failed to delete lead");
    } finally {
      setDeleteId(null);
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
    { accessorKey: "sno", header: "#" },
    {
      accessorKey: "id",
      header: "Id",
      cell: ({ row }) => (
        <Link href={`/leads/${row.original.rawId}`} className="text-[#0052FF] hover:underline font-medium">
          {row.getValue("id")}
        </Link>
      ),
    },
    { accessorKey: "date", header: "Date" },
    {
      accessorKey: "name",
      header: "Name",
      cell: ({ row }) => (
        <div className="flex items-center justify-center gap-2">
          <div className="h-7 w-7 rounded-full bg-blue-100 dark:bg-blue-900/40 flex items-center justify-center font-bold text-xs text-blue-900 dark:text-blue-300 shrink-0">
            {row.original.name.charAt(0).toUpperCase()}
          </div>
          <span className="font-medium text-foreground">{row.original.name}</span>
        </div>
      ),
    },
    { accessorKey: "mobile", header: "Mobile Number" },
    {
      accessorKey: "propertyType",
      header: "Property Type",
      cell: ({ row }) => (
        <span className="capitalize">{row.original.propertyType?.replace(/_/g, ' ')}</span>
      ),
    },
    { accessorKey: "staff", header: "Staff" },
    { accessorKey: "source", header: "Lead Source" },
    {
      accessorKey: "status",
      header: "Status",
      cell: ({ row }) => {
        const s = row.original.status as string;
        const cls = STATUS_STYLES[s] ?? "bg-gray-100 text-gray-800 border-gray-200";
        return <Badge className={"font-medium shadow-sm border whitespace-nowrap " + cls}>{s}</Badge>;
      },
    },
    {
      id: "actions",
      header: "Action",
      cell: ({ row }) => (
        row.original.isPendingImport ? (
          <Badge variant="outline" className="text-xs bg-amber-50 text-amber-600 border-amber-200">Pending</Badge>
        ) : (
          <div className="flex items-center justify-center gap-1" onClick={(e) => e.stopPropagation()}>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 text-muted-foreground hover:text-foreground"
              title="View Details"
              onClick={() => router.push("/leads/" + row.original.rawId)}
            >
              <Eye size={15} />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 text-muted-foreground hover:text-foreground"
              title="Edit"
              onClick={() => router.push("/leads/new?edit=" + row.original.rawId)}
            >
              <Edit size={15} />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 text-red-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950"
              title="Delete"
              onClick={() => setDeleteId(row.original.rawId)}
            >
              <Trash2 size={15} />
            </Button>
          </div>
        )
      ),
    },
  ];

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    setIsImporting(true);
    setImportProgress(0);
    
    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const bstr = evt.target?.result;
        const wb = XLSX.read(bstr, { type: "binary" });
        const wsname = wb.SheetNames[0];
        const ws = wb.Sheets[wsname];
        const data = XLSX.utils.sheet_to_json(ws) as any[];
        
        if (data.length > 0) {
          const total = data.length;
          let processed = 0;
          const chunkSize = Math.max(10, Math.floor(total / 20));
          const formattedData: any[] = [];
          
          const processChunk = () => {
             const nextChunk = Math.min(processed + chunkSize, total);
             
             for (let i = processed; i < nextChunk; i++) {
                const row = data[i];
                formattedData.push({
                    rawId: `import-${i}`,
                    id: `IMPORT-${i+1}`,
                    date: new Date().toLocaleDateString(),
                    name: row.Name || row.name || row["Customer Name"] || "Unknown",
                    mobile: row.Mobile || row.mobile || row["Mobile Number"] || "",
                    email: row.Email || row.email || "",
                    propertyType: row["Property Type"] || row.propertyType || "apartment",
                    staff: "Unassigned",
                    source: row.Source || row.source || "Bulk Import",
                    status: "NEW",
                    isPendingImport: true,
                    rawData: row
                });
             }
             
             processed = nextChunk;
             setImportProgress(Math.floor((processed / total) * 100));
             
             if (processed < total) {
                 setTimeout(processChunk, 20); // allow UI to update
             } else {
                 setPendingImports(formattedData);
                 setIsImporting(false);
                 setIsImportOpen(false);
                 setActiveTab("Open Pipeline");
                 toast.success(`${formattedData.length} leads parsed. Please review and insert.`);
             }
          };
          processChunk();
        } else {
          toast.error("The uploaded Excel file appears to be empty.");
          setIsImporting(false);
        }
      } catch {
        toast.error("Failed to parse Excel file.");
        setIsImporting(false);
      }
    };
    reader.readAsBinaryString(file);
  };

  const handleBulkInsert = async () => {
    try {
      setIsInserting(true);
      const payload = pendingImports.map(p => ({
         name: p.name,
         mobile: String(p.mobile),
         email: p.email,
         source: p.source,
         propertyType: p.propertyType,
      }));
      
      const res = await fetch(API_URL + "/leads/bulk", {
         method: "POST",
         headers: { "Content-Type": "application/json" },
         body: JSON.stringify({ leads: payload })
      });
      const data = await res.json();
      if (data.success) {
         toast.success(`Successfully inserted ${data.count} leads.`);
         setPendingImports([]);
         fetchLeads();
         setActiveTab("All Leads");
      } else {
         toast.error(data.message || "Bulk insert failed");
      }
    } catch(err) {
      toast.error("An error occurred during bulk insert.");
    } finally {
      setIsInserting(false);
    }
  };

  return (
    <div className="flex flex-col space-y-6">
      <div className="flex h-[48px] items-center justify-between pr-[150px]">
        <h1 className="text-[28px] font-bold tracking-tight">Leads Dashboard</h1>

        <div className="flex items-center gap-3">
          <Button variant="outline" size="icon" className="h-10 w-10 rounded-full border-border/60" onClick={fetchLeads} title="Refresh">
            <RefreshCw size={16} className={isLoading ? "animate-spin" : ""} />
          </Button>

          <Dialog open={isImportOpen} onOpenChange={setIsImportOpen}>
            <DialogTrigger className="inline-flex h-10 rounded-full bg-card px-5 text-[14px] font-medium shadow-sm border border-border/60 hover:bg-muted/50 items-center gap-2">
              <FileSpreadsheet size={16} className="text-muted-foreground" />
              Bulk Import (Excel)
            </DialogTrigger>
            <DialogContent className="sm:max-w-md">
              <DialogHeader>
                <DialogTitle>Import Leads</DialogTitle>
                <DialogDescription>Upload your Excel file to bulk import leads.</DialogDescription>
              </DialogHeader>
              <div className="flex flex-col items-center justify-center p-8 border-2 border-dashed rounded-xl bg-muted/20 border-border/60">
                {isImporting ? (
                  <div className="w-full space-y-4">
                    <div className="flex items-center justify-between text-sm font-medium">
                      <span>Processing...</span>
                      <span>{importProgress}%</span>
                    </div>
                    <div className="h-2 w-full bg-muted rounded-full overflow-hidden">
                      <div className="h-full bg-[#0052FF] transition-all duration-200" style={{ width: `${importProgress}%` }}></div>
                    </div>
                  </div>
                ) : (
                  <>
                    <UploadCloud className="h-10 w-10 text-muted-foreground mb-4" />
                    <p className="text-sm font-medium text-foreground mb-1">Click to upload or drag and drop</p>
                    <p className="text-xs text-muted-foreground mb-4">.xlsx, .xls, or .csv files</p>
                    <Input type="file" accept=".xlsx, .xls, .csv" className="max-w-[250px] cursor-pointer" onChange={handleFileUpload} />
                  </>
                )}
              </div>
            </DialogContent>
          </Dialog>

          <Link href="/leads/new" className="inline-flex h-10 rounded-full bg-[#0052FF] px-5 text-[14px] font-medium text-white shadow-md hover:bg-[#0052FF]/90 items-center gap-2 transition-transform active:scale-95">
            <Plus size={18} />
            Add New Lead
          </Link>
        </div>
      </div>

      <div className="bg-card border rounded-xl overflow-hidden shadow-sm">
        <div className="flex items-center gap-8 px-6 border-b bg-muted/10 pt-4 overflow-x-auto scrollbar-hide relative">
          {tabs.map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={"relative pb-4 text-[15px] whitespace-nowrap font-semibold transition-colors duration-200 ease-out " + (activeTab === tab ? "text-[#0052FF]" : "text-muted-foreground hover:text-foreground")}
            >
              {tab}
              {activeTab === tab && (
                <motion.div layoutId="activeTabUnderline" className="absolute bottom-0 left-0 right-0 h-[3px] bg-[#0052FF] rounded-t-full" initial={false} transition={{ type: "spring", stiffness: 500, damping: 30 }} />
              )}
            </button>
          ))}
        </div>

        {activeTab === "Action Required" && (
          <div className="flex items-center gap-2 px-6 pt-5 min-h-[60px] animate-in slide-in-from-top-2 fade-in duration-200 flex-wrap">
            <div className="flex items-center gap-2">
              {actionFilters.map((filter) => {
                const isActive = actionFilter === filter;
                let activeClass = "bg-primary/10 text-primary border-primary/30";
                if (filter === "Overdue" && isActive) activeClass = "bg-red-50 text-red-600 border-red-200 dark:bg-red-950 dark:text-red-400";
                else if (filter === "Today" && isActive) activeClass = "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950 dark:text-amber-400";
                return (
                  <button
                    key={filter}
                    className={"h-10 flex items-center justify-center cursor-pointer px-5 rounded-full text-[13.5px] font-medium transition-all duration-200 ease-out active:scale-[0.96] border " + (isActive ? activeClass : "bg-transparent text-muted-foreground border-border/60 hover:bg-muted hover:text-foreground")}
                    onClick={() => setActionFilter(filter)}
                  >
                    {filter}
                  </button>
                );
              })}
            </div>
            
            <div className={`ml-auto flex items-center h-10 bg-muted/60 p-1 rounded-full border border-border/50 relative shadow-inner transition-opacity duration-200 ${actionFilter === "Today" ? "opacity-100" : "opacity-0 pointer-events-none"}`}>
              {[
                { id: "pending", label: "Follow Up" },
                { id: "completed", label: "Followed Up" }
              ].map((mode) => {
                const isSelected = todayViewMode === mode.id;
                return (
                  <button
                    key={mode.id}
                    onClick={() => setTodayViewMode(mode.id as "pending" | "completed")}
                    className={`relative h-full flex items-center px-4 rounded-full text-[13px] font-bold transition-colors duration-300 z-10 active:scale-[0.96] ${isSelected ? "text-white" : "text-muted-foreground hover:text-foreground"}`}
                  >
                    {isSelected && (
                      <motion.div
                        layoutId="todayToggleBg"
                        className="absolute inset-0 bg-[#0052FF] shadow-md rounded-full"
                        initial={false}
                        transition={{ type: "spring", stiffness: 500, damping: 30 }}
                        style={{ zIndex: -1 }}
                      />
                    )}
                    <span className="relative z-10">{mode.label}</span>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        <div className="p-6">
          {pendingImports.length > 0 && activeTab === "Open Pipeline" && (
             <div className="mb-6 p-5 bg-blue-50/50 border border-blue-200 rounded-xl flex items-center justify-between shadow-sm">
                <div>
                   <h3 className="text-blue-900 font-bold text-[15px]">Review Pending Imports</h3>
                   <p className="text-blue-700/80 text-sm mt-0.5">Please review the <strong>{pendingImports.length}</strong> imported leads below. They have not been saved yet.</p>
                </div>
                <div className="flex items-center gap-3">
                   <Button variant="outline" className="border-blue-200 text-blue-800 hover:bg-blue-100" onClick={() => setPendingImports([])}>Cancel Import</Button>
                   <Button onClick={handleBulkInsert} disabled={isInserting} className="bg-[#0052FF] text-white hover:bg-[#0040CC] shadow-md px-6">
                     {isInserting ? "Inserting Leads..." : "Confirm & Insert All"}
                   </Button>
                </div>
             </div>
          )}
          {activeTab === "Open Pipeline" && pendingImports.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-center border-2 border-dashed border-border rounded-xl bg-muted/10">
              <div className="h-16 w-16 bg-blue-50 text-blue-600 rounded-full flex items-center justify-center mb-4 shadow-sm border border-blue-100">
                <FileSpreadsheet className="h-8 w-8" />
              </div>
              <h3 className="text-xl font-bold text-foreground mb-2">No Imported Leads</h3>
              <p className="text-muted-foreground max-w-sm mb-6">You haven't imported any leads yet. Use the bulk import feature to add an Excel file.</p>
              <Button onClick={() => setIsImportOpen(true)} className="bg-[#0052FF] text-white hover:bg-[#0040CC] shadow-md px-6">
                <UploadCloud className="h-4 w-4 mr-2" /> Bulk Import
              </Button>
            </div>
          ) : (
            isLoading ? <TableSkeleton /> : <DataTable columns={columns} data={displayedLeads()} showToolbar={true} />
          )}
        </div>
      </div>

      <Dialog open={deleteId !== null} onOpenChange={(open) => !open && setDeleteId(null)}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Delete Lead</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete this lead? This action cannot be undone and will remove all associated requirements and follow-ups.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="mt-4">
            <Button variant="outline" onClick={() => setDeleteId(null)}>Cancel</Button>
            <Button variant="destructive" onClick={handleDelete}>Delete Lead</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
