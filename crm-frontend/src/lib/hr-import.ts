import { apiJson } from './api-fetch';

export type HrSource = { id: number; name: string; is_active: boolean };
export type HrStaff = { id: number; name: string; department: { id: number; name: string } };
export type HrMasters = { sources: HrSource[]; staff: HrStaff[] };
export type HrImportRow = {
  name: string; mobile: string; role: string; experience: string; location: string;
  hrSourceId: number; staffId?: number; rowNumber: number; source: string; staffName?: string;
};
export const HR_IMPORT_HEADERS = ['Candidate Name', 'Candidate Number', 'Role', 'Experience', 'Location', 'HR Source id', 'Staff ID'];
const API_URL = process.env.NEXT_PUBLIC_API_URL || '/api/v1';
const headerKey = (value: string) => value.toLowerCase().replace(/[^a-z0-9]/g, '');
export function normalizeHrMobile(value: unknown): string {
  let digits = String(value ?? '').replace(/\D/g, '');
  if (digits.startsWith('00')) digits = digits.slice(2);
  if (digits.length === 12 && digits.startsWith('91')) digits = digits.slice(2);
  if (digits.length === 11 && digits.startsWith('0')) digits = digits.slice(1);
  return digits;
}
export async function loadHrMasters(): Promise<HrMasters> {
  const [sourceResult, staffResult] = await Promise.all([
    apiJson<{ data: HrSource[] }>(`${API_URL}/master/all-hr-sources`),
    apiJson<{ data: HrStaff[] }>(`${API_URL}/hr/staff-list`),
  ]);
  if (!Array.isArray(sourceResult.data) || !Array.isArray(staffResult.data)) throw new Error('Could not load HR sources and staff. Please retry.');
  return { sources: sourceResult.data, staff: staffResult.data };
}
export function parseHrImportRows(sheet: Record<string, unknown>[], masters: HrMasters): HrImportRow[] {
  if (!sheet.length) throw new Error('The uploaded spreadsheet is empty.');
  const headers = Object.keys(sheet[0]);
  const required = HR_IMPORT_HEADERS.filter(header => header !== 'Staff ID');
  const missing = required.filter(header => !headers.some(key => headerKey(key) === headerKey(header)));
  if (missing.length) throw new Error(`Missing columns: ${missing.join(', ')}. Use the sample template.`);
  const sources = new Map(masters.sources.filter(source => Boolean(Number(source.is_active))).map(source => [Number(source.id), source]));
  const staff = new Map(masters.staff.map(user => [Number(user.id), user]));
  const seen = new Map<string, number>();
  const result: HrImportRow[] = [];
  sheet.forEach((raw, index) => {
    if (Object.values(raw).every(value => value == null || String(value).trim() === '')) return;
    const row = Object.fromEntries(Object.entries(raw).map(([key, value]) => [headerKey(key), value]));
    const read = (key: string) => String(row[headerKey(key)] ?? '').trim();
    const rowNumber = index + 2;
    const name = read('Candidate Name'), mobile = normalizeHrMobile(read('Candidate Number')), role = read('Role'), location = read('Location');
    if (!name) throw new Error(`Row ${rowNumber}: Candidate Name is required.`);
    if (!/^\d{10}$/.test(mobile)) throw new Error(`Row ${rowNumber}: Candidate Number must contain a valid 10 digit mobile number.`);
    if (!role) throw new Error(`Row ${rowNumber}: Role is required.`);
    if (!location) throw new Error(`Row ${rowNumber}: Location is required.`);
    for (const value of [name, role, location, read('Experience')]) if (value.length > 255) throw new Error(`Row ${rowNumber}: Text fields must be 255 characters or fewer.`);
    const id = (key: string) => {
      const value = read(key);
      if (!/^[1-9]\d*(?:\.0+)?$/.test(value) || !Number.isSafeInteger(Number(value))) throw new Error(`Row ${rowNumber}: ${key} must be a positive numeric ID.`);
      return Number(value);
    };
    const hrSourceId = id('HR Source id');
    const source = sources.get(hrSourceId);
    if (!source) throw new Error(`Row ${rowNumber}: HR Source id ${hrSourceId} is unknown or inactive.`);
    const staffId = read('Staff ID') ? id('Staff ID') : undefined;
    const assignee = staffId != null ? staff.get(staffId) : undefined;
    if (staffId != null && !assignee) throw new Error(`Row ${rowNumber}: Staff ID ${staffId} must belong to an active user in the HR department.`);
    if (seen.has(mobile)) throw new Error(`Rows ${seen.get(mobile)} and ${rowNumber}: Candidate Number ${mobile} appears more than once.`);
    seen.set(mobile, rowNumber);
    result.push({ name, mobile, role, experience: read('Experience'), location, hrSourceId, staffId, rowNumber, source: source.name, staffName: assignee?.name });
  });
  if (!result.length) throw new Error('The uploaded spreadsheet is empty.');
  if (result.length > 500) throw new Error('Import up to 500 candidates at a time.');
  return result;
}
export function candidateImportPayload(rows: HrImportRow[]) {
  return rows.map(({ name, mobile, role, experience, location, hrSourceId, staffId, rowNumber }) => ({ name, mobile, role, experience, location, hrSourceId, staffId, rowNumber }));
}
