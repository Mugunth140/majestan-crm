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

  it('uploadTemp unwraps the presigned envelope and PUTs to the url', async () => {
    (apiJson as any).mockResolvedValueOnce({ success: true, data: { url: 'u', key: 'k' } });
    const put = vi.fn(async () => ({ ok: true }));
    vi.stubGlobal('fetch', put);
    try {
      const key = await adsApi.uploadTemp(new File(['x'], 'a.png', { type: 'image/png' }));
      expect(key).toBe('k');
      expect(put).toHaveBeenCalledWith('u', expect.objectContaining({ method: 'PUT' }));
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it('uploadTemp throws a clear error when url/key are missing', async () => {
    (apiJson as any).mockResolvedValueOnce({ success: true, data: {} });
    await expect(adsApi.uploadTemp(new File(['x'], 'a.png', { type: 'image/png' }))).rejects.toThrow(
      /missing presigned url\/key/,
    );
  });
});
