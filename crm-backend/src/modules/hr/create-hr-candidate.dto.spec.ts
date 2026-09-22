import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { validateSync } from 'class-validator';
import { CreateHrCandidateDto } from './dto/create-hr-candidate.dto';

const base = {
  name: 'Jane',
  mobile: '9876543210',
  department: 'Telecalling',
  position: 'Executive',
};

describe('CreateHrCandidateDto interviewDate', () => {
  it.each([[null], ['2026-10-01'], [undefined]])(
    'accepts interviewDate=%j',
    (interviewDate: any) => {
      const dto = plainToInstance(CreateHrCandidateDto, { ...base, interviewDate });
      expect(validateSync(dto as any)).toEqual([]);
    },
  );

  it('rejects a non-date interviewDate', () => {
    const dto = plainToInstance(CreateHrCandidateDto, { ...base, interviewDate: 'not-a-date' });
    const errors = validateSync(dto as any);
    expect(errors.some((e) => e.property === 'interviewDate')).toBe(true);
  });
});
