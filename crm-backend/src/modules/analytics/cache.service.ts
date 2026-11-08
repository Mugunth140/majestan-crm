import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import Redis from 'ioredis';

/**
 * Valkey-backed cache. A cache outage must never break a request: every call
 * degrades to a miss (or a no-op) when Valkey is down. Lookups are logged as
 * `cache hit`, `cache miss` or `cache bypass` (Valkey down), with a summary
 * of the hit rate every five minutes.
 */
const SUMMARY_MS = 5 * 60_000;

/** Keys carry long id lists; the log keeps the readable head. */
const short = (key: string) => (key.length > 80 ? `${key.slice(0, 80)}…` : key);

@Injectable()
export class CacheService implements OnModuleDestroy {
  private readonly logger = new Logger(CacheService.name);
  private readonly client: Redis;
  private warned = false;
  /** Lookups since the last summary line. */
  private stats = { hits: 0, misses: 0, down: 0 };
  private readonly summary: NodeJS.Timeout;

  constructor() {
    this.client = new Redis({
      host: process.env.VALKEY_HOST || process.env.REDIS_HOST || 'valkey',
      port: Number(process.env.VALKEY_PORT || 6379),
      // Commands fail at once while Valkey is away instead of queueing for a
      // reconnect, so an outage costs a cache miss, not a stalled request.
      enableOfflineQueue: false,
      connectTimeout: 2_000,
      commandTimeout: 500,
      maxRetriesPerRequest: 1,
      retryStrategy: (times: number) => Math.min(times * 500, 10_000),
    });
    this.client.on('error', (err) => {
      if (!this.warned) this.logger.warn(`Valkey unavailable, serving uncached: ${err.message}`);
      this.warned = true;
    });
    this.client.on('ready', () => {
      if (this.warned) this.logger.log('Valkey connected');
      this.warned = false;
    });
    this.summary = setInterval(() => this.logSummary(), SUMMARY_MS);
    this.summary.unref();
  }

  /** A cached value, or null on a miss. Every lookup is logged as a hit or a miss. */
  async get<T>(key: string): Promise<T | null> {
    const started = Date.now();
    const { value, state } = await this.lookup<T>(key);
    this.logger.log(`cache ${state} ${short(key)} ${Date.now() - started}ms`);
    return value;
  }

  private async lookup<T>(key: string): Promise<{ value: T | null; state: 'hit' | 'miss' | 'bypass' }> {
    if (this.client.status !== 'ready') {
      this.stats.down++;
      return { value: null, state: 'bypass' };
    }
    try {
      const raw = await this.client.get(key);
      if (raw) {
        this.stats.hits++;
        return { value: JSON.parse(raw) as T, state: 'hit' };
      }
      this.stats.misses++;
      return { value: null, state: 'miss' };
    } catch {
      this.stats.down++;
      return { value: null, state: 'bypass' };
    }
  }

  async set(key: string, value: unknown, ttlSeconds: number): Promise<void> {
    try {
      await this.client.set(key, JSON.stringify(value), 'EX', ttlSeconds);
    } catch {
      /* cache is best effort */
    }
  }

  /** Cached `load()`, keyed by `key`, kept for `ttlSeconds`. Logs the hit, or the miss with how long the load took. */
  async wrap<T>(key: string, ttlSeconds: number, load: () => Promise<T>): Promise<T> {
    const started = Date.now();
    const { value, state } = await this.lookup<T>(key);
    if (value !== null) {
      this.logger.log(`cache hit ${short(key)} ${Date.now() - started}ms`);
      return value;
    }
    const fresh = await load();
    await this.set(key, fresh, ttlSeconds);
    this.logger.log(`cache ${state} ${short(key)} loaded in ${Date.now() - started}ms`);
    return fresh;
  }

  /** Deletes every key matching a glob, using SCAN so it never blocks Valkey. */
  async clear(pattern: string): Promise<void> {
    try {
      let cursor = '0';
      do {
        const [next, keys] = await this.client.scan(cursor, 'MATCH', pattern, 'COUNT', 200);
        if (keys.length) await this.client.del(...keys);
        cursor = next;
      } while (cursor !== '0');
    } catch {
      /* best effort */
    }
  }

  /** One line every few minutes: hits, misses and the hit rate since the last line. */
  private logSummary() {
    const { hits, misses, down } = this.stats;
    const total = hits + misses + down;
    if (!total) return;
    this.logger.log(
      `cache summary ${hits} hits, ${misses} misses, ${down} uncached (Valkey down) · hit rate ${Math.round((hits / total) * 100)}% over ${total} lookups`,
    );
    this.stats = { hits: 0, misses: 0, down: 0 };
  }

  async onModuleDestroy() {
    clearInterval(this.summary);
    this.logSummary();
    this.client.disconnect();
  }
}
