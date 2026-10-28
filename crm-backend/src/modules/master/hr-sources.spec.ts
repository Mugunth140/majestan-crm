import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { validateSync } from 'class-validator';
import { MasterService } from './master.service';
import { HrSource } from '../../database/entities/hr-source.entity';
import { CreateHrSourceDto, UpdateHrSourceDto } from './dto/hr-source.dto';

describe('HR source master', () => {
  let service: MasterService; let repo: any; let db: any;
  beforeEach(() => {
    repo = { find: jest.fn().mockResolvedValue([]), findOne: jest.fn().mockResolvedValue(null), create: jest.fn(value => value), save: jest.fn(async value => value), delete: jest.fn().mockResolvedValue({ affected: 1 }) };
    db = { getRepository: jest.fn(() => repo), query: jest.fn().mockResolvedValue([{ count: 0 }]) };
    service = new MasterService(db, {} as any, {} as any);
  });
  it('uses the separate HR source entity and supports active-only lists', async () => {
    await service.getHrSources(true);
    expect(db.getRepository).toHaveBeenCalledWith(HrSource);
    expect(repo.find).toHaveBeenCalledWith({ where: { is_active: true }, order: { name: 'ASC' } });
  });
  it('creates a new source and returns an existing matching source without duplicates', async () => {
    expect(await service.createHrSource('Nithra')).toEqual({ name: 'Nithra' });
    repo.findOne.mockResolvedValue({ id: 4, name: 'Nithra' });
    repo.save.mockClear();
    expect(await service.createHrSource('Nithra')).toMatchObject({ id: 4 });
    expect(repo.save).not.toHaveBeenCalled();
  });
  it('allows renaming and deactivation and rejects duplicate names', async () => {
    repo.findOne.mockResolvedValue({ id: 4, name: 'Agency', is_active: true });
    expect(await service.updateHrSource(4, { name: 'New agency', is_active: false })).toMatchObject({ name: 'New agency', is_active: false });
    repo.save.mockRejectedValue({ code: 'ER_DUP_ENTRY' });
    await expect(service.updateHrSource(4, { name: 'Existing agency' })).rejects.toThrow('already exists');
  });
  it('prevents deleting sources referenced by candidates and allows unused-source deletion', async () => {
    db.query.mockResolvedValueOnce([{ count: 2 }]);
    await expect(service.deleteHrSource(4)).rejects.toThrow('Deactivate it instead');
    expect(repo.delete).not.toHaveBeenCalled();
    expect(await service.deleteHrSource(4)).toEqual({ success: true });
  });
  it('validates source names and active flags', () => {
    expect(validateSync(plainToInstance(CreateHrSourceDto, { name: '   ' })).length).toBeGreaterThan(0);
    expect(validateSync(plainToInstance(UpdateHrSourceDto, { name: 'Nithra', is_active: 'false' })).length).toBeGreaterThan(0);
    const valid = plainToInstance(CreateHrSourceDto, { name: '  Nithra  ' });
    expect(validateSync(valid)).toEqual([]);
    expect(valid.name).toBe('Nithra');
  });
});
