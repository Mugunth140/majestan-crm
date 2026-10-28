import { describe, expect, it } from 'vitest';
import { candidateImportPayload, parseHrImportRows, type HrMasters } from './hr-import';
import { hrSourceOptions } from './hr-candidate-options';
const masters: HrMasters = {
  sources: [{ id: 3, name: 'Nithra', is_active: true }, { id: 4, name: 'Old source', is_active: false }],
  staff: [{ id: 12, name: 'Kavya', department: { id: 5, name: 'HR Department' } }],
};
const row = { 'Candidate Name': 'Nandini Rao', 'Candidate Number': '+91 98765 43210', Role: 'Sales Executive', Experience: 0, Location: 'Peelamedu, Coimbatore', 'HR Source id': 3, 'Staff ID': 12 };
describe('HR spreadsheet import', () => {
  it('uses manual location text, HR source ID and a validated HR assignee', () => {
    const [candidate] = parseHrImportRows([row], masters);
    expect(candidate).toMatchObject({ mobile: '9876543210', experience: '0', location: 'Peelamedu, Coimbatore', hrSourceId: 3, source: 'Nithra', staffId: 12, staffName: 'Kavya' });
    expect(candidateImportPayload([candidate])).toEqual([{ name: 'Nandini Rao', mobile: '9876543210', role: 'Sales Executive', experience: '0', location: 'Peelamedu, Coimbatore', hrSourceId: 3, staffId: 12, rowNumber: 2 }]);
  });
  it('accepts blank or omitted optional Staff ID', () => {
    expect(parseHrImportRows([{ ...row, 'Staff ID': '' }], masters)[0].staffId).toBeUndefined();
    const { 'Staff ID': _staff, ...withoutStaff } = row;
    expect(parseHrImportRows([withoutStaff], masters)[0].staffId).toBeUndefined();
  });
  it.each([99, 0, 'abc', 1.5])('rejects an invalid/non-HR/inactive Staff ID: %s', staffId => {
    expect(() => parseHrImportRows([{ ...row, 'Staff ID': staffId }], masters)).toThrow('Staff ID');
  });
  it('keeps actual sheet row numbers when blank rows are present', () => {
    const blank = Object.fromEntries(Object.keys(row).map(key => [key, '']));
    expect(parseHrImportRows([blank, row], masters)[0].rowNumber).toBe(3);
  });
  it('rejects duplicate numbers with different country-code formatting', () => {
    expect(() => parseHrImportRows([row, { ...row, 'Candidate Number': '9876543210' }], masters)).toThrow('Rows 2 and 3');
  });
  it.each([
    [{ 'Candidate Name': '' }, 'Candidate Name'], [{ 'Candidate Number': '123' }, 'Candidate Number'],
    [{ Role: '' }, 'Role'], [{ Location: '' }, 'Location'], [{ 'HR Source id': 4 }, 'inactive'], [{ 'HR Source id': 999 }, 'unknown'],
  ])('rejects invalid candidate data: %o', (invalid, message) => {
    expect(() => parseHrImportRows([{ ...row, ...invalid }], masters)).toThrow(String(message));
  });
  it('requires the new Location and HR Source headers', () => {
    expect(() => parseHrImportRows([{ 'Candidate Name': 'Nandini' }], masters)).toThrow('Location, HR Source id');
  });
  it('rejects empty and oversized spreadsheets', () => {
    expect(() => parseHrImportRows([], masters)).toThrow('empty');
    expect(() => parseHrImportRows(Array.from({ length: 501 }, (_, i) => ({ ...row, 'Candidate Number': String(9000000000 + i) })), masters)).toThrow('500');
  });
});
describe('HR source dropdown', () => {
  it('does not show inactive sources as new selections', () => {
    expect(hrSourceOptions(masters.sources, { hrSourceId: '', recruitmentSource: '' }).options).toEqual([{ label: 'Nithra', value: '3' }]);
  });
  it('retains existing inactive source selections', () => {
    expect(hrSourceOptions(masters.sources, { hrSourceId: '4', recruitmentSource: 'Old source' }).value).toBe('4');
  });
  it('preserves legacy labels without confusing lead-source IDs with HR IDs', () => {
    expect(hrSourceOptions(masters.sources, { hrSourceId: '', recruitmentSource: 'Legacy agency' }).options).toContainEqual({ label: 'Legacy agency', value: 'legacy-source' });
  });
});
