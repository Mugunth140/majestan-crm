import { ValidationPipe } from '@nestjs/common';
import { CreateLeadDto } from './create-lead.dto';

describe('CreateLeadDto whitelist', () => {
  const pipe = new ValidationPipe({ whitelist: true, transform: true });

  it('keeps the self-assign userId from the new-lead form payload', async () => {
    const payload = {
      userId: 42,
      name: 'Self Assigned',
      mobile: '9876543210',
      source: 'Website',
      propertyType: 'apartment',
    };

    const result = (await pipe.transform(payload, {
      type: 'body',
      metatype: CreateLeadDto,
    })) as any;

    expect(result.userId).toBe(42);
  });

  it('keeps follow-up scheduling fields from the new-lead form payload', async () => {
    const payload = {
      name: 'Follow Up Lead',
      mobile: '9876543211',
      followUpDate: '2026-09-26',
      followUpTime: '10:00',
      priority: 'high',
      notes: 'Call back',
    };

    const result = (await pipe.transform(payload, {
      type: 'body',
      metatype: CreateLeadDto,
    })) as any;

    expect(result.followUpDate).toBe('2026-09-26');
    expect(result.priority).toBe('high');
  });
});
