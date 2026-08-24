
import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';

export interface HealthCheckResult {
  name: string;
  status: 'up' | 'down';
  latencyMs: number;
  error?: string;
}

@Injectable()
export class HealthService {
  constructor(
    @InjectDataSource() private readonly crmDb: DataSource,
    @InjectDataSource('siteConnection') private readonly siteDb: DataSource,
  ) {}

  private async check(db: DataSource, name: string): Promise<HealthCheckResult> {
    const started = Date.now();
    let timer: NodeJS.Timeout;
    try {
      const timeoutPromise = new Promise((_, reject) => {
        timer = setTimeout(() => reject(new Error('timed out after 3000ms')), 3000);
      });
      await Promise.race([db.query('SELECT 1'), timeoutPromise]);
      return { name, status: 'up', latencyMs: Date.now() - started };
    } catch (err) {
      return {
        name,
        status: 'down',
        latencyMs: Date.now() - started,
        error: err instanceof Error ? err.message : String(err),
      };
    } finally {
      clearTimeout(timer!);
    }
  }

  async checkHealth() {
    const checks = await Promise.all([
      this.check(this.crmDb, 'crm_db'),
      this.check(this.siteDb, 'site_db'),
    ]);

    const healthy = checks.every((c) => c.status === 'up');
    if (!healthy) {
      throw new ServiceUnavailableException({
        success: false,
        message: 'One or more health checks failed',
        data: { status: 'unhealthy', checks },
      });
    }

    return { status: 'healthy', checks, timestamp: new Date().toISOString() };
  }
}
