import { html, SafeHtml } from './html';
import { BRAND } from './blocks';
import { htmlToPlainText } from './template';

export const COMPANY = {
  name: 'Majestan Realty',
  tagline: 'Connecting Assets',
  address: '47/1 Aandal Street, Lakshmipuram Main Rd, Hope College, Coimbatore, Tamil Nadu 641004',
  phone: '+91 90929 65556',
  website: 'https://www.majestanrealty.com',
  logo: 'https://www.majestanrealty.com/assets/images/logo/logo.png',
};

export interface RenderedMail {
  subject: string;
  html: string;
  text: string;
}

export interface LayoutInput {
  subject: string;
  /** Sanitized, variable-filled body HTML. */
  bodyHtml: string;
  /** Short line shown by mail clients next to the subject. */
  preheader?: string;
  /** Optional personal note from the sender, shown above the signature. */
  note?: string | null;
  /** Lines under "Regards," (escaped), e.g. ["Priya", "Sales Team", "+91 …"]. */
  signature: string[];
}

/** The branded frame every CRM email is sent in. */
export function renderLayout(input: LayoutInput): RenderedMail {
  const note = input.note?.trim();
  const preheader = (input.preheader ?? '').trim();
  const signature = input.signature.filter(Boolean);
  const out = html`<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="light only"><meta name="supported-color-schemes" content="light"><title>${input.subject}</title>
<style>a{color:${BRAND.navy}}p{margin:0 0 14px}ul,ol{margin:0 0 14px;padding-left:22px}h2,h3{color:${BRAND.ink};margin:0 0 10px}@media (max-width:620px){.px{padding-left:20px!important;padding-right:20px!important}}</style></head>
<body style="margin:0;padding:0;background:#eef1f6;-webkit-text-size-adjust:100%">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent">${preheader}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#eef1f6"><tbody><tr><td align="center" style="padding:28px 12px">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;background:#ffffff;border-radius:14px;overflow:hidden;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif"><tbody>
<tr><td class="px" style="padding:26px 36px 20px"><a href="${COMPANY.website}" target="_blank" rel="noopener noreferrer"><img src="${COMPANY.logo}" width="200" alt="${COMPANY.name}" style="display:block;width:200px;max-width:60%;height:auto;border:0"></a></td></tr>
<tr><td style="padding:0 36px" class="px"><div style="height:3px;background:${BRAND.gold};border-radius:2px;line-height:3px;font-size:0">&nbsp;</div></td></tr>
<tr><td class="px" style="padding:28px 36px 6px;font-size:16px;line-height:1.65;color:${BRAND.ink}">${new SafeHtml(input.bodyHtml)}</td></tr>
${note ? html`<tr><td class="px" style="padding:0 36px 14px"><div style="border-left:3px solid ${BRAND.gold};background:#fffbea;padding:12px 16px;border-radius:6px;font-size:15px;line-height:1.6;color:${BRAND.ink};white-space:pre-line">${note}</div></td></tr>` : ''}
<tr><td class="px" style="padding:6px 36px 30px;font-size:15px;line-height:1.6;color:${BRAND.ink}">Regards,<br>${signature.map((line, i) => (i === 0 ? html`<strong>${line}</strong>` : html`<br><span style="color:${BRAND.muted}">${line}</span>`))}</td></tr>
<tr><td class="px" style="padding:20px 36px 24px;background:${BRAND.navy};font-size:12px;line-height:1.7;color:#c9d3ea"><strong style="color:#ffffff">${COMPANY.name}</strong> · ${COMPANY.tagline}<br>${COMPANY.address}<br><a href="tel:+919092965556" style="color:#ffffff;text-decoration:none">${COMPANY.phone}</a> · <a href="${COMPANY.website}" target="_blank" rel="noopener noreferrer" style="color:#ffffff;text-decoration:none">www.majestanrealty.com</a></td></tr>
</tbody></table></td></tr></tbody></table></body></html>`;

  const text = [
    htmlToPlainText(input.bodyHtml),
    note ? `\n${note}` : '',
    `\nRegards,\n${signature.join('\n')}`,
    `\n--\n${COMPANY.name} · ${COMPANY.tagline}\n${COMPANY.address}\n${COMPANY.phone} · www.majestanrealty.com`,
  ].join('\n');
  return { subject: input.subject.replace(/[\r\n]+/g, ' ').trim(), html: out.value, text };
}
