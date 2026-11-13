import { RecordEventsService } from './record-events.service';

const service = () => {
  const query = jest.fn(async (_sql: string, _params: unknown[]) => []);
  return { query, svc: new RecordEventsService({ query } as never) };
};

describe('RecordEventsService.recordChanges', () => {
  it('records only fields that really changed, comparing decimals as numbers', async () => {
    const { query, svc } = service();
    await svc.recordChanges('inbound', 7, 3,
      { total_rent: '15000.00', city: 'Chennai', bhk: null },
      { total_rent: 15000, city: 'Coimbatore', bhk: '' },
      ['total_rent', 'city', 'bhk']);
    expect(query).toHaveBeenCalledTimes(1);
    const params = query.mock.calls[0][1];
    expect(params).toEqual(['inbound', 7, 3, 'field_changed', 'city', 'Chennai', 'Coimbatore', null]);
  });

  it('keeps contact values out of the history', async () => {
    const { query, svc } = service();
    await svc.recordChanges('inbound', 7, 3, { mobile_number: '9000000001' }, { mobile_number: '9000000002' }, ['mobile_number'], ['mobile_number']);
    const params = query.mock.calls[0][1];
    expect(params).toEqual(['inbound', 7, 3, 'field_changed', 'mobile_number', null, null, '{"hidden":true}']);
  });

  it('writes nothing when nothing changed', async () => {
    const { query, svc } = service();
    await svc.recordChanges('inbound', 7, 3, { purpose: 'Rent' }, { purpose: 'Rent' }, ['purpose']);
    expect(query).not.toHaveBeenCalled();
  });
});
