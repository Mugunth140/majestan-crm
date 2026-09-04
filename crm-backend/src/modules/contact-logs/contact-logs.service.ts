import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, QueryRunner, Repository } from 'typeorm';
import * as bcrypt from 'bcrypt';
import * as crypto from 'crypto';
import { User } from '../../database/entities/user.entity';

type CallDirection = 'Incoming' | 'Outgoing' | 'Missed';
type LoggerEvent = 'app_open' | 'sync_started' | 'sync_success' | 'sync_error' | 'permission_denied';

interface IncomingCallLog {
  sourceCallId: string;
  phoneNumber: string;
  direction: CallDirection;
  duration: number;
  timestamp: string;
}

interface DeviceReport {
  deviceId: string;
  deviceModel: string;
  androidVersion: string;
  appVersion: string;
  callLogPermission: boolean;
  event: LoggerEvent;
  syncedCount: number;
  error: string | null;
}

export interface LogReceipt {
  sourceCallId: string;
  status: 'accepted' | 'duplicate' | 'rejected';
  reason?: string;
}

// Minimum significant digits for suffix matching. Shorter suffixes collide
// across contacts (e.g. "12" matches any number ending in 12).
const MIN_MATCH_DIGITS = 7;
const MAX_SYNC_BATCH = 1000;

const cleanDigits = (value: string | null | undefined) => (value || '').replace(/[^0-9]/g, '');

function numbersMatch(saved: string | null | undefined, observed: string): boolean {
  const left = cleanDigits(saved);
  const right = cleanDigits(observed);
  if (left.length < MIN_MATCH_DIGITS || right.length < MIN_MATCH_DIGITS) return false;
  return left.endsWith(right) || right.endsWith(left);
}

// Format a Date as UTC 'YYYY-MM-DD HH:mm:ss' for DATETIME columns.
function toUtcSqlString(d: Date): string {
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getUTCFullYear()}-${p(d.getUTCMonth() + 1)}-${p(d.getUTCDate())} ${p(d.getUTCHours())}:${p(d.getUTCMinutes())}:${p(d.getUTCSeconds())}`;
}

@Injectable()
export class ContactLogsService {
  constructor(
    @InjectRepository(User) private readonly userRepo: Repository<User>,
    private readonly dataSource: DataSource,
  ) {}

  // Column sets here MUST mirror matchCandidate() below — same tables, same
  // columns — so the whitelist the device filters on is exactly what the
  // server matches against.
  private static readonly NUMBER_COLUMNS: Record<string, string[]> = {
    leads: ['mobile_number', 'whatsapp_number'],
    agents: ['mobile_number', 'whatsapp_number'],
    inbounds: ['mobile_number', 'whatsapp_number', 'manager_mobile', 'caretaker_mobile', 'security_contact', 'broker_mobile'],
    assets: ['mobile_number'],
    hr_candidates: ['mobile', 'whatsapp'],
  };

  /**
   * Returns [{number, since}] — `since` is the earliest created_at across the
   * staffer's entities holding that number. The device uploads only calls
   * newer than `since`, so pre-assignment history is never sent.
   */
  async getTrackableNumbers(userId: number): Promise<{ number: string; since: string | null }[]> {
    const rows = await this.fetchMatchRows(userId);
    const earliest = new Map<string, string | null>();
    for (const { row, columns } of rows) {
      for (const col of columns) {
        const value = row[col];
        if (typeof value !== 'string' || cleanDigits(value).length < MIN_MATCH_DIGITS) continue;
        const key = value.trim();
        const created = row.created_at ? new Date(row.created_at).toISOString() : null;
        const prev = earliest.get(key);
        if (!prev || (created && created < prev)) earliest.set(key, created ?? prev ?? null);
      }
    }
    return Array.from(earliest.entries()).map(([number, since]) => ({ number, since }));
  }

  private async fetchMatchRows(userId: number) {
    const selectFor = (table: string, extra: string, assigned: boolean) => {
      const cols = ContactLogsService.NUMBER_COLUMNS[table].join(', ');
      const where = assigned ? 'WHERE assigned_staff_id = ?' : '';
      const params = assigned ? [userId] : [];
      return this.dataSource.query(
        `SELECT id, ${cols}, created_at ${extra} FROM ${table} ${where}`,
        params,
      ).then((rows: any[]) => rows.map((row) => ({ table, row, columns: ContactLogsService.NUMBER_COLUMNS[table] })));
    };
    const [leads, agents, inbounds, assets] = await Promise.all([
      selectFor('leads', '', true),
      selectFor('agents', '', true),
      selectFor('inbounds', '', true),
      selectFor('assets', '', true),
    ]);
    // HR candidates have no staff assignment — matched org-wide.
    // NOTE: hr_candidates uses camelCase createdAt (not created_at).
    const hr = await this.dataSource.query(
      `SELECT id, mobile, whatsapp, createdAt AS created_at FROM hr_candidates`,
    ).then((rows: any[]) => rows.map((row) => ({ table: 'hr_candidates', row, columns: ContactLogsService.NUMBER_COLUMNS['hr_candidates'] })));
    return [...leads, ...agents, ...inbounds, ...assets, ...hr];
  }

  private matchCandidate(rows: { table: string; row: any; columns: string[] }[], phoneNumber: string):
    { table: string; row: any } | null {
    for (const { table, row, columns } of rows) {
      if (columns.some((col) => numbersMatch(row[col], phoneNumber))) {
        return { table, row };
      }
    }
    return null;
  }

  /**
   * Issue (or rotate) a long-lived device secret. Returns the plaintext
   * secret exactly once — the app must store it; it is never readable again.
   * Sliding 30-day expiry is maintained on every authenticated use.
   */
  async registerDevice(userId: number, deviceId: string): Promise<{ deviceSecret: string; expiresInDays: number }> {
    const user = await this.userRepo.findOne({ where: { id: userId } });
    if (!user || !user.is_active) throw new NotFoundException('User not found');
    const secret = crypto.randomBytes(32).toString('hex');
    const secretHash = await bcrypt.hash(secret, 10);
    await this.dataSource.query(
      `INSERT INTO logger_device_secrets (user_id, device_id, secret_hash, expires_at)
       VALUES (?, ?, ?, DATE_ADD(NOW(6), INTERVAL 30 DAY))
       ON DUPLICATE KEY UPDATE secret_hash = VALUES(secret_hash), expires_at = VALUES(expires_at), revoked_at = NULL, last_used_at = NULL`,
      [userId, deviceId, secretHash],
    );
    return { deviceSecret: secret, expiresInDays: 30 };
  }

  /** Revoke a device secret. Owners revoke their own; Admins revoke any. */
  async revokeDevice(requesterId: number, deviceId: string, reqUser: any): Promise<{ revoked: boolean }> {
    const role = reqUser?.role;
    const isAdmin = role === 'Admin' || role === 'Super Admin';
    const rows = await this.dataSource.query(
      `SELECT user_id FROM logger_device_secrets WHERE device_id = ?`,
      [deviceId],
    );
    const ownerId = rows?.[0]?.user_id;
    if (!ownerId) return { revoked: false };
    if (Number(ownerId) !== Number(requesterId) && !isAdmin) {
      throw new ForbiddenException('Cannot revoke another user’s device');
    }
    await this.dataSource.query(
      `UPDATE logger_device_secrets SET revoked_at = NOW(6) WHERE device_id = ?`,
      [deviceId],
    );
    return { revoked: true };
  }

  /** Called on password change — all device secrets die, forcing re-login. */
  async revokeAllUserDevices(userId: number): Promise<void> {
    await this.dataSource.query(
      `UPDATE logger_device_secrets SET revoked_at = NOW(6) WHERE user_id = ? AND revoked_at IS NULL`,
      [userId],
    );
  }

  async recordDeviceHeartbeat(userId: number, body: unknown) {
    const report = this.parseDeviceReport(body);
    if (!report) return { registered: false };

    const now = new Date();
    const isAttempt = report.event === 'sync_started' || report.event === 'sync_success' || report.event === 'sync_error';
    const isSuccess = report.event === 'sync_success';
    const result = report.event === 'app_open' ? null : report.event.replace('sync_', '');

    await this.dataSource.query(
      `INSERT INTO logger_devices
        (user_id, device_id, device_model, android_version, app_version, call_log_permission, last_seen_at, last_sync_attempt_at, last_successful_sync_at, last_sync_result, last_sync_count, last_error)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE
         user_id = VALUES(user_id),
         device_model = VALUES(device_model),
         android_version = VALUES(android_version),
         app_version = VALUES(app_version),
         call_log_permission = VALUES(call_log_permission),
         last_seen_at = VALUES(last_seen_at),
         last_sync_attempt_at = CASE WHEN VALUES(last_sync_attempt_at) IS NULL THEN last_sync_attempt_at ELSE VALUES(last_sync_attempt_at) END,
         last_successful_sync_at = CASE WHEN VALUES(last_successful_sync_at) IS NULL THEN last_successful_sync_at ELSE VALUES(last_successful_sync_at) END,
         last_sync_result = CASE WHEN VALUES(last_sync_result) IS NULL THEN last_sync_result ELSE VALUES(last_sync_result) END,
         last_sync_count = CASE WHEN VALUES(last_sync_result) IS NULL THEN last_sync_count ELSE VALUES(last_sync_count) END,
         last_error = CASE WHEN VALUES(last_sync_result) IS NULL THEN last_error ELSE VALUES(last_error) END`,
      [
        userId, report.deviceId, report.deviceModel, report.androidVersion, report.appVersion,
        report.callLogPermission, now, isAttempt ? now : null, isSuccess ? now : null,
        result, report.syncedCount, report.error,
      ],
    );
    return { registered: true };
  }

  async getLoggerDevices(requesterId: number) {
    const requester = await this.userRepo.findOne({ where: { id: requesterId }, relations: { role: true } });
    if (!['Admin', 'Super Admin', 'Manager', 'Team Lead'].includes(requester?.role?.name || '')) {
      throw new ForbiddenException('Only admins, managers and team leads can view logger devices');
    }

    const rows = await this.dataSource.query(`
      SELECT d.id, d.device_id, d.device_model, d.android_version, d.app_version, d.call_log_permission,
             d.registered_at, d.last_seen_at, d.last_sync_attempt_at, d.last_successful_sync_at,
             d.last_sync_result, d.last_sync_count, d.last_error,
             u.id AS user_id, u.name AS staff_name, u.email AS staff_email, r.name AS staff_role
      FROM logger_devices d
      JOIN users u ON u.id = d.user_id
      LEFT JOIN roles r ON r.id = u.role_id
      ORDER BY d.last_seen_at DESC
    `);
    const freshAfter = Date.now() - 60 * 60 * 1000;

    return rows.map((row: any) => {
      const seenAt = new Date(row.last_seen_at).getTime();
      const successfulAt = row.last_successful_sync_at ? new Date(row.last_successful_sync_at).getTime() : 0;
      const permissionGranted = Boolean(row.call_log_permission);
      const isFresh = seenAt >= freshAfter;
      const isHealthy = permissionGranted && successfulAt >= freshAfter && row.last_sync_result === 'success';
      const health = !permissionGranted
        ? 'permission_required'
        : row.last_sync_result === 'error'
          ? 'sync_error'
          : isHealthy
            ? 'healthy'
            : isFresh
              ? 'awaiting_sync'
              : 'offline';

      return {
        id: row.id,
        device_id: row.device_id,
        staff: { id: row.user_id, name: row.staff_name, email: row.staff_email, role: row.staff_role || 'Staff' },
        device_model: row.device_model,
        android_version: row.android_version,
        app_version: row.app_version,
        call_log_permission: permissionGranted,
        registered_at: row.registered_at,
        last_seen_at: row.last_seen_at,
        last_sync_attempt_at: row.last_sync_attempt_at,
        last_successful_sync_at: row.last_successful_sync_at,
        last_sync_count: Number(row.last_sync_count || 0),
        last_error: row.last_error,
        health,
        is_active: isFresh,
      };
    });
  }

  async syncCallLogs(userId: number, logs: unknown): Promise<{ synced: number; duplicates: number; rejected: LogReceipt[]; receipts: LogReceipt[] }> {
    const receipts: LogReceipt[] = [];
    if (!Array.isArray(logs) || logs.length === 0) return { synced: 0, duplicates: 0, rejected: [], receipts };

    const matchRows = await this.fetchMatchRows(userId);
    const seenInBatch = new Set<string>();
    const pending: { log: IncomingCallLog; table: string; entityId: number; callAt: Date }[] = [];

    for (const candidate of logs.slice(0, MAX_SYNC_BATCH)) {
      const log = this.parseCallLog(candidate);
      if (!log) {
        receipts.push({ sourceCallId: '?', status: 'rejected', reason: 'malformed_log' });
        continue;
      }
      if (seenInBatch.has(log.sourceCallId)) {
        receipts.push({ sourceCallId: log.sourceCallId, status: 'duplicate', reason: 'duplicate_in_batch' });
        continue;
      }
      seenInBatch.add(log.sourceCallId);

      const callAt = new Date(log.timestamp);
      const match = this.matchCandidate(matchRows, log.phoneNumber);
      if (!match) {
        receipts.push({ sourceCallId: log.sourceCallId, status: 'rejected', reason: 'no_number_match' });
        continue;
      }
      // Guard: if created_at is missing, treat the entity as always-valid rather
      // than silently accepting (new Date(null) === epoch which is always < callAt).
      const assignedAt = match.row.created_at ? new Date(match.row.created_at) : null;
      if (assignedAt && callAt < assignedAt) {
        receipts.push({ sourceCallId: log.sourceCallId, status: 'rejected', reason: 'predates_assignment' });
        continue;
      }
      pending.push({ log, table: match.table, entityId: match.row.id, callAt });
    }

    if (logs.length > MAX_SYNC_BATCH) {
      receipts.push({ sourceCallId: '*', status: 'rejected', reason: `batch_truncated_at_${MAX_SYNC_BATCH}` });
    }

    // Pre-check existing source ids so receipts distinguish duplicates.
    const existing = pending.length > 0 ? await this.findExistingSourceIds(pending.map((p) => p.log.sourceCallId)) : new Set<string>();

    const toInsert = {
      leads: [] as unknown[][],
      agents: [] as unknown[][],
      inbounds: [] as unknown[][],
      assets: [] as unknown[][],
      hr_candidates: [] as unknown[][],
    };
    for (const p of pending) {
      if (existing.has(p.log.sourceCallId)) {
        receipts.push({ sourceCallId: p.log.sourceCallId, status: 'duplicate', reason: 'already_synced' });
        continue;
      }
      const row = [p.entityId, 'call', userId, p.log.duration, p.log.direction, p.log.sourceCallId, toUtcSqlString(p.callAt)];
      (toInsert[p.table as keyof typeof toInsert] as unknown[][]).push(row);
      receipts.push({ sourceCallId: p.log.sourceCallId, status: 'accepted' });
    }

    // Single transaction across all five log tables — all or nothing, so the
    // client checkpoint (advanced only to acked receipts) never diverges.
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();
    let synced = 0;
    try {
      synced += await this.insertCallLogs(queryRunner, 'contact_logs', 'lead_id', toInsert.leads);
      synced += await this.insertCallLogs(queryRunner, 'agent_contact_logs', 'agent_id', toInsert.agents);
      synced += await this.insertCallLogs(queryRunner, 'inbound_contact_logs', 'inbound_id', toInsert.inbounds);
      synced += await this.insertCallLogs(queryRunner, 'asset_contact_logs', 'asset_id', toInsert.assets);
      synced += await this.insertCallLogs(queryRunner, 'hr_contact_logs', 'hr_candidate_id', toInsert.hr_candidates);
      await queryRunner.commitTransaction();
    } catch (e) {
      await queryRunner.rollbackTransaction();
      throw e;
    } finally {
      await queryRunner.release();
    }

    const duplicates = receipts.filter((r) => r.status === 'duplicate').length;
    const rejected = receipts.filter((r) => r.status === 'rejected');
    return { synced, duplicates, rejected, receipts };
  }

  /** Server high-water helper for the repair endpoint: newest acked call per device owner. */
  async repairStatus(userId: number) {
    const rows = await this.dataSource.query(`
      SELECT MAX(created_at) AS newest FROM (
        SELECT created_at FROM contact_logs WHERE sent_by_id = ?
        UNION ALL SELECT created_at FROM agent_contact_logs WHERE sent_by_id = ?
        UNION ALL SELECT created_at FROM inbound_contact_logs WHERE sent_by_id = ?
        UNION ALL SELECT created_at FROM asset_contact_logs WHERE sent_by_id = ?
        UNION ALL SELECT created_at FROM hr_contact_logs WHERE sent_by_id = ?
      ) t
    `, [userId, userId, userId, userId, userId]);
    return { newest_acked_at: rows?.[0]?.newest ?? null };
  }

  private async findExistingSourceIds(ids: string[]): Promise<Set<string>> {
    const found = new Set<string>();
    if (ids.length === 0) return found;
    const tables = ['contact_logs', 'agent_contact_logs', 'inbound_contact_logs', 'asset_contact_logs', 'hr_contact_logs'];
    for (const table of tables) {
      const placeholders = ids.map(() => '?').join(',');
      const rows = await this.dataSource.query(
        `SELECT source_call_id FROM ${table} WHERE source_call_id IN (${placeholders})`,
        ids,
      );
      for (const r of rows) found.add(r.source_call_id);
    }
    return found;
  }

  private async insertCallLogs(queryRunner: QueryRunner, table: string, entityColumn: string, values: unknown[][]) {
    if (!values.length) return 0;
    const placeholders = values.map(() => '(?, ?, ?, ?, ?, ?, ?)').join(', ');
    await queryRunner.query(
      `INSERT INTO ${table} (${entityColumn}, contact_type, sent_by_id, call_duration, call_direction, source_call_id, created_at)\n       VALUES ${placeholders} ON DUPLICATE KEY UPDATE id = id`,
      values.flat(),
    );
    // MySQL's affectedRows returns 2 for ON DUPLICATE KEY matched rows, making
    // the count unreliable. Since duplicates are filtered upstream by
    // findExistingSourceIds, every row in `values` is a genuine new insert.
    return values.length;
  }

  private parseCallLog(candidate: unknown): IncomingCallLog | null {
    if (!candidate || typeof candidate !== 'object') return null;
    const log = candidate as Record<string, unknown>;
    const sourceCallId = typeof log.sourceCallId === 'string' ? log.sourceCallId.trim() : '';
    const phoneNumber = typeof log.phoneNumber === 'string' ? log.phoneNumber.trim() : '';
    const duration = log.duration;
    const timestamp = typeof log.timestamp === 'string' ? log.timestamp : '';
    if (!sourceCallId || sourceCallId.length > 255 || !phoneNumber || !['Incoming', 'Outgoing', 'Missed'].includes(log.direction as string) || !Number.isInteger(duration) || (duration as number) < 0 || Number.isNaN(new Date(timestamp).getTime())) return null;
    return { sourceCallId, phoneNumber, direction: log.direction as CallDirection, duration: duration as number, timestamp };
  }

  private parseDeviceReport(body: unknown): DeviceReport | null {
    if (!body || typeof body !== 'object') return null;
    const value = body as Record<string, unknown>;
    const text = (key: string, max: number) => typeof value[key] === 'string' ? value[key].trim().slice(0, max) : '';
    const event = value.event;
    const deviceId = text('deviceId', 255);
    if (!deviceId || deviceId.length < 8 || !['app_open', 'sync_started', 'sync_success', 'sync_error', 'permission_denied'].includes(event as string)) return null;
    const count = typeof value.syncedCount === 'number' && Number.isInteger(value.syncedCount) && value.syncedCount >= 0 ? value.syncedCount : 0;
    return {
      deviceId,
      deviceModel: text('deviceModel', 255) || 'Unknown device',
      androidVersion: text('androidVersion', 100) || 'Unknown Android',
      appVersion: text('appVersion', 100) || 'Unknown version',
      callLogPermission: value.callLogPermission === true,
      event: event as LoggerEvent,
      syncedCount: count,
      error: text('error', 500) || null,
    };
  }

  async getGlobalFeed() {
    return this.dataSource.query(`
      SELECT 'Lead' as entity_type, l.id as entity_id, l.name as entity_name, c.contact_type, c.call_duration, c.call_direction, c.created_at, u.name as staff_name FROM contact_logs c JOIN leads l ON c.lead_id = l.id LEFT JOIN users u ON c.sent_by_id = u.id
      UNION ALL SELECT 'Agent', a.id, a.name, ac.contact_type, ac.call_duration, ac.call_direction, ac.created_at, u.name FROM agent_contact_logs ac JOIN agents a ON ac.agent_id = a.id LEFT JOIN users u ON ac.sent_by_id = u.id
      UNION ALL SELECT 'Inbound', i.id, i.property_title, ic.contact_type, ic.call_duration, ic.call_direction, ic.created_at, u.name FROM inbound_contact_logs ic JOIN inbounds i ON ic.inbound_id = i.id LEFT JOIN users u ON ic.sent_by_id = u.id
      UNION ALL SELECT 'Asset', ast.id, ast.owner_name, acl.contact_type, acl.call_duration, acl.call_direction, acl.created_at, u.name FROM asset_contact_logs acl JOIN assets ast ON acl.asset_id = ast.id LEFT JOIN users u ON acl.sent_by_id = u.id
      UNION ALL SELECT 'HR', h.id, h.name, hc.contact_type, hc.call_duration, hc.call_direction, hc.created_at, u.name FROM hr_contact_logs hc JOIN hr_candidates h ON hc.hr_candidate_id = h.id LEFT JOIN users u ON hc.sent_by_id = u.id
      ORDER BY created_at DESC LIMIT 100
    `);
  }
}
