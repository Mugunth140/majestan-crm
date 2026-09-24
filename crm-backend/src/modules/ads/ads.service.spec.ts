import { AdsService } from './ads.service';

describe('AdsService proxy', () => {
  function make() {
    const siteApi = {
      get: jest.fn(async (p: string) => ({ path: p })),
      post: jest.fn(async (p: string, b: any) => ({ path: p, body: b })),
      patch: jest.fn(async (p: string, b: any) => ({ path: p, body: b })),
      del: jest.fn(async (p: string) => ({ path: p })),
    };
    return { service: new AdsService(siteApi as any), siteApi };
  }

  it('lists with placement passthrough', async () => {
    const { service, siteApi } = make();
    await service.list({ placement: 'hero' });
    expect(siteApi.get).toHaveBeenCalledWith('/admin/ads?placement=hero');
  });

  it('creates against the site admin endpoint', async () => {
    const { service, siteApi } = make();
    const body = { title: 'X' };
    await service.create(body as any);
    expect(siteApi.post).toHaveBeenCalledWith('/admin/ads', body);
  });

  it('toggles status via the site status endpoint', async () => {
    const { service, siteApi } = make();
    await service.setStatus(4, false);
    expect(siteApi.patch).toHaveBeenCalledWith('/admin/ads/4/status', { isActive: false });
  });

  it('reorders via the site reorder endpoint', async () => {
    const { service, siteApi } = make();
    await service.reorder([9, 3]);
    expect(siteApi.patch).toHaveBeenCalledWith('/admin/ads/reorder', { ids: [9, 3] });
  });

  it('fetches presigned urls with file params', async () => {
    const { service, siteApi } = make();
    await service.presignedUrl('a.png', 'image/png');
    expect(siteApi.get).toHaveBeenCalledWith(
      '/admin/ads/presigned-url?fileName=a.png&fileType=image%2Fpng',
    );
  });
});
