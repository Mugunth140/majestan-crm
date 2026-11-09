import { BadRequestException } from '@nestjs/common';
import { REPORT_MODULES, reportModule } from './report-modules';
import { buildQuery, istStart, PREVIEW_SIZES } from './reports.service';

const leads = reportModule('leads')!;

describe('report queries', () => {
  it('only accepts columns from the registry', () => {
    expect(() => buildQuery(leads, { module: 'leads', fields: ['name', 'l.id; DROP TABLE leads'] }, 50)).toThrow(BadRequestException);
    expect(() => buildQuery(leads, { module: 'leads', fields: [] }, 50)).toThrow('Choose at least one column');
  });

  it('binds filter values and dates instead of writing them into the SQL', () => {
    const q = buildQuery(leads, { module: 'leads', fields: ['name', 'status'], from: '2026-11-01', to: '2026-11-08', filters: { status: ["New Lead'; --"] } }, 50);
    expect(q.sql).not.toContain("'; --");
    expect(q.params).toEqual([istStart('2026-11-01'), istStart('2026-11-09'), "New Lead'; --"]);
    expect(q.sql).toMatch(/LIMIT 50$/);
  });

  it('rejects unknown filters and bad dates', () => {
    expect(() => buildQuery(leads, { module: 'leads', fields: ['name'], filters: { 'l.id': ['1'] } }, 50)).toThrow('Unknown filter');
    expect(() => buildQuery(leads, { module: 'leads', fields: ['name'], from: '1 OR 1=1' }, 50)).toThrow('Invalid start date');
  });

  it('turns "Not set" into a blank check', () => {
    const q = buildQuery(leads, { module: 'leads', fields: ['name'], filters: { source: ['__blank__'] } }, 50);
    expect(q.sql).toContain("NULLIF(TRIM(l.lead_source), '') IS NULL");
    expect(q.params).toEqual([]);
  });

  it('offers previews of 20, 50 or 100 rows', () => {
    expect(PREVIEW_SIZES).toEqual([20, 50, 100]);
  });

  it('starts the day at midnight India time', () => {
    expect(istStart('2026-11-08')).toBe('2026-11-07 18:30:00');
  });

  it('has unique keys and at least one default column in every module', () => {
    for (const m of REPORT_MODULES) {
      expect(new Set(m.fields.map(f => f.key)).size).toBe(m.fields.length);
      expect(m.fields.some(f => f.default)).toBe(true);
    }
    expect(REPORT_MODULES.map(m => m.key)).toEqual(['leads', 'inbound', 'agents', 'assets', 'hr', 'projects', 'properties', 'blog']);
  });
});
