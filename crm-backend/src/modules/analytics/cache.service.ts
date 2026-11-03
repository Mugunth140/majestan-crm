import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import Redis from 'ioredis';

/**
 * Valkey-backed cache. A cache outage must never break a request: every call
 * degrades to a miss (or a no-op) when Valkey is down.
 */
@Injectable()
export class CacheService implements OnModuleDestroy {
  private readonly logger = new Logger(CacheService.name);
  private readonly client: Redis;
  private warned = false;

  constructor() {
    this.client = new Redis({
      host: process.env.VALKEY_HOST || process.env.REDIS_HOST || 'valkey',
      port: Number(process.env.VALKEY_PORT || 6379),
      lazyConnect: true,
      maxRetriesPerRequest: 1,
      retryStrategy: (times: number) => Math.min(times * 500, 10_000),
    });
    this.client.on('error', (err) => {
      if (!this.warned) this.logger.warn(`Valkey unavailable, serving uncached: ${err.message}`);
      this.warned = true;
    });
    this.client.on('ready', () => { this.warned = false; });
  }

  async get<T>(key: string): Promise<T | null> {
    try {
      const raw = await this.client.get(key);
      return raw ? (JSON.parse(raw) as T) : null;
    } catch {
      return null;
    }
  }

  async set(key: string, value: unknown, ttlSeconds: number): Promise<void> {
    try {
      await this.client.set(key, JSON.stringify(value), 'EX', ttlSeconds);
    } catch {
      /* cache is best effort */
    }
  }

  /** Cached `load()`, keyed by `key`, kept for `ttlSeconds`. */
  async wrap<T>(key: string, ttlSeconds: number, load: () => Promise<T>): Promise<T> {
    const hit = await this.get<T>(key);
    if (hit !== null) return hit;
    const value = await load();
    await this.set(key, value, ttlSeconds);
    return value;
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

  async onModuleDestroy() {
    this.client.disconnect();
  }
}
