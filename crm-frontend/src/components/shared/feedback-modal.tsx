"use client";

import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Loader2 } from "lucide-react";
import { useState } from "react";

interface FeedbackModalProps {
  open: boolean;
  onClose: () => void;
  onConfirm: (feedback: string) => void;
  title: string;
  description?: string;
  isLoading?: boolean;
}

export function FeedbackModal({ open, onClose, onConfirm, title, description, isLoading }: FeedbackModalProps) {
  const [feedback, setFeedback] = useState("");

  const handleConfirm = () => {
    onConfirm(feedback);
  };

  const handleClose = () => {
    setFeedback("");
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && handleClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          {description && <DialogDescription>{description}</DialogDescription>}
        </DialogHeader>
        <div className="space-y-1.5">
          <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Feedback / Notes</label>
          <Textarea
            value={feedback}
            onChange={(e) => setFeedback(e.target.value)}
            placeholder="Enter your feedback or notes here..."
            className="h-28 rounded-xl bg-muted/30 resize-none"
          />
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={handleClose} disabled={isLoading}>
            Cancel
          </Button>
          <Button
            onClick={handleConfirm}
            disabled={isLoading}
            className="bg-[#0052FF] text-white hover:bg-[#0052FF]/90"
          >
            {isLoading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
            Confirm
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
