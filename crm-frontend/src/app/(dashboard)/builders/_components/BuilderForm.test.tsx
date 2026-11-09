// @vitest-environment jsdom
import { createElement } from 'react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
const mocks = vi.hoisted(() => ({ push: vi.fn(), create: vi.fn(), error: vi.fn(), success: vi.fn() }));
vi.mock('next/navigation', () => ({ useRouter: () => ({ push: mocks.push }) }));
vi.mock('sonner', () => ({ toast: { success: mocks.success, error: mocks.error } }));
vi.mock('@/lib/builders-api', () => ({ buildersApi: { create: mocks.create } }));
vi.mock('@/lib/properties-api', () => ({ propertiesApi: { uploadImages: vi.fn() } }));
vi.mock('@/components/shared/focus-modal', async original => ({
  ...await original<typeof import('@/components/shared/focus-modal')>(),
  FocusModal: (p: { steps: { key: string; status: string }[]; children: unknown; footer: unknown }) =>
    createElement('div', null, createElement('ol', null, p.steps.map(s => createElement('li', { key: s.key }, `${s.key}:${s.status}`))), p.children, p.footer),
}));
import { BuilderForm } from './BuilderForm';
beforeEach(() => { vi.clearAllMocks(); mocks.create.mockResolvedValue({ success: true, data: { id: 42 } }); });
afterEach(cleanup);
const steps = () => screen.getAllByRole('listitem').map(li => li.textContent);

it('needs a name before a new builder moves on, then creates it and opens its page', async () => {
  render(createElement(BuilderForm, {}));
  expect(screen.queryByRole('button', { name: 'Create builder' })).toBeNull();
  fireEvent.click(screen.getByRole('button', { name: 'Continue' }));
  expect(mocks.error).toHaveBeenCalledWith('Builder name is required');
  expect(steps()[0]).toBe('company:in-progress');

  fireEvent.change(screen.getByLabelText(/Builder name/), { target: { value: '  Prestige Group ' } });
  fireEvent.click(screen.getByRole('button', { name: 'Continue' }));
  fireEvent.click(screen.getByRole('button', { name: 'Continue' }));
  expect(steps()).toEqual(['company:completed', 'contact:completed', 'record:in-progress']);

  fireEvent.click(screen.getByRole('button', { name: 'Create builder' }));
  await waitFor(() => expect(mocks.create).toHaveBeenCalledOnce());
  expect(mocks.create.mock.calls[0][0]).toMatchObject({ name: 'Prestige Group', experienceYears: null, completedProjects: 0, ongoingProjects: 0, isActive: true });
  expect(mocks.push).toHaveBeenCalledWith('/builders/42');
});

