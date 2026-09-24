// ads-api.test.ts
import { describe, expect, it, vi } from 'vitest';
import { adsApi } from './ads-api';

vi.mock('./api-fetch', () => ({
  apiJson: vi.fn(async (url: string) => ({ url })),
}));

import { apiJson } from './api-fetch';

describe('adsApi', () => {
  it('lists with placement query', async () => {
    const out = await adsApi.list({ placement: 'hero' });
    expect(apiJson).toHaveBeenCalledWith(expect.stringContaining('/ads?placement=hero'));
    expect(out).toEqual({ url: expect.stringContaining('/ads?placement=hero') });
  });

  it('toggles status via PATCH', async () => {
    await adsApi.setStatus(4, false);
    const [url, init] = (apiJson as any).mock.calls.at(-1);
    expect(url).toMatch(/\/ads\/4\/status$/);
    expect(init.method).toBe('PATCH');
    expect(JSON.parse(init.body)).toEqual({ isActive: false });
  });
});
