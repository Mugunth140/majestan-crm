import { html, safeUrl, SafeHtml } from './html';
import { renderLayout } from './layout';

describe('mail html escaping', () => {
  it('escapes interpolated values but keeps nested html`` fragments', () => {
    const name = '<script>alert(1)</script> & "Ravi"';
    const out = html`<p>${name}</p>${html`<b>${'x<y'}</b>`}`;
    expect(out).toBeInstanceOf(SafeHtml);
    expect(out.value).toBe('<p>&lt;script&gt;alert(1)&lt;/script&gt; &amp; &quot;Ravi&quot;</p><b>x&lt;y</b>');
  });

  it('joins arrays and drops null, undefined and false', () => {
    expect(html`${['a', html`<i>b</i>`]}${null}${undefined}${false}`.value).toBe('a<i>b</i>');
  });

  it('allows only http(s) links', () => {
    expect(safeUrl('https://meet.google.com/abc')).toBe('https://meet.google.com/abc');
    expect(safeUrl('javascript:alert(1)')).toBeNull();
    expect(safeUrl('not a url')).toBeNull();
    expect(safeUrl(null)).toBeNull();
  });
});

describe('branded layout', () => {
  it('frames the body with the logo, signature, escaped note and footer', () => {
    const mail = renderLayout({
      subject: 'Hello\r\nBcc: evil@x.com',
      bodyHtml: '<p>Body</p>',
      note: 'Bring <b>certificates</b>',
      signature: ['Priya', 'HR Team, Majestan Realty', ''],
    });
    expect(mail.subject).toBe('Hello Bcc: evil@x.com');
    expect(mail.html).toContain('assets/images/logo/logo.png');
    expect(mail.html).toContain('<p>Body</p>');
    expect(mail.html).toContain('Bring &lt;b&gt;certificates&lt;/b&gt;');
    expect(mail.html).toContain('<strong>Priya</strong>');
    expect(mail.html).toContain('47/1 Aandal Street');
    expect(mail.text).toContain('Body');
    expect(mail.text).toContain('Regards,\nPriya\nHR Team, Majestan Realty');
  });
});
