import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Loader2 } from "lucide-react";

export const PREDEFINED_NOT_INTERESTED_REASONS = [
  "Already purchased elsewhere",
  "Budget issue",
  "Just browsing",
  "Asked not to contact",
  "Location mismatch",
];

type NotInterestedDialogProps = {
  open: boolean;
  onClose: () => void;
  onConfirm: (reason: string) => void;
  busy: boolean;
};

export function NotInterestedDialog({ open, onClose, onConfirm, busy }: NotInterestedDialogProps) {
  const [reason, setReason] = useState("");

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Lead Not Interested Reason</DialogTitle>
          <DialogDescription>
            Please provide the reason for marking this lead as not interested.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-3">
            <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Reason *</label>
            <div className="flex flex-wrap gap-2">
              {PREDEFINED_NOT_INTERESTED_REASONS.map((option) => (
                <button
                  type="button"
                  key={option}
                  onClick={() => setReason(option)}
                  className={`px-3 py-1.5 text-[13px] rounded-full border transition-colors ${
                    reason === option
                      ? "bg-red-50 text-red-600 border-red-200 dark:bg-red-950/40 dark:text-red-300 dark:border-red-900"
                      : "bg-muted/30 text-muted-foreground border-border/60 hover:bg-muted hover:text-foreground"
                  }`}
                >
                  {option}
                </button>
              ))}
            </div>
            <Textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Or type a custom reason..."
              className="h-24 rounded-xl bg-muted/30 resize-none mt-2"
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={busy}>
            Cancel
          </Button>
          <Button
            onClick={() => onConfirm(reason)}
            disabled={busy || !reason.trim()}
            className="bg-red-600 text-white hover:bg-red-700"
          >
            {busy ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
            Confirm Not Interested
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
