jest.mock('@nestjs/axios', () => ({ HttpService: class HttpService {} }));
import { SmsService } from './sms.service';
import { of, throwError } from 'rxjs';
function setup(config: Record<string, string> = {}) {
 const http = { post: jest.fn(() => of({ data: 'OK' })) };
 const service = new SmsService({ get: (key: string, fallback: string) => config[key] ?? fallback } as any, http as any);
 return { service, http };
}
it('skips unconfigured SMS without contacting a provider', async () => {
 const { service, http } = setup(); expect(await service.sendSms('synthetic-recipient', 'Interview reminder')).toBe(false); expect(http.post).not.toHaveBeenCalled();
});
it('uses only the supplied HTTP client for configured SMS', async () => {
 const { service, http } = setup({ SMS_API_KEY: 'synthetic-key', SMS_API_URL: 'https://sms.invalid' });
 expect(await service.sendSms('synthetic-recipient', 'Interview reminder', 'template-7')).toBe(true);
 expect(http.post).toHaveBeenCalledWith('https://sms.invalid', expect.any(URLSearchParams), expect.any(Object));
});
it('returns failure when the provider rejects SMS', async () => {
 const { service, http } = setup({ SMS_API_KEY: 'synthetic-key' }); http.post.mockReturnValue(throwError(() => new Error('Provider rejected')));
 expect(await service.sendSms('synthetic-recipient', 'Interview reminder')).toBe(false);
});
