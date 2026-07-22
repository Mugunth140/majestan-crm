"use client";

import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Loader2, User } from "lucide-react";
import { toast } from "sonner";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api/v1";

interface StaffMember {
  id: number;
  name: string;
  department?: { name: string };
  lead_count?: number;
}

interface AssignLeadModalProps {
  open: boolean;
  onClose: () => void;
  onConfirm: (toUserId: number) => void;
  leadId?: number;
  department?: string;
  isLoading?: boolean;
}

export function AssignLeadModal({ open, onClose, onConfirm, department, isLoading }: AssignLeadModalProps) {
  const [staffList, setStaffList] = useState<StaffMember[]>([]);
  const [isFetching, setIsFetching] = useState(false);
  const [selectedId, setSelectedId] = useState<number | null>(null);

  useEffect(() => {
    if (!open) return;
    setSelectedId(null);
    const fetchStaff = async () => {
      setIsFetching(true);
      try {
        const params = department ? `?department=${encodeURIComponent(department.toLowerCase())}` : "";
        const res = await fetch(`${API_URL}/lead-routing/staff-list${params}`);
        const data = await res.json();
        if (data.success) setStaffList(data.data);
        else toast.error("Failed to load staff list");
      } catch {
        toast.error("Failed to load staff list");
      } finally {
        setIsFetching(false);
      }
    };
    fetchStaff();
  }, [open, department]);

  const handleConfirm = () => {
    if (!selectedId) return toast.error("Please select a staff member");
    onConfirm(selectedId);
  };

  const handleClose = () => {
    setSelectedId(null);
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && handleClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Assign Lead</DialogTitle>
          <DialogDescription>
            Select a staff member to assign this lead to.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-2 max-h-72 overflow-y-auto">
          {isFetching ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="animate-spin text-[#0052FF] h-6 w-6" />
            </div>
          ) : staffList.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-6">No staff members found.</p>
          ) : (
            staffList.map((s) => (
              <button
                key={s.id}
                onClick={() => setSelectedId(s.id)}
                className={[
                  "w-full flex items-center gap-3 px-4 py-3 rounded-xl border transition-all text-left",
                  selectedId === s.id
                    ? "border-[#0052FF] bg-[#0052FF]/10"
                    : "border-border hover:border-[#0052FF]/40 hover:bg-muted/30",
                ].join(" ")}
              >
                <div className="h-8 w-8 rounded-full bg-blue-100 dark:bg-blue-900/40 flex items-center justify-center shrink-0">
                  <User className="h-4 w-4 text-blue-700 dark:text-blue-300" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-foreground truncate">{s.name}</p>
                  {s.department?.name && (
                    <p className="text-xs text-muted-foreground">{s.department.name}</p>
                  )}
                </div>
                <span className="text-xs font-bold text-muted-foreground shrink-0">
                  {s.lead_count ?? 0} leads
                </span>
              </button>
            ))
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleClose} disabled={isLoading}>
            Cancel
          </Button>
          <Button
            onClick={handleConfirm}
            disabled={isLoading || !selectedId}
            className="bg-[#0052FF] text-white hover:bg-[#0052FF]/90"
          >
            {isLoading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
            Assign
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
