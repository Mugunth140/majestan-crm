'use client';
interface DateRangePickerProps { from: string; to: string; onChange: (from: string, to: string) => void; disabled?: boolean; }
export function DateRangePicker({ from, to, onChange, disabled }: DateRangePickerProps) {
  return (<div className="flex items-center gap-2 flex-wrap"><input type="date" value={from} max={to} disabled={disabled} onChange={e => onChange(e.target.value, to)} className="text-sm border border-border rounded-xl px-3 py-1.5 bg-card text-foreground focus:outline-none focus:ring-2 focus:ring-[#27427f]/30 disabled:opacity-50" /><span className="text-sm text-muted-foreground">to</span><input type="date" value={to} min={from} max={new Date().toISOString().slice(0, 10)} disabled={disabled} onChange={e => onChange(from, e.target.value)} className="text-sm border border-border rounded-xl px-3 py-1.5 bg-card text-foreground focus:outline-none focus:ring-2 focus:ring-[#27427f]/30 disabled:opacity-50" /></div>);
}
