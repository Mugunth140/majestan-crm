import { SiteApiService } from './site-api.service';

describe('site API project conflict propagation', () => {
  it('preserves HTTP 409 instead of converting a stale edit into a generic upstream failure', async () => {
    const originalFetch = global.fetch;
    const config = { get: (key: string) => ({ SITE_API_BASE_URL: 'http://site.test', SITE_SERVICE_USERNAME: 'test', SITE_SERVICE_PASSWORD: 'test-only' }[key]) };
    global.fetch = jest.fn()
      .mockResolvedValueOnce({ ok: true, json: async () => ({ data: { accessToken: 'test-token' } }) })
      .mockResolvedValueOnce({ status: 409, json: async () => ({ message: 'Project changed on another device' }) });
    try {
      const service = new SiteApiService(config as any);
      await expect(service.patch('/admin/projects/1', { units: [], expectedRevision: 1 })).rejects.toMatchObject({ status: 409, message: 'Project changed on another device' });
      expect(global.fetch).toHaveBeenCalledTimes(2);
    } finally { global.fetch = originalFetch; }
  });
});
