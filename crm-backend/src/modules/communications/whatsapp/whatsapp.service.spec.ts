jest.mock('@nestjs/axios', () => ({ HttpService: class HttpService {} }));
import { WhatsappService } from './whatsapp.service';
import { of, throwError } from 'rxjs';
function setup(config: Record<string, string> = {}) {
 const http = { post: jest.fn(() => of({ data: 'OK' })) };
 return { service: new WhatsappService({ get: (key: string, fallback: string) => config[key] ?? fallback } as any, http as any), http };
}
it('skips unconfigured WhatsApp text and templates without network requests', async () => {
 const { service, http } = setup(); expect(await service.sendTextMessage('synthetic-recipient', 'Reminder')).toBe(false);
 expect(await service.sendTemplateMessage('synthetic-recipient', { name: 'interview' })).toBe(false); expect(http.post).not.toHaveBeenCalled();
});
it('sends templates through the supplied mock HTTP client', async () => {
 const { service, http } = setup({ WHATSAPP_API_TOKEN: 'synthetic-token', WHATSAPP_PHONE_NUMBER_ID: 'test-number' });
 expect(await service.sendTemplateMessage('synthetic-recipient', { name: 'interview', languageCode: 'ta' })).toBe(true);
 expect(http.post).toHaveBeenCalledWith(expect.stringContaining('/test-number/messages'), expect.objectContaining({ template: expect.objectContaining({ name: 'interview', language: { code: 'ta' } }) }), expect.any(Object));
});
it('returns failure when the provider rejects a message', async () => {
 const { service, http } = setup({ WHATSAPP_API_TOKEN: 'synthetic-token', WHATSAPP_PHONE_NUMBER_ID: 'test-number' }); http.post.mockReturnValue(throwError(() => new Error('Provider rejected')));
 expect(await service.sendTextMessage('synthetic-recipient', 'Reminder')).toBe(false);
});
