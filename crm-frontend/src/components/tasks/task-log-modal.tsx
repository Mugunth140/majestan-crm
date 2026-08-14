"use client";
import { useState } from "react";
import { Loader2 } from "lucide-react";
import { apiFetch } from "@/lib/api-fetch";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { toast } from "sonner";

interface TaskLogModalProps {
  templateId: number;
  metricKey: string;
  metricLabel: string;
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export function TaskLogModal({
  templateId,
  metricKey,
  metricLabel,
  isOpen,
  onClose,
  onSuccess,
}: TaskLogModalProps) {
  const [value, setValue] = useState("");
  const [note, setNote] = useState("");
  const [loading, setLoading] = useState(false);
  const API = process.env.NEXT_PUBLIC_API_URL || "/api/v1";

  const handleClose = () => {
    setValue("");
    setNote("");
    onClose();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const num = parseFloat(value);
    if (!value || isNaN(num) || num <= 0) {
      toast.error("Enter a valid positive number");
      return;
    }
    setLoading(true);
    try {
      const res = await apiFetch(`${API}/tasks/${templateId}/log`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ metric_key: metricKey, count_value: num, note }),
      });
      if (!res.ok) throw new Error("Failed to log progress");
      toast.success("Progress logged successfully");
      onSuccess();
      handleClose();
    } catch {
      toast.error("Failed to save. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && handleClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Log Progress</DialogTitle>
          <DialogDescription className="text-[13.5px]">{metricLabel}</DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 py-2">
          <div className="space-y-1.5">
            <label className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
              Count / Amount
            </label>
            <Input
              type="number"
              min="0.01"
              step="any"
              value={value}
              onChange={(e) => setValue(e.target.value)}
              placeholder="e.g. 10"
              className="h-11 rounded-xl bg-muted/30 border-border/60 text-[15px]"
              autoFocus
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
              Note (optional)
            </label>
            <Input
              type="text"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Add a note..."
              className="h-11 rounded-xl bg-muted/30 border-border/60 text-[15px]"
            />
          </div>

          <DialogFooter className="mt-2 gap-2">
            <Button type="button" variant="outline" onClick={handleClose} disabled={loading}>
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={loading}
              className="bg-[#0052FF] hover:bg-[#0040CC] text-white shadow-md"
            >
              {loading && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
              {loading ? "Saving..." : "Save Progress"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
