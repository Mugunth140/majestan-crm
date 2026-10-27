import { ContactLogsService } from './contact-logs.service';

// Colleague's number also stored on an HR candidate (e.g. a hired candidate).
const STAFF_NUMBER = '+91 93800 00093';
const CANDIDATE_NUMBER = '9876543210';
const since = '2026-09-01T00:00:00Z';
const CANDIDATES = [
  { id: 3, mobile: '9380000093', whatsapp: null, created_at: since, status: 'Interview Scheduled' },
  { id: 4, mobile: CANDIDATE_NUMBER, whatsapp: null, created_at: since, status: 'Hold' },
  { id: 5, mobile: '9000000005', whatsapp: null, created_at: since, status: 'Joined' },
  { id: 6, mobile: '9000000006', whatsapp: null, created_at: since, status: 'Rejected' },
];

function makeService() {
  const inserted: { sql: string; params: unknown[] }[] = [];
  const query = jest.fn(async (sql: string) => {
    if (sql.includes('FROM users WHERE is_active = 1')) return [{ phone: STAFF_NUMBER, whatsapp_no: null }];
    if (sql.includes('FROM hr_candidates')) {
      // Honour the service's status filter so closed candidates drop out.
      const excluded = /status NOT IN \(([^)]*)\)/.exec(sql)?.[1] ?? '';
      return CANDIDATES.filter((c) => !excluded.includes(`'${c.status}'`));
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
  it('stops tracking candidates once hiring ends (Joined or Rejected), not on Hold', async () => {
    const { service } = makeService();
    const result = await service.syncCallLogs(14, [call('j', '9000000005'), call('r', '9000000006'), call('h', CANDIDATE_NUMBER)]);
    expect(result.receipts).toEqual([
      { sourceCallId: 'j', status: 'rejected', reason: 'no_number_match' },
      { sourceCallId: 'r', status: 'rejected', reason: 'no_number_match' },
      { sourceCallId: 'h', status: 'accepted' },
    ]);
  });

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
