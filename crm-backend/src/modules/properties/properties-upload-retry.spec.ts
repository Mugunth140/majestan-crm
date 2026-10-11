import { PropertiesService } from './properties.service';

describe('PropertiesService upload R2 retry', () => {
  const OLD_FETCH = global.fetch;

  function make(presigned = { url: 'https://r2.test/put', key: 'uploads/temp/a.png' }) {
    const siteApi = { get: jest.fn(async () => presigned) };
    const service = new PropertiesService(siteApi as any, {} as any, {} as any);
    return { service, siteApi };
  }

  const file = (name = 'a.png') =>
    ({ originalname: name, mimetype: 'image/png', size: 10, buffer: Buffer.from('x') }) as any;

  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
    global.fetch = OLD_FETCH;
    jest.restoreAllMocks();
  });

  it('returns the key on first-try success without retrying', async () => {
    const { service } = make();
    global.fetch = jest.fn().mockResolvedValue({ ok: true }) as any;
    const out = await (service as any).putToR2(file());
    expect(out).toBe('uploads/temp/a.png');
    expect(global.fetch).toHaveBeenCalledTimes(1);
  });

  it('retries transient network failures and then succeeds', async () => {
    const { service } = make();
    global.fetch = jest
      .fn()
      .mockRejectedValueOnce(new TypeError('getaddrinfo ETIMEOUT'))
      .mockResolvedValueOnce({ ok: true }) as any;
    const pending = (service as any).putToR2(file());
    const assertion = expect(pending).resolves.toBe('uploads/temp/a.png');
    await jest.runAllTimersAsync();
    await assertion;
    expect(global.fetch).toHaveBeenCalledTimes(2);
  });

  it('fails fast on HTTP error statuses without retrying', async () => {
    const { service } = make();
    global.fetch = jest.fn().mockResolvedValue({ ok: false, status: 403 }) as any;
    await expect((service as any).putToR2(file())).rejects.toThrow(
      'Failed to upload a.png (status 403)',
    );
    expect(global.fetch).toHaveBeenCalledTimes(1);
  });

  it('throws a clean error after exhausting retries', async () => {
    const { service } = make();
    global.fetch = jest.fn().mockRejectedValue(new TypeError('fetch failed')) as any;
    const pending = (service as any).putToR2(file(), 2);
    const assertion = expect(pending).rejects.toThrow('after 2 attempts');
    await jest.runAllTimersAsync();
    await assertion;
    expect(global.fetch).toHaveBeenCalledTimes(2);
  });
});
