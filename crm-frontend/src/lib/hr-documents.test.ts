// @vitest-environment jsdom
import { afterEach, expect, it, vi } from 'vitest';
import { downloadHrDocument, isHrDocumentAvailable } from './hr-documents';
vi.mock('./api-fetch', () => ({ apiFetch: vi.fn() }));
import { apiFetch } from './api-fetch';
afterEach(() => { vi.restoreAllMocks(); vi.useRealTimers(); });
it('recognizes authenticated documents and real legacy URLs but rejects old fake links and scripts', () => {
 expect(isHrDocumentAvailable('hr-private://hr-documents/v1/7/resume/key')).toBe(true);
 expect(isHrDocumentAvailable('https://cdn.test/old-resume.pdf')).toBe(true);
 expect(isHrDocumentAvailable('https://r2.cloudflare.com/hr-documents/7/resume-old.pdf')).toBe(false);
 expect(isHrDocumentAvailable('javascript:alert(1)')).toBe(false);
});
it('downloads via the authenticated API and keeps the original filename', async () => {
 vi.useFakeTimers(); URL.createObjectURL = vi.fn(() => 'blob:document'); URL.revokeObjectURL = vi.fn();
 const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function(this: HTMLAnchorElement) { expect(this.download).toBe('candidate.pdf'); expect(this.href).toBe('blob:document'); });
 vi.mocked(apiFetch).mockResolvedValue({ ok: true, headers: new Headers({ 'content-disposition': "attachment; filename*=UTF-8''candidate.pdf" }), blob: async () => new Blob(['pdf']) } as Response);
 await downloadHrDocument('/api/v1', '7', 'resume');
 expect(apiFetch).toHaveBeenCalledWith('/api/v1/hr/7/documents/resume'); expect(click).toHaveBeenCalledOnce();
 vi.runAllTimers(); expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:document');
});
it('reports failed downloads without opening or saving an error response', async () => {
 vi.mocked(apiFetch).mockResolvedValue({ ok: false, json: async () => ({ message: 'Document missing' }) } as Response);
 await expect(downloadHrDocument('/api/v1', '7', 'resume')).rejects.toThrow('Document missing');
});
