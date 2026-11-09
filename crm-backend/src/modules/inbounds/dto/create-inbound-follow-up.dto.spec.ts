import { ValidationPipe } from '@nestjs/common';
import { CreateInboundFollowUpDto } from './create-inbound-follow-up.dto';

describe('CreateInboundFollowUpDto', () => {
  const pipe = new ValidationPipe({ whitelist: true, transform: true });
  const run = (body: object) => pipe.transform(body, { type: 'body', metatype: CreateInboundFollowUpDto });

  it('keeps the camelCase fields the pages send', async () => {
    const out = await run({ contactedVia: 'call', followUpDate: '2026-11-04', nextFollowUpDate: '2026-11-10', nextFollowUpTime: '10:00', priority: 'high', notes: 'Owner agreed' });
    expect(out).toMatchObject({ contactedVia: 'call', followUpDate: '2026-11-04', nextFollowUpDate: '2026-11-10', nextFollowUpTime: '10:00' });
  });

  it('accepts an empty next date', async () => {
    await expect(run({ contactedVia: 'call', nextFollowUpDate: '' })).resolves.toMatchObject({ nextFollowUpDate: '' });
  });
});
