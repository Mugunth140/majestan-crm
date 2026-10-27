import { ContactLogsService } from './contact-logs.service';

// Colleague's number also stored on an HR candidate (e.g. a hired candidate).
const STAFF_NUMBER = '+91 93800 00093';
const CANDIDATE_NUMBER = '9876543210';

function makeService() {
  const inserted: { sql: string; params: unknown[] }[] = [];
  const query = jest.fn(async (sql: string) => {
    if (sql.includes('FROM users WHERE is_active = 1')) return [{ phone: STAFF_NUMBER, whatsapp_no: null }];
    if (sql.includes('FROM hr_candidates')) {
      return [
        { id: 3, mobile: '9380000093', whatsapp: null, created_at: '2026-09-01T00:00:00Z' },
        { id: 4, mobile: CANDIDATE_NUMBER, whatsapp: null, created_at: '2026-09-01T00:00:00Z' },
      ];
    }
    return [];
  });
  const queryRunner = {
    connect: jest.fn(), startTransaction: jest.fn(), commitTransaction: jest.fn(),
    rollbackTransaction: jest.fn(), release: jest.fn(),
    query: jest.fn(async (sql: string, params: unknown[]) => { inserted.push({ sql, params }); }),
  };
  const dataSource = { query, createQueryRunner: () => queryRunner } as any;
  const userRepo = { findOne: jest.fn(async () => ({ id: 14, role: { name: 'Staff' } })) } as any;
  return { service: new ContactLogsService(userRepo, dataSource), inserted };
}

const call = (sourceCallId: string, phoneNumber: string) => ({
  sourceCallId, phoneNumber, direction: 'Outgoing', duration: 30, timestamp: '2026-10-20T10:00:00Z',
});

describe('ContactLogsService staff-number guard', () => {
  it('leaves colleagues out of the device whitelist', async () => {
    const { service } = makeService();
    const numbers = (await service.getTrackableNumbers(14)).map((n) => n.number);
    expect(numbers).toEqual([CANDIDATE_NUMBER]);
  });

  it('rejects calls to a colleague even when the number is on a candidate', async () => {
    const { service, inserted } = makeService();
    const result = await service.syncCallLogs(14, [call('a', '09380000093'), call('b', CANDIDATE_NUMBER)]);
    expect(result.receipts).toEqual([
      { sourceCallId: 'a', status: 'rejected', reason: 'staff_number' },
      { sourceCallId: 'b', status: 'accepted' },
    ]);
    expect(inserted).toHaveLength(1);
    expect(inserted[0].sql).toContain('hr_contact_logs');
    expect(inserted[0].params[0]).toBe(4);
  });
});
