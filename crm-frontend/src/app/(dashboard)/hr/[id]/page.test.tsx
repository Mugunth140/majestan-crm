import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

const state = vi.hoisted(() => ({ calls: 0, form: {} as { priority?: string }, selects: [] as { name: string; value?: string | null }[] }));
vi.mock('react', async (original) => {
  const react = await original<typeof import('react')>();
  return { ...react, useState: (initial: unknown) => {
    const index = state.calls++;
    return react.useState(index === 0 ? { id: 7, name: 'Nandini Rao', status: 'New Application' } : index === 6 ? state.form : initial);
  } };
});
vi.mock('next/navigation', () => ({ useParams: () => ({ id: '7' }), useRouter: () => ({ push: vi.fn() }) }));
vi.mock('next/dynamic', () => ({ default: () => () => null }));
vi.mock('@/components/layout/mobile-header', () => ({ MobileHeader: () => null }));
vi.mock('@/components/hr/hr-assignment-dialog', () => ({ HrAssignmentDialog: () => null }));
vi.mock('@/components/mail/mail-panel', () => ({ MailPanel: () => null }));
vi.mock('@/components/shared/form-select', () => ({ FormSelect: (props: { name: string; value?: string | null }) => {
  state.selects.push(props);
  return null;
} }));
import HrDetail from './page';

describe('HR follow-up priority Select', () => {
  it.each([['initial render', {}, ''], ['selected priority', { priority: 'high' }, 'high'], ['reset after save', {}, '']])('stays controlled on %s', (_label, form, expected) => {
    state.calls = 0;
    state.form = form as { priority?: string };
    state.selects = [];
    renderToStaticMarkup(createElement(HrDetail));
    const priority = state.selects.find(select => select.name === 'priority');
    expect(priority).toBeDefined();
    expect(priority?.value).toBe(expected);
    expect(priority?.value).not.toBeUndefined();
  });
});
