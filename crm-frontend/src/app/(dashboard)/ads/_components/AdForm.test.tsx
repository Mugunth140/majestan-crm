// @vitest-environment jsdom
import { createElement } from 'react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor, act } from '@testing-library/react';
const mocks = vi.hoisted(() => ({ push: vi.fn(), update: vi.fn(), upload: vi.fn(), ratio: vi.fn(), toast: vi.fn() }));
vi.mock('next/navigation', () => ({ useRouter: () => ({ push: mocks.push }) }));
vi.mock('@/components/layout/mobile-header', () => ({ MobileHeader: () => null }));
vi.mock('sonner', () => ({ toast: { success: mocks.toast } }));
vi.mock('@/lib/ads-api', () => ({ adsApi: { update: mocks.update, uploadTemp: mocks.upload } }));
vi.mock('@/lib/ads-validation', async original => ({ ...await original<typeof import('@/lib/ads-validation')>(), readAdImageRatio: mocks.ratio }));
vi.mock('@/components/shared/form-select', () => ({ FormSelect: (p: any) => createElement('select', { id: p.id, name: p.name, value: p.value, onChange: (e: any) => p.onValueChange(e.target.value) }, p.options.map((o: any) => createElement('option', { key: o.value, value: o.value }, o.label))) }));
import { AdForm } from './AdForm';
const existing = { id: 7, title: 'Seasonal offer', placement: 'offers', desktopImage: 'https://cdn.test/desktop.webp', mobileImage: null, linkType: 'preset', linkPreset: 'home', isActive: true, sortOrder: 0 };
const file = () => new File(['image'], 'banner.png', { type: 'image/png' });
beforeEach(() => { vi.clearAllMocks(); mocks.update.mockResolvedValue({ success: true }); mocks.upload.mockResolvedValue('uploads/temp/banner.png'); URL.createObjectURL = vi.fn(() => 'blob:preview'); URL.revokeObjectURL = vi.fn(); });
afterEach(cleanup);
function open() { render(createElement(AdForm, { mode: 'edit', initial: existing })); }
it('retains unchanged stored images and returns to the saved list', async () => {
 open(); fireEvent.click(screen.getByRole('button', { name: 'Save Changes' }));
 await waitFor(() => expect(mocks.update).toHaveBeenCalledOnce());
 expect(mocks.update.mock.calls[0][1]).not.toHaveProperty('desktopImageKey'); expect(mocks.update.mock.calls[0][1]).not.toHaveProperty('mobileImageKey');
 expect(mocks.upload).not.toHaveBeenCalled(); expect(mocks.push).toHaveBeenCalledWith('/ads');
});
it('lets an invalid optional image be removed and saves without uploading it', async () => {
 open(); fireEvent.change(screen.getByLabelText(/Mobile image/, { selector: 'input' }), { target: { files: [new File(['bad'], 'bad.gif', { type: 'image/gif' })] } });
 expect(screen.getByRole('alert').textContent).toMatch(/JPEG/);
 fireEvent.click(screen.getByRole('button', { name: /Remove mobile image/i })); fireEvent.click(screen.getByRole('button', { name: 'Save Changes' }));
 await waitFor(() => expect(mocks.update).toHaveBeenCalledOnce()); expect(mocks.update.mock.calls[0][1].mobileImageKey).toBeNull(); expect(mocks.upload).not.toHaveBeenCalled();
});
it('does not keep saving blocked by a cancelled image decode', async () => {
 let finish!: (n: number) => void; mocks.ratio.mockImplementation(() => new Promise<number>(resolve => { finish = resolve; }));
 render(createElement(AdForm, { mode: 'edit', initial: { ...existing, mobileImage: 'https://cdn.test/mobile.webp' } }));
 fireEvent.change(screen.getByLabelText(/Mobile image/, { selector: 'input' }), { target: { files: [file()] } });
 fireEvent.click(screen.getByRole('button', { name: /Remove Mobile image/i })); fireEvent.click(screen.getByRole('button', { name: 'Save Changes' }));
 await waitFor(() => expect(mocks.update).toHaveBeenCalledOnce()); await act(async () => finish(4 / 5)); expect(mocks.upload).not.toHaveBeenCalled();
});
it('reports decoding failures inline and permits retry', async () => {
 mocks.ratio.mockRejectedValueOnce(new Error('Decode failed')); open();
 fireEvent.change(screen.getByLabelText(/Desktop image/, { selector: 'input' }), { target: { files: [file()] } });
 await waitFor(() => expect(screen.getByRole('alert').textContent).toMatch(/could not be read/));
 mocks.ratio.mockResolvedValueOnce(4); fireEvent.change(screen.getByLabelText(/Desktop image/, { selector: 'input' }), { target: { files: [file()] } });
 await waitFor(() => expect(screen.queryByRole('alert')).toBeNull()); fireEvent.click(screen.getByRole('button', { name: 'Save Changes' }));
 await waitFor(() => expect(mocks.update).toHaveBeenCalledOnce()); expect(mocks.upload).toHaveBeenCalledOnce();
});
it('keeps the form open after failed persistence', async () => {
 mocks.update.mockRejectedValueOnce(new Error('Save rejected')); open(); fireEvent.click(screen.getByRole('button', { name: 'Save Changes' }));
 await waitFor(() => expect(screen.getByRole('alert').textContent).toContain('Save rejected')); expect(mocks.push).not.toHaveBeenCalled(); expect(mocks.toast).not.toHaveBeenCalled();
});
it('can keep the stored desktop image after an invalid replacement', async () => {
 open(); fireEvent.change(screen.getByLabelText(/Desktop image/, { selector: 'input' }), { target: { files: [new File(['bad'], 'bad.svg', { type: 'image/svg+xml' })] } });
 fireEvent.click(screen.getByRole('button', { name: /Keep current desktop image/i }));
 fireEvent.click(screen.getByRole('button', { name: 'Save Changes' }));
 await waitFor(() => expect(mocks.update).toHaveBeenCalledOnce()); expect(mocks.upload).not.toHaveBeenCalled();
});
