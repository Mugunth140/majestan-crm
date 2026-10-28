import { commonVariables } from '../../mail/core/mail-composer.service';
import type { MailEventDefinition } from '../../mail/core/mail-event';
import { fillHtml, fillText } from '../../mail/render/template';
import { commissionTerms, type PartnerMailData } from './partner.mail-entity';
import { PARTNER_MAIL_EVENTS, partnerIntroductionMail, partnerWelcomeMail } from './partner-mails';

function render(event: MailEventDefinition<PartnerMailData>, d: PartnerMailData) {
  const vars = { ...commonVariables(event.identity, null), ...event.entity.variables(d) };
  const subject = fillText(event.template.subject, vars);
  const body = fillHtml(event.template.body, vars);
  return { subject: subject.text, html: body.html, unknown: [...subject.unknown, ...body.unknown] };
}

const partner = (over: Partial<PartnerMailData> = {}): PartnerMailData => ({
  id: 8, name: 'Suresh Babu', company: 'SB Realtors', email: 'suresh@example.com', status: 'Approved',
  partnerType: 'Individual Broker', city: 'Coimbatore', commission: '2%',
  manager: { name: 'Priya Raman', phone: '+91 98765 43210' },
  ...over,
});

describe('partners@ mail events', () => {
  it('registers two draft emails from partners@', () => {
    expect(PARTNER_MAIL_EVENTS.map((e) => e.key)).toEqual(['partners.introduction', 'partners.welcome']);
    expect(PARTNER_MAIL_EVENTS.every((e) => e.identity === 'partners' && e.entityType === 'agent' && e.module === 'partners' && e.mode === 'confirm')).toBe(true);
  });

  it('only uses fields the partner provides, with and without optional details', () => {
    for (const event of PARTNER_MAIL_EVENTS) {
      expect(render(event, partner()).unknown).toEqual([]);
      expect(render(event, partner({ name: '', company: null, partnerType: null, city: null, commission: null, manager: null })).unknown).toEqual([]);
    }
  });

  it('welcome email shows the agreed terms and escapes names', () => {
    const mail = render(partnerWelcomeMail, partner({ company: '<b>SB</b> Realtors' }));
    expect(mail.subject).toBe('Welcome to the Majestan Realty partner network');
    expect(mail.html).toContain('Dear Suresh,');
    expect(mail.html).toContain('Commission');
    expect(mail.html).toContain('2%');
    expect(mail.html).toContain('Priya Raman · +91 98765 43210');
    expect(mail.html).toContain('&lt;b&gt;SB&lt;/b&gt;');
  });

  it('welcome email needs Approved status and commission terms', () => {
    expect(partnerWelcomeMail.check!(partner())).toEqual([]);
    expect(partnerWelcomeMail.check!(partner({ status: 'Contacted', commission: null }))).toEqual([
      'Partner status is not "Approved"', 'Commission terms are not set (edit the partner and fill in commission)',
    ]);
    expect(partnerWelcomeMail.triggers![0].when!({ entityId: 1, to: 'Approved' })).toBe(true);
    expect(partnerWelcomeMail.triggers![0].when!({ entityId: 1, to: 'Active' })).toBe(false);
  });

  it('introduction falls back without a name or contact person', () => {
    const mail = render(partnerIntroductionMail, partner({ name: '', manager: null }));
    expect(mail.html).toContain('Dear Sir/Madam,');
    expect(mail.html).toContain('Our partnerships team');
  });
});

describe('commissionTerms', () => {
  it('formats percentage and fixed amounts, keeps free text', () => {
    expect(commissionTerms({ commission_accepted: true, commission_type: 'percentage', commission_value: '2' })).toBe('2%');
    expect(commissionTerms({ commission_accepted: true, commission_type: 'percentage', commission_value: '1.5%' })).toBe('1.5%');
    expect(commissionTerms({ commission_accepted: true, commission_type: 'fixed_amount', commission_value: '50000' })).toBe('₹50,000');
    expect(commissionTerms({ commission_accepted: true, commission_type: 'fixed_amount', commission_value: 'One month rent' })).toBe('One month rent');
    expect(commissionTerms({ commission_accepted: false, commission_type: 'percentage', commission_value: '2' })).toBeNull();
    expect(commissionTerms({ commission_accepted: true, commission_type: 'percentage', commission_value: '' })).toBeNull();
  });
});
