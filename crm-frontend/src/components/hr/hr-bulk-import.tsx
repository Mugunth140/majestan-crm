'use client';
import { useRef, useState } from 'react';
import { Download, FileSpreadsheet, UploadCloud } from 'lucide-react';
import { ColumnDef } from '@tanstack/react-table';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { DataTable } from '@/components/tables/data-table';
import { apiJson } from '@/lib/api-fetch';
import { HR_IMPORT_HEADERS, candidateImportPayload, loadHrMasters, normalizeHrMobile, parseHrImportRows, type HrImportRow, type HrMasters } from '@/lib/hr-import';
import { toast } from 'sonner';
const API_URL = process.env.NEXT_PUBLIC_API_URL || '/api/v1';

export function HrBulkImportDialog({ open, onOpenChange, onParsed }: {
  open: boolean; onOpenChange: (value: boolean) => void; onParsed: (rows: HrImportRow[]) => void;
}) {
  const [busy, setBusy] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState('');
  const masters = useRef<HrMasters | null>(null);
  async function getMasters() {
    if (!masters.current) masters.current = await loadHrMasters();
    return masters.current;
  }
  async function downloadTemplate() {
    setDownloading(true); setError('');
    try {
      const [XLSX, data] = await Promise.all([import('xlsx'), getMasters()]);
      const sources = data.sources.filter(source => Boolean(Number(source.is_active)));
      if (!sources.length) throw new Error('Add active HR sources before importing candidates.');
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet([{
        'Candidate Name': 'Nandini Rao', 'Candidate Number': '9876543210', Role: 'Sales Executive',
        Experience: '2 years', Location: 'Coimbatore', 'HR Source id': sources[0].id, 'Staff ID': data.staff[0]?.id ?? '',
      }], { header: HR_IMPORT_HEADERS }), 'Template');
      XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(sources.map(source => ({ ID: source.id, Source: source.name }))), 'HR Sources');
      XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(data.staff.map(staff => ({ ID: staff.id, Name: staff.name, Department: staff.department.name })), { header: ['ID', 'Name', 'Department'] }), 'HR Staff');
      XLSX.writeFile(workbook, 'HR_Import_Template.xlsx');
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'Could not download the template.'); }
    finally { setDownloading(false); }
  }
  async function upload(file?: File) {
    if (!file || busy || downloading) return;
    setError('');
    if (!/\.(xlsx|xls|csv)$/i.test(file.name)) { setError('Choose an .xlsx, .xls or .csv file.'); return; }
    if (file.size > 5 * 1024 * 1024) { setError('Choose a spreadsheet up to 5 MB.'); return; }
    setBusy(true); setProgress(0);
    try {
      const [XLSX, data, buffer] = await Promise.all([import('xlsx'), getMasters(), file.arrayBuffer()]);
      setProgress(35);
      const workbook = XLSX.read(buffer, { type: 'array' });
      if (!workbook.SheetNames.length) throw new Error('The uploaded spreadsheet is empty.');
      const sheet = XLSX.utils.sheet_to_json<Record<string, unknown>>(workbook.Sheets[workbook.SheetNames[0]], { defval: '', blankrows: true });
      const rows = parseHrImportRows(sheet, data);
      setProgress(100);
      onParsed(rows); onOpenChange(false);
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'Failed to parse spreadsheet.'); }
    finally { setBusy(false); }
  }
  return <Dialog open={open} onOpenChange={value => { if (!busy) { setError(''); onOpenChange(value); } }}>
    <DialogContent className="sm:max-w-md" showCloseButton={!busy}>
      <DialogHeader className="pr-8">
        <div className="flex items-center justify-between gap-2">
          <DialogTitle className="block">Import Candidates</DialogTitle>
          <Button variant="outline" size="sm" onClick={downloadTemplate} disabled={busy || downloading} className="h-8 text-xs">
            <Download className="h-3.5 w-3.5 mr-1.5" />{downloading ? 'Preparing…' : 'Sample Template'}
          </Button>
        </div>
        <DialogDescription className="sr-only">Upload a candidate spreadsheet, then review before saving.</DialogDescription>
      </DialogHeader>
      <div className="flex flex-col items-center justify-center p-8 border-2 border-dashed rounded-xl bg-muted/20 border-border/60"
        onDragOver={event => event.preventDefault()} onDrop={event => { event.preventDefault(); void upload(event.dataTransfer.files[0]); }}>
        {busy ? <div className="w-full space-y-4" role="status">
          <div className="flex items-center justify-between text-sm font-medium"><span>Processing...</span><span>{progress}%</span></div>
          <div className="h-2 w-full bg-muted rounded-full overflow-hidden"><div className="h-full bg-[#0052FF] transition-all duration-200" style={{ width: `${progress}%` }} /></div>
        </div> : <>
          <UploadCloud className="h-10 w-10 text-muted-foreground mb-4" />
          <p className="text-sm font-medium text-foreground mb-1">Click to upload or drag and drop</p>
          <p className="text-xs text-muted-foreground mb-4">.xlsx, .xls, or .csv files</p>
          <Input type="file" accept=".xlsx,.xls,.csv" aria-label="Candidate import spreadsheet" disabled={downloading}
            className="max-w-[250px] cursor-pointer" onChange={event => { const file = event.target.files?.[0]; event.target.value = ''; void upload(file); }} />
        </>}
      </div>
      {error && <p className="text-sm text-destructive" role="alert">{error}</p>}
    </DialogContent>
  </Dialog>;
}

export function HrImportReview({ rows, existing, onCancel, onImported }: {
  rows: HrImportRow[]; existing: { mobile: string }[]; onCancel: () => void; onImported: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const known = new Set(existing.map(candidate => normalizeHrMobile(candidate.mobile)));
  const duplicateCount = rows.filter(row => known.has(row.mobile)).length;
  const columns: ColumnDef<HrImportRow>[] = [
    { accessorKey: 'rowNumber', header: '#' }, { accessorKey: 'name', header: 'Candidate Name' },
    { accessorKey: 'mobile', header: 'Candidate Number' }, { accessorKey: 'role', header: 'Role' },
    { accessorKey: 'experience', header: 'Experience' },
    { accessorKey: 'location', header: 'Location' },
    { id: 'source', header: 'HR Source', cell: ({ row }) => `${row.original.source} (#${row.original.hrSourceId})` },
    { id: 'staff', header: 'Assigned staff', cell: ({ row }) => row.original.staffId ? `#${row.original.staffId} ${row.original.staffName}` : 'Unassigned' },
    { id: 'review', header: 'Review', cell: ({ row }) => <Badge variant="outline">{known.has(row.original.mobile) ? 'Already exists · skipped' : 'New candidate'}</Badge> },
  ];
  async function confirm() {
    setBusy(true); setError('');
    try {
      const result = await apiJson<{ success: boolean; created: number; skipped: number; assigned: number }>(`${API_URL}/hr/bulk`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ candidates: candidateImportPayload(rows) }),
      });
      if (!result.success) throw new Error('Candidate import failed. Please retry.');
      toast.success(`Imported ${result.created} candidates${result.assigned ? `, ${result.assigned} assigned` : ''}${result.skipped ? `, ${result.skipped} existing candidates skipped` : ''}.`);
      onImported();
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'Candidate import failed. Please retry.'); }
    finally { setBusy(false); }
  }
  return <div className="bg-card border rounded-xl overflow-hidden shadow-sm md:flex md:flex-col md:flex-1 md:min-h-0">
    <div className="px-4 sm:px-6 py-2.5 bg-card border-b border-border flex flex-col sm:flex-row sm:items-center justify-between gap-2 sm:gap-3">
      <div className="flex items-center gap-2.5 min-w-0">
        <div className="hidden sm:flex h-7 w-7 rounded-full bg-[#0052FF]/10 dark:bg-[#0052FF]/20 items-center justify-center shrink-0"><FileSpreadsheet className="h-3.5 w-3.5 text-[#0052FF]" /></div>
        <p className="text-sm"><span className="text-foreground font-semibold">Review {rows.length} pending imports</span><span className="text-muted-foreground"> — not saved yet.</span>
          {duplicateCount > 0 && <span className="text-amber-700 dark:text-amber-300 font-medium"> {duplicateCount} already exist and will be skipped.</span>}</p>
      </div>
      <div className="flex items-center gap-2 w-full sm:w-auto shrink-0">
        <Button variant="outline" size="sm" className="flex-1 sm:flex-none" disabled={busy} onClick={onCancel}>Cancel Import</Button>
        <Button size="sm" disabled={busy} onClick={confirm} className="flex-1 sm:flex-none bg-[#0052FF] text-white hover:bg-[#0052FF]/90 shadow-md">{busy ? 'Inserting…' : 'Confirm & Insert All'}</Button>
      </div>
    </div>
    {error && <p className="p-4 text-sm text-destructive" role="alert">{error}</p>}
    <div className="w-full md:flex-1 md:min-h-0 md:overflow-hidden"><DataTable columns={columns} data={rows} flush persistKey={false} /></div>
  </div>;
}
