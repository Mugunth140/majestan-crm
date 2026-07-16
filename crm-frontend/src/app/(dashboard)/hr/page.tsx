"use client";
import { useState, useEffect } from "react";
import { DataTable } from "@/components/tables/data-table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Plus, Eye, Edit } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api/v1";

const STATUS_STYLES: Record<string, string> = {
  "New Application": "bg-gray-100 text-gray-800",
  "Resume Shortlisted": "bg-blue-100 text-blue-800",
  "Interview Scheduled": "bg-purple-100 text-purple-800",
  "Interview Completed": "bg-indigo-100 text-indigo-800",
  "Selected": "bg-emerald-100 text-emerald-800",
  "Offer Sent": "bg-teal-100 text-teal-800",
  "Joined": "bg-green-100 text-green-800",
  "Rejected": "bg-red-200 text-red-900",
  "Hold": "bg-yellow-100 text-yellow-800",
};

export default function HrPage() {
  const router = useRouter();
  const [candidates, setCandidates] = useState([]);
  
  useEffect(() => {
    fetch(`${API_URL}/hr`)
      .then(res => res.json())
      .then(data => {
        const mapped = data.map((c: any, i: number) => ({
          ...c,
          sno: i + 1,
          formattedId: "HRC" + String(c.id).padStart(4, "0")
        }));
        setCandidates(mapped);
      });
  }, []);

  const columns = [
    { accessorKey: "sno", header: "#" },
    {
      accessorKey: "formattedId",
      header: "Id",
      cell: ({ row }: any) => (
        <Link href={`/hr/${row.original.id}`} className="text-[#0052FF] hover:underline font-medium">
          {row.getValue("formattedId")}
        </Link>
      ),
    },
    { accessorKey: "name", header: "Name",
      cell: ({ row }: any) => (
        <div className="flex items-center gap-2">
          <div className="h-7 w-7 rounded-full bg-blue-100 dark:bg-blue-900/40 flex items-center justify-center font-bold text-xs text-blue-900 dark:text-blue-300 shrink-0">
            {row.original.name?.charAt(0).toUpperCase()}
          </div>
          <span className="font-medium text-foreground">{row.original.name}</span>
        </div>
      )
    },
    { accessorKey: "position", header: "Position" },
    { accessorKey: "department", header: "Department" },
    { accessorKey: "mobile", header: "Mobile" },
    { 
      accessorKey: "status", 
      header: "Status",
      cell: ({ row }: any) => {
        const s = row.getValue("status") as string;
        return <Badge className={STATUS_STYLES[s] || "bg-gray-100"}>{s}</Badge>;
      }
    },
    {
      id: "actions",
      cell: ({ row }: any) => (
        <div className="flex items-center justify-center gap-1" onClick={(e) => e.stopPropagation()}>
          <Button 
            variant="ghost" 
            size="icon" 
            className="h-8 w-8 text-muted-foreground hover:text-foreground"
            title="View Details"
            onClick={() => router.push(`/hr/${row.original.id}`)}
          >
            <Eye size={15}/>
          </Button>
          <Button 
            variant="ghost" 
            size="icon" 
            className="h-8 w-8 text-muted-foreground hover:text-foreground"
            title="Edit"
            onClick={() => router.push(`/hr/${row.original.id}/edit`)}
          >
            <Edit size={15}/>
          </Button>
        </div>
      )
    }
  ];

  return (
    <div className="flex flex-col space-y-6">
      <div className="flex h-[48px] items-center justify-between pr-[150px]">
        <h1 className="text-[28px] font-bold tracking-tight">HR Panel</h1>
        
        <div className="flex items-center gap-3">
          <Link href="/hr/new" className="inline-flex h-11 rounded-full bg-[#0052FF] px-5 text-[14px] font-medium text-white shadow-md hover:bg-[#0052FF]/90 items-center gap-2 transition-transform active:scale-95">
            <Plus size={18} />
            Add Candidate
          </Link>
        </div>
      </div>

      <div className="bg-card border rounded-xl overflow-hidden shadow-sm p-6">
        <DataTable columns={columns} data={candidates} showToolbar={true} />
      </div>
    </div>
  );
}
