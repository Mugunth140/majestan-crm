'use client';
import { useEffect, useState } from 'react';
import { User } from 'lucide-react';
import { apiJson } from '@/lib/api-fetch';
import type { HrStaff } from '@/lib/hr-import';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
const API_URL = process.env.NEXT_PUBLIC_API_URL || '/api/v1';
type AssignmentProps = {
  open: boolean; count: number; busy: boolean; onClose: () => void; onConfirm: (staffId: number | null) => void;
};
export function HrAssignmentDialog(props: AssignmentProps) {
  return props.open ? <OpenHrAssignmentDialog {...props} /> : null;
}
function OpenHrAssignmentDialog({ open, count, busy, onClose, onConfirm }: AssignmentProps) {
  const [staff, setStaff] = useState<HrStaff[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selected, setSelected] = useState<number | null | undefined>(undefined);
  useEffect(() => {
    if (!open) return;
    let live = true;
    apiJson<{ data: HrStaff[] }>(`${API_URL}/hr/staff-list`).then(result => {
      if (live) setStaff(result.data);
    }).catch(() => { if (live) setError('Could not load HR staff. Close and retry.'); })
      .finally(() => { if (live) setLoading(false); });
    return () => { live = false; };
  }, [open]);
  return <Dialog open={open} onOpenChange={value => { if (!value && !busy) onClose(); }}>
    <DialogContent className="sm:max-w-md" showCloseButton={!busy}>
      <DialogHeader><DialogTitle>Assign Candidates</DialogTitle>
        <DialogDescription>Select an HR team member for {count} candidate{count === 1 ? '' : 's'}.</DialogDescription></DialogHeader>
      {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
      <div className="space-y-2 max-h-72 overflow-y-auto" role="radiogroup" aria-label="HR assignee">
        {loading ? <div className="h-16 rounded-xl bg-muted animate-pulse" role="status" aria-label="Loading HR staff" /> : [
          { id: null, name: 'Unassigned', department: undefined }, ...staff,
        ].map(person => <button type="button" role="radio" aria-checked={selected === person.id} disabled={busy}
          key={person.id ?? 'unassigned'} onClick={() => setSelected(person.id)}
          className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl border transition-all text-left ${selected === person.id ? 'border-[#0052FF] bg-[#0052FF]/10' : 'border-border hover:border-[#0052FF]/40 hover:bg-muted/30'}`}>
          <div className="h-8 w-8 rounded-full bg-blue-100 dark:bg-blue-900/40 flex items-center justify-center shrink-0"><User className="h-4 w-4 text-blue-700 dark:text-blue-300" /></div>
          <div><p className="text-sm font-semibold">{person.id != null && <span className="text-muted-foreground">#{person.id} </span>}{person.name}</p>
            {person.department && <p className="text-xs text-muted-foreground">{person.department.name}</p>}</div>
        </button>)}
      </div>
      <DialogFooter><Button variant="outline" disabled={busy} onClick={onClose}>Cancel</Button>
        <Button disabled={busy || loading || !!error || selected === undefined} onClick={() => selected !== undefined && onConfirm(selected)} className="bg-[#0052FF] text-white hover:bg-[#0052FF]/90">{busy ? 'Assigning…' : 'Assign'}</Button></DialogFooter>
    </DialogContent>
  </Dialog>;
}
