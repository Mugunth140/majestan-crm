import { HttpException, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

/**
 * Thin proxy to the site backend's admin properties API (same VPS, internal
 * network). Holds a `login`-table service account, caches the 7d JWT and
 * re-logs-in once on 401. Used ONLY by the properties module — no other
 * CRM module depends on this service.
 */
@Injectable()
export class SiteApiService {
  private readonly logger = new Logger(SiteApiService.name);
  private readonly base: string;
  private readonly username: string;
  private readonly password: string;
  private token: string | null = null;
  private loginInFlight: Promise<string> | null = null;

  constructor(private readonly config: ConfigService) {
    this.base = (this.config.get<string>('SITE_API_BASE_URL') || 'http://site-backend:5000/api/v1').replace(/\/$/, '');
    this.username = this.config.get<string>('SITE_SERVICE_USERNAME') || 'svc_crm';
    this.password = this.config.get<string>('SITE_SERVICE_PASSWORD') || '';
  }

  private async login(): Promise<string> {
    if (!this.username || !this.password) {
      throw new HttpException('Site service credentials not configured', 500);
    }
    if (!this.loginInFlight) {
      this.loginInFlight = (async () => {
        this.logger.log(`Logging in to site API as ${this.username}`);
        const res = await fetch(`${this.base}/auth/login`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ username: this.username, password: this.password }),
          signal: AbortSignal.timeout(10000),
        });
        const body = await res.json().catch(() => null);
        const token = body?.data?.accessToken;
        if (!res.ok || !token) {
          throw new HttpException(
            `Site API login failed (${res.status}): ${body?.message || 'no token'}`,
            502,
          );
        }
        this.token = token;
        return token;
      })().finally(() => {
        this.loginInFlight = null;
      });
    }
    return this.loginInFlight;
  }

  private async raw(
    method: string,
    path: string,
    body?: any,
    token?: string,
  ): Promise<{ status: number; data: any }> {
    const res = await fetch(`${this.base}${path}`, {
      method,
      headers: {
        ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: body !== undefined ? JSON.stringify(body) : undefined,
      signal: AbortSignal.timeout(30000),
    });
    const data = await res.json().catch(() => null);
    return { status: res.status, data };
  }

  private unwrap(data: any): any {
    if (data && typeof data === 'object' && 'data' in data && 'success' in data) {
      return data.data;
    }
    return data;
  }

  private toError(status: number, data: any): HttpException {
    const raw = data && (data.message || data.error);
    const message = Array.isArray(raw) ? raw.join(', ') : (raw ?? `Site API request failed with status ${status}`);
    const mapped = status === 404 ? 404 : status === 401 || status === 403 ? status : status === 400 ? 400 : 502;
    return new HttpException(String(message), mapped);
  }

  async request(method: 'GET' | 'POST' | 'PATCH' | 'DELETE', path: string, body?: any, retry = true): Promise<any> {
    if (!this.token) {
      await this.login().catch((e) => {
        throw new HttpException(`Site API unavailable: ${(e as Error).message}`, 502);
      });
    }
    let status!: number;
    let data: any;
    try {
      ({ status, data } = await this.raw(method, path, body, this.token!));
    } catch (e) {
      throw new HttpException(`Site API unreachable: ${(e as Error).message}`, 502);
    }
    if (status === 401 && retry) {
      this.token = null;
      await this.login().catch((e) => {
        throw new HttpException(`Site API unavailable: ${(e as Error).message}`, 502);
      });
      return this.request(method, path, body, false);
    }
    if (status < 200 || status >= 300) {
      throw this.toError(status, data);
    }
    return this.unwrap(data);
  }

  get(path: string): Promise<any> {
    return this.request('GET', path);
  }

  post(path: string, body: any): Promise<any> {
    return this.request('POST', path, body);
  }

  patch(path: string, body: any): Promise<any> {
    return this.request('PATCH', path, body);
  }

  del(path: string): Promise<any> {
    return this.request('DELETE', path);
  }
}
