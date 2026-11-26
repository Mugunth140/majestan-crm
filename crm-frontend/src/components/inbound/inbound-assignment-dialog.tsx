'use client';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Check, Loader2, Search, UserMinus } from 'lucide-react';
import { apiJson } from '@/lib/api-fetch';
import { Avatar } from '@/components/record/feed';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { cn } from '@/lib/utils';

const API_URL = process.env.NEXT_PUBLIC_API_URL || '/api/v1';

/** Someone who can be given inbounds, with how many open ones they already hold. */
export type InboundStaff = { id: number; name: string; department?: string | null; open?: number };

type AssignmentProps = {
  open: boolean; count: number; busy: boolean; onClose: () => void; onConfirm: (staffId: number | null) => void;
  /** Who has the inbound now, when assigning a single one. */
  current?: number | null;
};

/** "Sales Department" → "Sales". */
const team = (department?: string | null) => (department || 'Other').replace(/\s*department\s*$/i, '').trim() || 'Other';
const TEAM_ORDER = ['Sales', 'Sourcing'];

/** People grouped by team, Sales then Sourcing, filtered by name or team. */
export function groupStaff(staff: InboundStaff[], query: string) {
  const q = query.trim().toLowerCase();
  const shown = q ? staff.filter(p => p.name.toLowerCase().includes(q) || team(p.department).toLowerCase().includes(q)) : staff;
  const groups = new Map<string, InboundStaff[]>();
  for (const p of shown) groups.set(team(p.department), [...(groups.get(team(p.department)) ?? []), p]);
  const rank = (t: string) => (TEAM_ORDER.includes(t) ? TEAM_ORDER.indexOf(t) : TEAM_ORDER.length);
  return [...groups].sort(([a], [b]) => rank(a) - rank(b) || a.localeCompare(b))
    .map(([name, people]) => ({ name, people: [...people].sort((a, b) => a.name.localeCompare(b.name)) }));
}

export function InboundAssignmentDialog(props: AssignmentProps) {
  return props.open ? <OpenInboundAssignmentDialog {...props} /> : null;
}

function OpenInboundAssignmentDialog({ open, count, busy, onClose, onConfirm, current = null }: AssignmentProps) {
  const [staff, setStaff] = useState<InboundStaff[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState<number | null>(null);
  const [pending, setPending] = useState<'assign' | 'unassign' | null>(null);
  const search = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) return;
    let live = true;
    apiJson<{ data: InboundStaff[] }>(`${API_URL}/inbounds/staff-list`).then(result => {
      if (live) setStaff(result.data);
    }).catch(() => { if (live) setError('Could not load the Sales and Sourcing staff. Close and try again.'); })
      .finally(() => { if (live) setLoading(false); });
    return () => { live = false; };
  }, [open]);
  useEffect(() => { if (!busy) setPending(null); }, [busy]);

  const groups = useMemo(() => groupStaff(staff, query), [staff, query]);
  const matches = groups.flatMap(g => g.people);
  const chosen = staff.find(p => p.id === selected);
  const noun = count === 1 ? 'inbound' : `${count} inbounds`;
  const canUnassign = count > 1 || current != null;

  const confirm = (id: number | null) => {
    if (busy) return;
    setPending(id === null ? 'unassign' : 'assign');
    onConfirm(id);
  };

  return <Dialog open={open} onOpenChange={value => { if (!value && !busy) onClose(); }}>
    <DialogContent className="gap-0 overflow-hidden p-0 sm:max-w-[440px]" showCloseButton={!busy} initialFocus={search}>
      <DialogHeader className="px-5 pt-5 pb-4">
        <DialogTitle className="text-[16px]">Assign {noun}</DialogTitle>
        <DialogDescription className="text-[13px]">Choose who works {count === 1 ? 'this inbound' : 'these inbounds'}. Sales and Sourcing are listed.</DialogDescription>
      </DialogHeader>

      <div className="flex items-center gap-2 border-y px-4">
        <Search aria-hidden className="size-4 shrink-0 text-muted-foreground" />
        <input
          ref={search}
          value={query}
          onChange={e => setQuery(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter' && matches.length === 1) setSelected(matches[0].id); }}
          placeholder="Search by name or team"
          aria-label="Search staff"
          disabled={busy}
          className="h-11 min-w-0 flex-1 bg-transparent text-[14px] outline-none placeholder:text-muted-foreground"
        />
        {!loading && !error && <span className="shrink-0 text-[12px] tabular-nums text-muted-foreground">{matches.length} {matches.length === 1 ? 'person' : 'people'}</span>}
      </div>

      <div role="listbox" aria-label="Staff" className="h-[min(380px,50vh)] overflow-y-auto px-2 pb-2">
        {error ? <p role="alert" className="px-3 py-6 text-center text-[13px] text-destructive">{error}</p>
          : loading ? <p role="status" className="flex items-center justify-center gap-2 py-10 text-[13px] text-muted-foreground"><Loader2 className="size-4 animate-spin" /> Loading staff…</p>
          : !matches.length ? <p className="px-3 py-10 text-center text-[13px] text-muted-foreground">{query.trim() ? <>No one matches “{query.trim()}”.</> : 'No one in Sales or Sourcing yet.'}</p>
          : groups.map(group => (
            <div key={group.name} role="group" aria-label={group.name}>
              <div className="sticky top-0 z-10 flex items-center justify-between bg-popover px-2.5 pt-3 pb-1.5 text-[12px] font-medium text-muted-foreground">
                <span>{group.name}</span><span className="tabular-nums">{group.people.length}</span>
              </div>
              {group.people.map(p => {
                const isSelected = p.id === selected;
                return (
                  <button key={p.id} type="button" role="option" aria-selected={isSelected} disabled={busy}
                    onClick={() => setSelected(isSelected ? null : p.id)} onDoubleClick={() => confirm(p.id)}
                    className={cn('flex w-full items-center gap-3 rounded-lg px-2.5 py-2 text-left transition-colors disabled:opacity-60',
                      isSelected ? 'bg-muted' : 'hover:bg-muted/60')}>
                    <Avatar name={p.name} userId={p.id} staff className="size-7 text-[11px]" />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[14px] font-medium text-foreground">{p.name}</span>
                      <span className="block truncate text-[12px] text-muted-foreground">
                        {p.id === current ? 'Has it now · ' : ''}{p.open ? `${p.open} open inbound${p.open === 1 ? '' : 's'}` : 'No open inbounds'}
                      </span>
                    </span>
                    <span aria-hidden className={cn('flex size-5 shrink-0 items-center justify-center rounded-full border transition-colors',
                      isSelected ? 'border-foreground bg-foreground text-background' : 'border-border')}>
                      {isSelected && <Check className="size-3" strokeWidth={3} />}
                    </span>
                  </button>
                );
              })}
            </div>
          ))}
      </div>

      <div className="flex items-center gap-2 border-t px-4 py-3">
        {canUnassign && (
          <Button variant="ghost" size="sm" disabled={busy} onClick={() => confirm(null)} className="-ml-1.5 text-muted-foreground">
            {pending === 'unassign' ? <Loader2 className="size-3.5 animate-spin" /> : <UserMinus className="size-3.5" />}
            {count === 1 ? 'Unassign' : 'Unassign all'}
          </Button>
        )}
        <div className="ml-auto flex items-center gap-2">
          <Button variant="outline" disabled={busy} onClick={onClose}>Cancel</Button>
          <Button disabled={busy || selected === null || selected === current} onClick={() => selected !== null && confirm(selected)}
            className="max-w-56 bg-foreground text-background hover:bg-foreground/85">
            {pending === 'assign' && <Loader2 className="size-3.5 animate-spin" />}
            <span className="truncate">{chosen ? `Assign to ${chosen.name.split(' ')[0]}` : 'Assign'}</span>
          </Button>
        </div>
      </div>
    </DialogContent>
  </Dialog>;
}
