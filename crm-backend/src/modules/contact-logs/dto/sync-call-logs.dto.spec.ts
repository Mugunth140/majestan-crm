import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { SyncCallLogsDto } from './sync-call-logs.dto';

describe('SyncCallLogsDto Validation', () => {
  it('should validate correctly with the app payload (sourceCallId, phoneNumber, direction)', async () => {
    const payload = {
      logs: [
        {
          sourceCallId: 'call-123',
          phoneNumber: '+1234567890',
          direction: 'Incoming',
          duration: 120,
          timestamp: '2023-10-10T12:00:00Z'
        }
      ]
    };

    const dto = plainToInstance(SyncCallLogsDto, payload);
    const errors = await validate(dto, { whitelist: true });
    
    // Test exact expected fields to ensure they weren't stripped
    expect(dto.logs[0].sourceCallId).toBe('call-123');
    expect(errors.length).toBe(0);
  });
});