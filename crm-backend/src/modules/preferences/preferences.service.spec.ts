import { BadRequestException } from '@nestjs/common';
import { PreferencesService } from './preferences.service';

const setup = (rows: unknown[] = []) => {
  const query = jest.fn().mockResolvedValue(rows);
  return { service: new PreferencesService({ query } as never), query };
};

describe('PreferencesService', () => {
  it('only reads the given user’s rows, by prefix', async () => {
    const { service, query } = setup([
      { pref_key: 'columns.leads.main', value: '{"hidden":["mobile"]}' },
    ]);
    expect(await service.list(4, 'columns.')).toEqual({
      'columns.leads.main': { hidden: ['mobile'] },
    });
    expect(query.mock.calls[0][1]).toEqual([4, 'columns.%']);
  });

  it('saves a value for the user and key', async () => {
    const { service, query } = setup();
    await service.set(4, 'columns.leads.main', { hidden: ['mobile'] });
    expect(query.mock.calls[0][1]).toEqual([
      4,
      'columns.leads.main',
      '{"hidden":["mobile"]}',
    ]);
  });

  it('rejects odd keys and oversized values', async () => {
    const { service } = setup();
    await expect(service.set(4, 'bad key!', 1)).rejects.toBeInstanceOf(
      BadRequestException,
    );
    await expect(
      service.set(4, 'columns.x', 'x'.repeat(20_000)),
    ).rejects.toBeInstanceOf(BadRequestException);
  });
});

describe('PreferencesService reset', () => {
  it('removes the setting when saved empty', async () => {
    const { service, query } = setup();
    await service.set(4, 'columns.leads.main', {});
    expect(query.mock.calls[0][0]).toContain('DELETE FROM user_preferences');
    expect(query.mock.calls[0][1]).toEqual([4, 'columns.leads.main']);
  });
});
