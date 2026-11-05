import { ConfigService } from '@nestjs/config';
import {
  SiteAnalyticsService,
  analyticsRange,
  numericAnalytics,
} from './site-analytics.service';
import { siteAnalyticsEnvironment } from '../../env.validation';

const report = (visitors = '12') => ({
  from: '2026-11-01',
  to: '2026-11-08',
  overview: { visitors },
  timeseries: [],
  dimensions: {},
  events: [],
  performance: [],
  entries: [],
  exits: [],
  realtime: { visitors: '3' },
});
const response = (data: unknown) =>
  ({
    ok: true,
    status: 200,
    json: () => Promise.resolve({ success: true, data }),
  }) as Response;
describe('website analytics proxy', () => {
  let service: SiteAnalyticsService;
  let fetcher: jest.SpiedFunction<typeof fetch>;
  beforeEach(() => {
    service = new SiteAnalyticsService(
      new ConfigService({
        SITE_ANALYTICS_API_URL: 'http://localhost:5000/api/v1',
        SITE_ANALYTICS_READ_KEY: 'fixture-read-key',
      }),
    );
    fetcher = jest
      .spyOn(globalThis, 'fetch')
      .mockResolvedValue(response(report()));
  });
  afterEach(() => {
    jest.restoreAllMocks();
    jest.useRealTimers();
  });
  it.each([
    ['2026-02-30', '2026-03-03'],
    ['2026-11-01', '2026-11-01'],
    ['2026-01-01', '2026-11-01'],
    ['2026-1-1', '2026-01-02'],
    [undefined, '2026-11-08'],
    [['2026-11-01'], '2026-11-08'],
  ])('rejects invalid dates %s – %s', async (from, to) => {
    await expect(service.report(from, to)).rejects.toMatchObject({
      status: 400,
    });
    expect(fetcher).not.toHaveBeenCalled();
  });
  it('accepts exactly 93 days, converts nested numbers and keeps dates/labels', () => {
    expect(analyticsRange('2026-01-01', '2026-04-04')).toEqual({
      from: '2026-01-01',
      to: '2026-04-04',
    });
    expect(
      numericAnalytics({
        count: '1200',
        value: '0.125',
        rows: [{ count: '7', label: 'IN' }],
        date: '2026-11-01',
        ready: true,
      }),
    ).toEqual({
      count: 1200,
      value: 0.125,
      rows: [{ count: 7, label: 'IN' }],
      date: '2026-11-01',
      ready: true,
    });
  });
  it('uses a server key, deduplicates concurrent requests and caches reports', async () => {
    const result = await Promise.all([
      service.report('2026-11-01', '2026-11-08'),
      service.report('2026-11-01', '2026-11-08'),
    ]);
    expect(fetcher).toHaveBeenCalledTimes(1);
    expect(result[0].overview).toEqual({ visitors: 12 });
    expect(fetcher).toHaveBeenCalledWith(
      'http://localhost:5000/api/v1/analytics/report?from=2026-11-01&to=2026-11-08',
      expect.objectContaining({
        headers: expect.objectContaining({
          'X-Analytics-Key': 'fixture-read-key',
        }) as unknown,
        signal: expect.any(AbortSignal) as unknown,
      }),
    );
    expect(JSON.stringify(result)).not.toContain('fixture-read-key');
  });
  it('keeps historical comparison reports for 60s and realtime for at most 15s', async () => {
    const now = Date.now();
    const clock = jest.spyOn(Date, 'now').mockReturnValue(now);
    await service.report('2026-11-01', '2026-11-08');
    clock.mockReturnValue(now + 14_000);
    await service.report('2026-11-01', '2026-11-08');
    expect(fetcher).toHaveBeenCalledTimes(1);
    clock.mockReturnValue(now + 16_000);
    await service.report('2026-11-01', '2026-11-08');
    expect(fetcher).toHaveBeenCalledTimes(2);
    await service.compare('2026-11-08', '2026-11-15');
    expect(fetcher).toHaveBeenCalledTimes(2);
    clock.mockReturnValue(now + 77_000);
    await service.compare('2026-11-08', '2026-11-15');
    expect(fetcher).toHaveBeenCalledTimes(3);
  });
  it('requests the equal length previous period', async () => {
    await service.compare('2026-11-01', '2026-11-08');
    expect(fetcher.mock.calls[0][0]).toBe(
      'http://localhost:5000/api/v1/analytics/report?from=2026-10-25&to=2026-11-01',
    );
  });
  it.each([
    { SITE_ANALYTICS_API_URL: '', SITE_ANALYTICS_READ_KEY: 'key' },
    {
      SITE_ANALYTICS_API_URL: 'http://localhost:5000/api/v1',
      SITE_ANALYTICS_READ_KEY: '',
    },
    { SITE_ANALYTICS_API_URL: 'invalid', SITE_ANALYTICS_READ_KEY: 'key' },
  ])('fails softly when settings are missing/invalid', async (env) => {
    const missing = new SiteAnalyticsService(new ConfigService(env));
    await expect(missing.status()).rejects.toMatchObject({
      status: 503,
      message: expect.stringContaining('not configured') as unknown,
    });
    expect(fetcher).not.toHaveBeenCalled();
  });
  it('defaults the integration URL without requiring optional values during CRM startup', () => {
    expect(siteAnalyticsEnvironment({})).toMatchObject({
      apiUrl: 'http://site-site-backend-1:5000/api/v1',
      configured: false,
    });
  });
  it('maps unauthorized to a safe key mismatch error and never caches it', async () => {
    fetcher.mockResolvedValueOnce({ ok: false, status: 401 } as Response);
    await expect(
      service.report('2026-11-01', '2026-11-08'),
    ).rejects.toMatchObject({
      status: 502,
      message: expect.stringContaining('key mismatch') as unknown,
    });
    await service.report('2026-11-01', '2026-11-08');
    expect(fetcher).toHaveBeenCalledTimes(2);
  });
  it('maps unreachable, upstream failures and invalid envelopes safely', async () => {
    fetcher.mockRejectedValueOnce(new Error('credentials must not leak'));
    await expect(service.status()).rejects.toMatchObject({
      status: 503,
      message: expect.not.stringContaining('credentials') as unknown,
    });
    fetcher.mockResolvedValueOnce({ ok: false, status: 503 } as Response);
    await expect(service.status()).rejects.toMatchObject({ status: 503 });
    fetcher.mockResolvedValueOnce(response(null));
    await expect(service.status()).rejects.toMatchObject({ status: 502 });
  });
  it('times out after 8 seconds', async () => {
    jest.useFakeTimers();
    fetcher.mockImplementation(
      (_url, options: RequestInit) =>
        new Promise((_resolve, reject) =>
          options.signal?.addEventListener('abort', () =>
            reject(new Error('aborted')),
          ),
        ),
    );
    const assertion = expect(service.status()).rejects.toMatchObject({
      status: 503,
      message: expect.stringContaining('timed out') as unknown,
    });
    await jest.advanceTimersByTimeAsync(8000);
    await assertion;
  });
  it('passes status values through with numeric counters', async () => {
    fetcher.mockResolvedValueOnce(
      response({
        enabled: true,
        available: false,
        reason: 'Storage is locked',
        events: '12',
      }),
    );
    expect(await service.status()).toEqual({
      enabled: true,
      available: false,
      reason: 'Storage is locked',
      events: 12,
    });
  });
});
