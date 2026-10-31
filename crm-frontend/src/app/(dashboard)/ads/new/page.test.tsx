// @vitest-environment jsdom
import { createElement } from 'react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { cleanup, render, screen, waitFor, act } from '@testing-library/react';
const state = vi.hoisted(() => ({ query: '', getOne: vi.fn() }));
vi.mock('next/navigation', () => ({ useSearchParams: () => new URLSearchParams(state.query) }));
vi.mock('@/lib/ads-api', () => ({ adsApi: { getOne: state.getOne } }));
vi.mock('../_components/AdForm', () => ({ AdForm: (props: any) => createElement('div', { 'data-testid': 'ad-editor' }, `${props.mode}:${props.initial?.id || props.defaultPlacement}`) }));
import Page from './page';
beforeEach(() => { state.getOne.mockReset(); });
afterEach(cleanup);
it.each(['edit=', 'edit=0', 'edit=oops', 'edit=9007199254740992'])('does not fall back to creating an ad for invalid link %s', query => {
 state.query = query; render(createElement(Page)); expect(screen.getByRole('alert').textContent).toContain('invalid'); expect(screen.queryByTestId('ad-editor')).toBeNull(); expect(state.getOne).not.toHaveBeenCalled();
});
it('loads the requested create placement without fetching an existing ad', () => {
 state.query = 'placement=offers'; render(createElement(Page)); expect(screen.getByTestId('ad-editor').textContent).toBe('create:offers'); expect(state.getOne).not.toHaveBeenCalled();
});
it('keeps load failures out of the create form', async () => {
 state.query = 'edit=7'; state.getOne.mockRejectedValue(new Error('Ad unavailable')); render(createElement(Page));
 await waitFor(() => expect(screen.getByRole('alert').textContent).toContain('Ad unavailable')); expect(screen.queryByTestId('ad-editor')).toBeNull();
});
it('does not restore a slower response after navigating to another ad', async () => {
 let old!: (value: unknown) => void; state.query = 'edit=7'; state.getOne.mockImplementationOnce(() => new Promise(resolve => { old = resolve; }));
 const view = render(createElement(Page));
 state.query = 'edit=8'; state.getOne.mockResolvedValueOnce({ data: { id: 8 } }); view.rerender(createElement(Page));
 await waitFor(() => expect(screen.getByTestId('ad-editor').textContent).toBe('edit:8'));
 await act(async () => old({ data: { id: 7 } })); expect(screen.getByTestId('ad-editor').textContent).toBe('edit:8');
});
