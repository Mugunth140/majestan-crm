import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { validateSync } from 'class-validator';
import { CreateAssetDto } from './dto/create-asset.dto';
import { visitFields } from './asset-visit';

describe('asset site-visit fields', () => {
  it('survive validation (they were stripped before)', () => {
    const dto = plainToInstance(CreateAssetDto, { visited_date: '2026-11-04', site_visited_done: 'Arun', checked_by: 'Priya', approved_by: 'MD' });
    expect(validateSync(dto, { whitelist: true })).toEqual([]);
    expect(dto).toMatchObject({ visited_date: '2026-11-04', site_visited_done: 'Arun', checked_by: 'Priya', approved_by: 'MD' });
  });

  it('copies only what was sent and clears empty values', () => {
    expect(visitFields({ checked_by: 'Priya' } as CreateAssetDto)).toEqual({ checked_by: 'Priya' });
    expect(visitFields({ visited_date: '', approved_by: null } as CreateAssetDto)).toEqual({ visited_date: null, approved_by: null });
    expect(visitFields({ owner_name: 'X' } as CreateAssetDto)).toEqual({});
  });
});
