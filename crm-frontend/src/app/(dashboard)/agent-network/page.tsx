"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { DataTable } from "@/components/tables/data-table";
import { ColumnDef } from "@tanstack/react-table";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { TableSkeleton } from "@/components/tables/table-skeleton";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { FormSelect } from "@/components/shared/form-select";
import { Edit, Trash2, Plus, FileSpreadsheet, UploadCloud, RefreshCw, Search, Eye, Filter, X } from "lucide-react";
import * as XLSX from "xlsx";
import { motion } from "framer-motion";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api/v1";

const STATUS_STYLES: Record<string, string> = {
  "New": "bg-gray-100 text-gray-800 border-gray-200",
  "Contacted": "bg-blue-100 text-blue-800 border-blue-200",
  "Meeting Done": "bg-purple-100 text-purple-800 border-purple-200",
  "Documents Pending": "bg-amber-100 text-amber-800 border-amber-200",
  "Approved": "bg-emerald-100 text-emerald-800 border-emerald-200",
  "Active": "bg-green-100 text-green-800 border-green-200",
  "Hold": "bg-orange-100 text-orange-800 border-orange-200",
  "Rejected": "bg-red-100 text-red-800 border-red-200",
};

export default function AgentsPage() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState("All Agents");
  const [agents, setAgents] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [deleteId, setDeleteId] = useState<number | null>(null);

  // Bulk Import State
  const [isImportOpen, setIsImportOpen] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [importProgress, setImportProgress] = useState(0);
  const [pendingImports, setPendingImports] = useState<any[]>([]);
  const [isInserting, setIsInserting] = useState(false);

  // Filters
  const [searchQuery, setSearchQuery] = useState("");
  const [filters, setFilters] = useState({
    partnerType: "",
    status: "",
  });

  const tabs = ["All Agents", "Open Pipeline"];

  useEffect(() => {
    try {
      const userStr = localStorage.getItem("crm_user");
      if (userStr) {
        const user = JSON.parse(userStr);
        setIsAdmin(user.role === "Admin" || user.role === "Super Admin");
      }
    } catch {}
  }, []);

  const fetchAgents = useCallback(async () => {
    try {
      setIsLoading(true);
      const res = await fetch(API_URL + "/agents");
      const data = await res.json();
      if (data.success) {
        // Assign sequential sno
        setAgents(data.data.map((a: any, i: number) => ({ ...a, sno: i + 1 })));
      }
    } catch {
      toast.error("Failed to load agents.");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAgents();
  }, [fetchAgents]);

  const handleDelete = async () => {
    if (!deleteId) return;
    try {
      const res = await fetch(`${API_URL}/agents/${deleteId}`, { method: "DELETE" });
      const data = await res.json();
      if (data.success) {
        toast.success("Agent deleted successfully.");
        fetchAgents();
      } else {
        toast.error("Failed to delete agent.");
      }
    } catch {
      toast.error("An error occurred while deleting.");
    } finally {
      setDeleteId(null);
    }
  };

  const displayedAgents = () => {
    if (activeTab === "Open Pipeline") return pendingImports;

    let filtered = agents;

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      filtered = filtered.filter(a => 
        a.name.toLowerCase().includes(q) ||
        String(a.mobile).includes(q) ||
        (a.company_name && a.company_name.toLowerCase().includes(q)) ||
        String(a.id).includes(q)
      );
    }

    if (filters.partnerType) {
      filtered = filtered.filter(a => a.partner_type === filters.partnerType);
    }
    if (filters.status) {
      filtered = filtered.filter(a => a.status === filters.status);
    }

    return filtered;
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
      header: "ID",
      cell: ({ row }) => (
        <Link href={`/agent-network/${row.original.id || row.original.rawId}`} className="text-[#0052FF] hover:underline font-medium">
          A{String(row.original.id || row.original.rawId).padStart(5, "0")}
        </Link>
      ),
    },
    {
      accessorKey: "name",
      header: "Name",
      cell: ({ row }) => (
        <div className="flex items-center gap-2">
          <div className="h-7 w-7 rounded-full bg-blue-100 dark:bg-blue-900/40 flex items-center justify-center font-bold text-xs text-blue-900 dark:text-blue-300 shrink-0">
            {row.original.name?.charAt(0).toUpperCase() || 'A'}
          </div>
          <span className="font-semibold text-foreground whitespace-nowrap">{row.original.name}</span>
        </div>
      ),
    },
    {
      accessorKey: "company_name",
      header: "Company",
      cell: ({ row }) => <span className="text-foreground/80 whitespace-nowrap">{row.original.company_name || "\u2014"}</span>,
    },
    {
      accessorKey: "mobile",
      header: "Mobile",
      cell: ({ row }) => <span className="font-mono text-muted-foreground whitespace-nowrap">{row.original.mobile}</span>,
    },
    {
      accessorKey: "partner_type",
      header: "Partner Type",
      cell: ({ row }) => <span className="capitalize whitespace-nowrap">{row.original.partner_type ? row.original.partner_type.replace(/_/g, " ") : "\u2014"}</span>,
    },
    {
      accessorKey: "status",
      header: "Status",
      cell: ({ row }) => {
        const s = row.original.status as string;
        const cls = STATUS_STYLES[s] ?? "bg-gray-100 text-gray-800 border-gray-200";
        return <Badge className={`font-medium shadow-sm border whitespace-nowrap ${cls}`}>{s}</Badge>;
      },
    },
    {
      id: "actions",
      header: "Action",
      cell: ({ row }) => {
        if (row.original.isPendingImport) {
          return <Badge variant="outline" className="text-xs bg-amber-50 text-amber-600 border-amber-200">Pending</Badge>;
        }

        return (
          <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 text-muted-foreground hover:text-[#0052FF] hover:bg-blue-50 dark:hover:bg-blue-950"
              title="View Agent"
              onClick={() => router.push(`/agent-network/${row.original.id}`)}
            >
              <Eye size={15} />
            </Button>
            {isAdmin && (
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 text-red-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950"
                title="Delete Agent"
                onClick={() => setDeleteId(row.original.id)}
              >
                <Trash2 size={15} />
              </Button>
            )}
          </div>
        );
      }
    }
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
                    sno: i + 1,
                    name: row.Name || row.name || "",
                    mobile: row.Mobile || row.mobile || "",
                    email: row.Email || row.email || "",
                    company_name: row.Company || row.company || row.company_name || "",
                    partner_type: row["Partner Type"] || row.partner_type || "individual_broker",
                    status: "New",
                    isPendingImport: true,
                    rawData: row
                });
             }
             
             processed = nextChunk;
             setImportProgress(Math.floor((processed / total) * 100));
             
             if (processed < total) {
                 setTimeout(processChunk, 20);
             } else {
                 setPendingImports(formattedData);
                 setIsImporting(false);
                 setIsImportOpen(false);
                 setActiveTab("Open Pipeline");
                 toast.success(`${formattedData.length} agents parsed. Please review and insert.`);
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
         company_name: p.company_name,
         partner_type: p.partner_type,
      }));
      
      const res = await fetch(API_URL + "/agents/bulk", {
         method: "POST",
         headers: { "Content-Type": "application/json" },
         body: JSON.stringify({ agents: payload })
      });
      const data = await res.json();
      if (data.success) {
         toast.success(`Successfully inserted ${data.count} agents.`);
         setPendingImports([]);
         fetchAgents();
         setActiveTab("All Agents");
      } else {
         toast.error(data.message || "Bulk insert failed");
      }
    } catch(err) {
      toast.error("An error occurred during bulk insert.");
    } finally {
      setIsInserting(false);
    }
  };

  const uniquePartnerTypes = Array.from(new Set(agents.map(a => a.partner_type).filter(c => c && c !== "—")));
  const uniqueStatuses = Array.from(new Set(agents.map(a => a.status).filter(Boolean)));
  const activeFiltersCount = Object.values(filters).filter(v => v !== "").length;
  const clearFilters = () => setFilters({ partnerType: "", status: "" });

  return (
    <div className="flex flex-col space-y-6">
      <div className="flex h-[48px] items-center justify-between pr-[150px]">
        <h1 className="text-[28px] font-bold tracking-tight">Agent Network</h1>

        <div className="flex items-center gap-3">
          <Button variant="outline" size="icon" className="h-10 w-10 rounded-full border-border/60" onClick={fetchAgents} title="Refresh">
            <RefreshCw size={16} className={isLoading ? "animate-spin" : ""} />
          </Button>

          <Dialog open={isImportOpen} onOpenChange={setIsImportOpen}>
            <DialogTrigger className="inline-flex h-12 rounded-full bg-card px-5 text-[14px] font-medium shadow-sm border border-border/60 hover:bg-muted/50 items-center gap-2">
              <FileSpreadsheet size={16} className="text-muted-foreground" />
              Bulk Import
            </DialogTrigger>
            <DialogContent className="sm:max-w-md">
              <DialogHeader>
                <DialogTitle>Import Agents</DialogTitle>
                <DialogDescription>Upload your Excel file to bulk import agents.</DialogDescription>
              </DialogHeader>
              <div className="flex flex-col items-center justify-center p-6 border-2 border-dashed border-border rounded-xl bg-muted/30">
                {isImporting ? (
                  <div className="w-full space-y-4">
                    <div className="flex items-center justify-between text-sm font-medium">
                      <span>Parsing Excel Data...</span>
                      <span>{importProgress}%</span>
                    </div>
                    <div className="h-2 w-full bg-muted rounded-full overflow-hidden">
                      <div className="h-full bg-[#0052FF] transition-all duration-300" style={{ width: `${importProgress}%` }} />
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

          <Link href="/agent-network/new" className="inline-flex h-11 rounded-full bg-[#0052FF] px-5 text-[14px] font-medium text-white shadow-md hover:bg-[#0052FF]/90 items-center gap-2 transition-transform active:scale-95">
            <Plus size={18} />
            Add New Agent
          </Link>
        </div>
      </div>

      <div className="bg-card border rounded-xl overflow-hidden shadow-sm">
        <div className="flex flex-col xl:flex-row xl:items-end justify-between px-6 border-b bg-muted/10 pt-4 gap-4">
          <div className="flex items-center gap-3 pb-3 xl:pb-4 w-full xl:w-auto">
            <div className="relative flex-1 xl:w-72">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input 
                placeholder="Search ID, Name, Phone, Company..." 
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="pl-9 h-10 bg-background rounded-full border-border/60 shadow-sm text-[13.5px]"
              />
            </div>
            
            <Popover>
              <PopoverTrigger render={
                <Button variant="outline" className="h-10 rounded-full bg-background border-border/60 shadow-sm gap-2">
                  <Filter size={14} className="text-muted-foreground" />
                  Filters
                  {activeFiltersCount > 0 && (
                    <Badge className="ml-1 h-5 w-5 rounded-full p-0 flex items-center justify-center bg-[#0052FF]">
                      {activeFiltersCount}
                    </Badge>
                  )}
                </Button>
              } />
              <PopoverContent className="w-80 p-4 rounded-2xl" align="start">
                <div className="flex items-center justify-between mb-4">
                  <h4 className="font-semibold text-sm">Filter Agents</h4>
                  {activeFiltersCount > 0 && (
                    <Button variant="ghost" size="sm" onClick={clearFilters} className="h-auto p-0 text-xs text-muted-foreground hover:text-foreground">
                      Clear all
                    </Button>
                  )}
                </div>
                <div className="space-y-4">
                  <div className="space-y-2">
                    <label className="text-xs font-semibold text-muted-foreground">Partner Type</label>
                    <FormSelect
                      name="filterType"
                      placeholder="Any Partner Type"
                      options={uniquePartnerTypes.map((c: any) => ({ label: String(c).replace(/_/g, " ").replace(/\b\w/g, l => l.toUpperCase()), value: c }))}
                      value={filters.partnerType}
                      onValueChange={(v) => setFilters(f => ({ ...f, partnerType: v || "" }))}
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-semibold text-muted-foreground">Status</label>
                    <FormSelect
                      name="filterStatus"
                      placeholder="Any Status"
                      options={uniqueStatuses.map((s: any) => ({ label: s, value: s }))}
                      value={filters.status}
                      onValueChange={(v) => setFilters(f => ({ ...f, status: v || "" }))}
                    />
                  </div>
                </div>
              </PopoverContent>
            </Popover>
          </div>

          <div className="flex gap-6 overflow-x-auto hide-scrollbar">
            {tabs.map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className="relative pb-3 text-sm font-semibold transition-colors whitespace-nowrap"
              >
                <span className={activeTab === tab ? "text-[#0052FF]" : "text-muted-foreground hover:text-foreground"}>
                  {tab}
                  {tab === "Open Pipeline" && pendingImports.length > 0 && (
                    <Badge className="ml-2 bg-amber-500 text-white border-transparent">
                      {pendingImports.length}
                    </Badge>
                  )}
                </span>
                {activeTab === tab && (
                  <motion.div layoutId="agent-tab-indicator" className="absolute bottom-0 left-0 right-0 h-[3px] bg-[#0052FF] rounded-t-full" />
                )}
              </button>
            ))}
          </div>
        </div>

        <div className="p-6">
          {pendingImports.length > 0 && activeTab === "Open Pipeline" && (
             <div className="mb-6 p-5 bg-blue-50/50 border border-blue-200 rounded-xl flex items-center justify-between shadow-sm">
                <div>
                   <h3 className="text-blue-900 font-bold text-[15px]">Review Pending Imports</h3>
                   <p className="text-blue-700/80 text-sm mt-0.5">Please review the <strong>{pendingImports.length}</strong> imported agents below. They have not been saved yet.</p>
                </div>
                <div className="flex items-center gap-3">
                   <Button variant="outline" className="border-blue-200 text-blue-800 hover:bg-blue-100" onClick={() => setPendingImports([])}>Cancel Import</Button>
                   <Button onClick={handleBulkInsert} disabled={isInserting} className="bg-[#0052FF] text-white hover:bg-[#0040CC] shadow-md px-6">
                     {isInserting ? "Inserting Agents..." : "Confirm & Insert All"}
                   </Button>
                </div>
             </div>
          )}
          {activeTab === "Open Pipeline" && pendingImports.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-center border-2 border-dashed border-border rounded-xl bg-muted/10">
              <div className="h-16 w-16 bg-blue-50 text-blue-600 rounded-full flex items-center justify-center mb-4 shadow-sm border border-blue-100">
                <FileSpreadsheet className="h-8 w-8" />
              </div>
              <h3 className="text-xl font-bold text-foreground mb-2">No Imported Agents</h3>
              <p className="text-muted-foreground max-w-sm mb-6">You haven't imported any agents yet. Use the bulk import feature to add an Excel file.</p>
              <Button onClick={() => setIsImportOpen(true)} className="bg-[#0052FF] text-white hover:bg-[#0040CC] shadow-md px-6">
                <UploadCloud className="h-4 w-4 mr-2" /> Bulk Import
              </Button>
            </div>
          ) : (
            isLoading ? <TableSkeleton columns={6} rows={5} /> : <DataTable columns={columns} data={displayedAgents()} showToolbar={true} />
          )}
        </div>
      </div>

      <Dialog open={deleteId !== null} onOpenChange={(open) => !open && setDeleteId(null)}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Delete Agent</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete this agent? This action cannot be undone and will remove all associated logs and follow-ups.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="mt-4">
            <Button variant="outline" onClick={() => setDeleteId(null)}>Cancel</Button>
            <Button variant="destructive" onClick={handleDelete}>Delete Agent</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
