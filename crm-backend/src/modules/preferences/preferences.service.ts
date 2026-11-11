import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';

/** Keys are short names like "columns:/leads:main". */
export const PREF_KEY = /^[\w:./\-[\]]{1,191}$/;
const MAX_BYTES = 16_000;

/** Each user's own settings, such as the columns a table shows. */
@Injectable()
export class PreferencesService {
  constructor(@InjectDataSource() private readonly dataSource: DataSource) {}

  private check(key: string) {
    if (!PREF_KEY.test(key))
      throw new BadRequestException('Invalid preference key');
  }

  /** Every saved value whose key starts with `prefix`, as { key: value }. */
  async list(userId: number, prefix = ''): Promise<Record<string, unknown>> {
    const rows: { pref_key: string; value: unknown }[] =
      await this.dataSource.query(
        'SELECT pref_key, value FROM user_preferences WHERE user_id = ? AND pref_key LIKE ?',
        [userId, `${prefix.replace(/[%_\\]/g, '\\$&')}%`],
      );
    return Object.fromEntries(
      rows.map((r) => [
        r.pref_key,
        typeof r.value === 'string' ? JSON.parse(r.value) : r.value,
      ]),
    );
  }

  async set(userId: number, key: string, value: unknown) {
    this.check(key);
    const empty =
      value == null ||
      (typeof value === 'object' &&
        !Array.isArray(value) &&
        !Object.keys(value).length);
    if (empty) return this.remove(userId, key);
    const json = JSON.stringify(value ?? null);
    if (json.length > MAX_BYTES)
      throw new BadRequestException('Preference is too large');
    await this.dataSource.query(
      'INSERT INTO user_preferences (user_id, pref_key, value) VALUES (?, ?, CAST(? AS JSON)) ON DUPLICATE KEY UPDATE value = VALUES(value)',
      [userId, key, json],
    );
  }

  async remove(userId: number, key: string) {
    this.check(key);
    await this.dataSource.query(
      'DELETE FROM user_preferences WHERE user_id = ? AND pref_key = ?',
      [userId, key],
    );
  }
}
