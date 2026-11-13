jest.mock('@nestjs/axios', () => ({ HttpService: class HttpService {} }));
import { BadRequestException } from '@nestjs/common';
import {
  missingField,
  renderTemplate,
  simplifyTemplate,
  templateComponents,
} from './whatsapp-templates';
import { WhatsappSendService, whatsappNumber } from './whatsapp-send.service';

const visitTemplate = {
  name: 'site_visit',
  language: 'en',
  status: 'APPROVED',
  category: 'UTILITY',
  components: [
    {
      type: 'HEADER',
      format: 'TEXT',
      text: 'Visit on {{1}}',
      example: { header_text: ['Saturday'] },
    },
    {
      type: 'BODY',
      text: 'Hi {{1}}, your visit to {{2}} is confirmed.',
      example: { body_text: [['Ravi', 'Majestan Greens']] },
    },
    { type: 'FOOTER', text: 'Majestan Realty' },
    { type: 'BUTTONS', buttons: [{ type: 'QUICK_REPLY', text: 'Reschedule' }] },
  ],
};

describe('WhatsApp templates', () => {
  it('reads the header, body, footer, buttons and fields with examples', () => {
    const t = simplifyTemplate(visitTemplate)!;
    expect(t).toMatchObject({
      name: 'site_visit',
      header: 'Visit on {{1}}',
      footer: 'Majestan Realty',
      buttons: ['Reschedule'],
      named: false,
      supported: true,
    });
    expect(t.fields).toEqual([
      { id: 'header:1', part: 'header', key: '1', example: 'Saturday' },
      { id: 'body:1', part: 'body', key: '1', example: 'Ravi' },
      { id: 'body:2', part: 'body', key: '2', example: 'Majestan Greens' },
    ]);
  });

  it('fills header and body separately and builds Meta’s components', () => {
    const t = simplifyTemplate(visitTemplate)!;
    const values = {
      'header:1': 'Sunday',
      'body:1': 'Anu',
      'body:2': ' Palm Villas ',
    };
    expect(renderTemplate(t, values)).toBe(
      'Visit on Sunday\n\nHi Anu, your visit to Palm Villas is confirmed.\n\nMajestan Realty',
    );
    expect(templateComponents(t, values)).toEqual([
      { type: 'header', parameters: [{ type: 'text', text: 'Sunday' }] },
      {
        type: 'body',
        parameters: [
          { type: 'text', text: 'Anu' },
          { type: 'text', text: 'Palm Villas' },
        ],
      },
    ]);
    expect(missingField(t, { 'header:1': 'Sunday', 'body:1': 'Anu' })?.id).toBe(
      'body:2',
    );
  });

  it('sends named parameters by name', () => {
    const t = simplifyTemplate({
      name: 'welcome',
      language: 'en_US',
      parameter_format: 'NAMED',
      components: [
        {
          type: 'BODY',
          text: 'Hello {{customer_name}}',
          example: {
            body_text_named_params: [
              { param_name: 'customer_name', example: 'Ravi' },
            ],
          },
        },
      ],
    })!;
    expect(t.fields).toEqual([
      {
        id: 'body:customer_name',
        part: 'body',
        key: 'customer_name',
        example: 'Ravi',
      },
    ]);
    expect(templateComponents(t, { 'body:customer_name': 'Anu' })).toEqual([
      {
        type: 'body',
        parameters: [
          { type: 'text', text: 'Anu', parameter_name: 'customer_name' },
        ],
      },
    ]);
  });

  it('marks templates needing a file or a code button as not sendable', () => {
    expect(
      simplifyTemplate({
        name: 'promo',
        language: 'en',
        components: [
          { type: 'HEADER', format: 'IMAGE' },
          { type: 'BODY', text: 'New launch' },
        ],
      })!.supported,
    ).toBe(false);
    expect(
      simplifyTemplate({
        name: 'otp',
        language: 'en',
        components: [
          { type: 'BODY', text: 'Code' },
          { type: 'BUTTONS', buttons: [{ type: 'COPY_CODE', text: 'Copy' }] },
        ],
      })!.supported,
    ).toBe(false);
    expect(simplifyTemplate({ language: 'en' })).toBeNull();
  });
});

describe('whatsappNumber', () => {
  it('adds India’s code to 10-digit numbers and prefers the WhatsApp number', () => {
    expect(
      whatsappNumber({ mobile_number: '098765 43210', whatsapp_number: null }),
    ).toBe('919876543210');
    expect(
      whatsappNumber({
        mobile_number: '9876543210',
        whatsapp_number: '+971 50 123 4567',
      }),
    ).toBe('971501234567');
    expect(
      whatsappNumber({ mobile_number: '12345', whatsapp_number: '' }),
    ).toBeNull();
  });
});

describe('WhatsappSendService', () => {
  const lead = {
    id: 7,
    name: 'Ravi',
    mobile_number: '9876543210',
    whatsapp_number: null,
  };
  const setup = (secondsLeft: number | null) => {
    const query = jest.fn((sql: string, _params?: unknown[]) => {
      if (sql.includes('FROM leads')) return Promise.resolve([lead]);
      if (sql.includes('TIMESTAMPDIFF'))
        return Promise.resolve([{ last: null, left: secondsLeft }]);
      return Promise.resolve({ affectedRows: 1 });
    });
    const whatsapp = {
      isConfigured: () => true,
      templates: jest.fn().mockResolvedValue([simplifyTemplate(visitTemplate)]),
      deliver: jest.fn().mockResolvedValue('wamid.out1'),
    };
    const service = new WhatsappSendService(
      { query } as never,
      whatsapp as never,
    );
    return { service, query, whatsapp };
  };
  const staff = { id: 3, role: 'Staff' };

  it('only lets staff reach their own leads', async () => {
    const { service, query } = setup(null);
    await service.window(staff, 7);
    expect(query.mock.calls[0][0]).toContain('l.assigned_staff_id = 3');
    await service.window({ id: 1, role: 'Admin' }, 7);
    expect(query.mock.calls[2][0]).not.toContain('assigned_staff_id');
  });

  it('refuses free text outside the 24-hour window', async () => {
    const { service, whatsapp } = setup(null);
    await expect(
      service.send(staff, 7, { text: 'Hello' }),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(whatsapp.deliver).not.toHaveBeenCalled();
  });

  it('sends free text inside the window and logs it on the lead as the sender', async () => {
    const { service, query, whatsapp } = setup(3600);
    expect((await service.window(staff, 7)).open).toBe(true);
    await service.send(staff, 7, { text: ' On my way ' });
    expect(whatsapp.deliver).toHaveBeenCalledWith('919876543210', {
      type: 'text',
      text: { preview_url: false, body: 'On my way' },
    });
    const log = query.mock.calls.find(([sql]) =>
      sql.includes('INTO contact_logs'),
    )!;
    expect(log[1]).toEqual([7, null, 'On my way', 3, 'wa:wamid.out1']);
  });

  it('sends a template with its values and requires every field', async () => {
    const { service, query, whatsapp } = setup(null);
    await expect(
      service.send(staff, 7, {
        template_name: 'site_visit',
        values: { 'header:1': 'Sunday', 'body:1': 'Ravi' },
      }),
    ).rejects.toThrow('{{2}}');
    await service.send(staff, 7, {
      template_name: 'site_visit',
      template_language: 'en',
      values: {
        'header:1': 'Sunday',
        'body:1': 'Ravi',
        'body:2': 'Palm Villas',
        ignored: 5,
      },
    });
    const [to, sent] = whatsapp.deliver.mock.calls[0] as [
      string,
      { type: string; template: { name: string; language: unknown } },
    ];
    expect(to).toBe('919876543210');
    expect(sent.type).toBe('template');
    expect(sent.template).toMatchObject({
      name: 'site_visit',
      language: { code: 'en' },
    });
    const stored = query.mock.calls.find(([sql]) =>
      sql.includes('INSERT INTO whatsapp_messages'),
    )!;
    expect(stored[1]).toEqual([
      'wamid.out1',
      '919876543210',
      7,
      'template',
      'Visit on Sunday\n\nHi Ravi, your visit to Palm Villas is confirmed.\n\nMajestan Realty',
    ]);
  });
});
