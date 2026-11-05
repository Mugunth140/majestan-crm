import {
  BadGatewayException,
  BadRequestException,
  Injectable,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { siteAnalyticsEnvironment } from '../../env.validation';

type Json = null | boolean | string | number | Json[] | { [key: string]: Json };
type Report = Record<string, Json>;
const DAY = 86400_000;
export function analyticsRange(from: unknown, to: unknown) {
  const date = (v: unknown): v is string =>
    typeof v === 'string' &&
    /^\d{4}-\d{2}-\d{2}$/.test(v) &&
    Number.isFinite(Date.parse(v)) &&
    new Date(v).toISOString().slice(0, 10) === v;
  if (
    !date(from) ||
    !date(to) ||
    Date.parse(to) <= Date.parse(from) ||
    Date.parse(to) - Date.parse(from) > 93 * DAY
  ) {
    throw new BadRequestException(
      'Use valid UTC dates from < to, at most 93 days. The end date is exclusive.',
    );
  }
  return { from, to };
}
export function numericAnalytics(value: unknown): Json {
  if (
    typeof value === 'string' &&
    /^-?\d+(?:\.\d+)?$/.test(value) &&
    Number.isFinite(Number(value))
  )
    return Number(value);
  if (Array.isArray(value)) return value.map(numericAnalytics);
  if (value && typeof value === 'object')
    return Object.fromEntries(
      Object.entries(value).map(([k, v]) => [k, numericAnalytics(v)]),
    );
  return typeof value === 'string' ||
    typeof value === 'number' ||
    typeof value === 'boolean'
    ? value
    : null;
}

@Injectable()
export class SiteAnalyticsService {
  private readonly cache = new Map<string, { at: number; report: Report }>();
  private readonly pending = new Map<string, Promise<Report>>();
  private live: { at: number; data: Json } | null = null;
  constructor(private readonly config: ConfigService) {}

  private settings() {
    const settings = siteAnalyticsEnvironment({
      SITE_ANALYTICS_API_URL: this.config.get<string>('SITE_ANALYTICS_API_URL'),
      SITE_ANALYTICS_READ_KEY: this.config.get<string>(
        'SITE_ANALYTICS_READ_KEY',
      ),
    });
    if (!settings.configured)
      throw new ServiceUnavailableException(
        'Website analytics is not configured. Set SITE_ANALYTICS_API_URL and SITE_ANALYTICS_READ_KEY on the CRM server.',
      );
    return settings;
  }

  private async upstream(path: string): Promise<Report> {
    const { apiUrl, readKey } = this.settings();
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 8000);
    try {
      const response = await fetch(`${apiUrl}/${path}`, {
        headers: { 'X-Analytics-Key': readKey, Accept: 'application/json' },
        signal: controller.signal,
      });
      if (response.status === 401)
        throw new BadGatewayException('Website analytics key mismatch');
      if (!response.ok)
        throw new ServiceUnavailableException(
          'Website analytics site API is unavailable',
        );
      const payload: unknown = await response.json();
      if (
        !payload ||
        typeof payload !== 'object' ||
        !('success' in payload) ||
        payload.success !== true ||
        !('data' in payload) ||
        !payload.data ||
        typeof payload.data !== 'object' ||
        Array.isArray(payload.data)
      ) {
        throw new BadGatewayException(
          'Website analytics returned an invalid report',
        );
      }
      return numericAnalytics(payload.data) as Report;
    } catch (error) {
      if (
        error instanceof BadGatewayException ||
        error instanceof ServiceUnavailableException
      )
        throw error;
      // Do not forward upstream bodies, addresses, credentials or error stacks.
      throw new ServiceUnavailableException(
        controller.signal.aborted
          ? 'Website analytics site API timed out'
          : 'Website analytics site API is unreachable',
      );
    } finally {
      clearTimeout(timer);
    }
  }

  private load(from: string, to: string): Promise<Report> {
    const key = `${from}:${to}`;
    const running = this.pending.get(key);
    if (running) return running;
    const request = this.upstream(`analytics/report?from=${from}&to=${to}`)
      .then((data) => {
        if (
          !data.overview ||
          typeof data.overview !== 'object' ||
          Array.isArray(data.overview) ||
          !data.dimensions ||
          typeof data.dimensions !== 'object' ||
          Array.isArray(data.dimensions) ||
          !['timeseries', 'entries', 'exits', 'events', 'performance'].every(
            (field) => Array.isArray(data[field]),
          )
        ) {
          throw new BadGatewayException(
            'Website analytics returned an incomplete report',
          );
        }
        const { realtime, ...report } = data;
        this.live = { at: Date.now(), data: realtime ?? null };
        const previous = this.cache.get(key);
        const historical =
          previous && Date.now() - previous.at < 60_000
            ? previous
            : { at: Date.now(), report };
        this.cache.delete(key);
        this.cache.set(key, historical);
        while (this.cache.size > 128)
          this.cache.delete(this.cache.keys().next().value);
        return historical.report;
      })
      .finally(() => {
        this.pending.delete(key);
      });
    this.pending.set(key, request);
    return request;
  }

  async report(
    from: unknown,
    to: unknown,
    includeLive = true,
  ): Promise<Report> {
    const range = analyticsRange(from, to);
    this.settings();
    const cached = this.cache.get(`${range.from}:${range.to}`);
    const current = cached && Date.now() - cached.at < 60_000;
    const live = this.live && Date.now() - this.live.at < 15_000;
    const report =
      current && (!includeLive || live)
        ? cached.report
        : await this.load(range.from, range.to);
    return includeLive
      ? { ...report, realtime: this.live?.data ?? null }
      : { ...report };
  }

  compare(from: unknown, to: unknown) {
    const range = analyticsRange(from, to);
    const start = Date.parse(range.from),
      length = Date.parse(range.to) - start;
    return this.report(
      new Date(start - length).toISOString().slice(0, 10),
      range.from,
      false,
    );
  }
  status() {
    return this.upstream('analytics/status');
  }
}
