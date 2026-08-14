"use client";
import { useState } from "react";
import { X, Loader2 } from "lucide-react";
import { apiFetch } from "@/lib/api-fetch";
import { cn } from "@/lib/utils";

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
  const [error, setError] = useState("");
  const API = process.env.NEXT_PUBLIC_API_URL || "/api/v1";

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const num = parseFloat(value);
    if (!value || isNaN(num) || num <= 0) {
      setError("Enter a valid positive number");
      return;
    }
    setLoading(true);
    setError("");
    try {
      const res = await apiFetch(`${API}/tasks/${templateId}/log`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ metric_key: metricKey, count_value: num, note }),
      });
      if (!res.ok) throw new Error("Failed to log progress");
      onSuccess();
      onClose();
      setValue("");
      setNote("");
    } catch {
      setError("Failed to save. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end md:items-center justify-center">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-sm bg-card rounded-t-[2rem] md:rounded-2xl border shadow-2xl p-6 z-10">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-bold text-base">Log Progress</h3>
          <button onClick={onClose} className="p-1.5 rounded-full bg-muted active:scale-95">
            <X className="w-4 h-4 text-muted-foreground" />
          </button>
        </div>
        <p className="text-sm text-muted-foreground mb-4">{metricLabel}</p>
        <form onSubmit={handleSubmit} className="flex flex-col gap-3">
          <div>
            <label className="text-xs font-semibold text-muted-foreground mb-1 block">Count / Amount</label>
            <input
              type="number"
              min="0.01"
              step="any"
              value={value}
              onChange={e => setValue(e.target.value)}
              placeholder="e.g. 10"
              className="w-full rounded-xl border bg-background px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#0052FF]/30"
              autoFocus
            />
          </div>
          <div>
            <label className="text-xs font-semibold text-muted-foreground mb-1 block">Note (optional)</label>
            <input
              type="text"
              value={note}
              onChange={e => setNote(e.target.value)}
              placeholder="Add a note..."
              className="w-full rounded-xl border bg-background px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#0052FF]/30"
            />
          </div>
          {error && <p className="text-xs text-red-600">{error}</p>}
          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 rounded-xl bg-[#0052FF] text-white font-semibold text-sm active:scale-[0.98] transition-transform disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {loading && <Loader2 className="w-4 h-4 animate-spin" />}
            {loading ? "Saving..." : "Save Progress"}
          </button>
        </form>
      </div>
    </div>
  );
}
