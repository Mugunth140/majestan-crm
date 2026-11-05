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

const FONT = "-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif";
const PAGE_BG = '#f3f5f9';

/**
 * The branded frame every CRM email is sent in: a navy brand strip, the logo,
 * the message, one signature shape for every sender, and a quiet footer with
 * the company's details. Table-based so it holds up in Outlook and Gmail.
 */
export function renderLayout(input: LayoutInput): RenderedMail {
  const note = input.note?.trim();
  const preheader = (input.preheader ?? '').trim();
  const [signer, ...signatureRest] = input.signature.filter(Boolean);
  const out = html`<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="light only"><meta name="supported-color-schemes" content="light"><title>${input.subject}</title>
<style>a{color:${BRAND.navy}}p{margin:0 0 16px}ul,ol{margin:0 0 16px;padding-left:22px}li{margin:0 0 6px}h2,h3{color:${BRAND.ink};margin:0 0 12px;line-height:1.35}@media (max-width:620px){.px{padding-left:22px!important;padding-right:22px!important}.outer{padding:0!important}.card{border-radius:0!important;border-left:0!important;border-right:0!important}.dl-label,.dl-value{display:block!important;width:auto!important;padding-left:18px!important;padding-right:18px!important}.dl-label{padding-bottom:0!important}.dl-value{padding-top:2px!important}}</style></head>
<body style="margin:0;padding:0;background:${PAGE_BG};-webkit-text-size-adjust:100%">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent">${preheader}&#8203;&#160;&#8203;&#160;&#8203;&#160;&#8203;&#160;&#8203;&#160;</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${PAGE_BG}"><tbody><tr><td align="center" class="outer" style="padding:32px 12px">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" class="card" style="max-width:600px;background:#ffffff;border:1px solid ${BRAND.line};border-radius:12px;overflow:hidden;font-family:${FONT}"><tbody>
<tr><td style="height:4px;line-height:4px;font-size:0;background:${BRAND.navy}">&nbsp;</td></tr>
<tr><td class="px" style="padding:28px 40px 24px;border-bottom:1px solid ${BRAND.line}"><a href="${COMPANY.website}" target="_blank" rel="noopener noreferrer"><img src="${COMPANY.logo}" width="180" alt="${COMPANY.name}" style="display:block;width:180px;max-width:60%;height:auto;border:0"></a></td></tr>
<tr><td class="px" style="padding:32px 40px 8px;font-size:15px;line-height:1.7;color:${BRAND.ink}">${new SafeHtml(input.bodyHtml)}</td></tr>
${note ? html`<tr><td class="px" style="padding:0 40px 16px"><div style="border-left:3px solid ${BRAND.navy};background:${BRAND.soft};padding:12px 16px;border-radius:0 8px 8px 0;font-size:14px;line-height:1.65;color:${BRAND.ink};white-space:pre-line">${note}</div></td></tr>` : ''}
<tr><td class="px" style="padding:8px 40px 36px;font-size:15px;line-height:1.6;color:${BRAND.ink}">Warm regards,<br><strong style="display:inline-block;margin-top:6px">${signer ?? COMPANY.name}</strong>${signatureRest.map((line) => html`<br><span style="font-size:13px;color:${BRAND.muted}">${line}</span>`)}</td></tr>
<tr><td class="px" style="padding:22px 40px 26px;background:${BRAND.soft};border-top:1px solid ${BRAND.line};font-size:12px;line-height:1.7;color:${BRAND.muted}"><strong style="color:${BRAND.navy};font-size:13px">${COMPANY.name}</strong><span style="color:${BRAND.muted}"> · ${COMPANY.tagline}</span><br>${COMPANY.address}<br><a href="tel:+919092965556" style="color:${BRAND.muted};text-decoration:none">${COMPANY.phone}</a> · <a href="${COMPANY.website}" target="_blank" rel="noopener noreferrer" style="color:${BRAND.navy};text-decoration:none">www.majestanrealty.com</a></td></tr>
</tbody></table>
<p style="margin:16px 0 0;font-family:${FONT};font-size:11px;line-height:1.6;color:#9aa3b2">You are receiving this email because you are in touch with ${COMPANY.name}. Reply to this email if you have any questions.</p>
</td></tr></tbody></table></body></html>`;

  const text = [
    htmlToPlainText(input.bodyHtml),
    note ? `\n${note}` : '',
    `\nWarm regards,\n${[signer ?? COMPANY.name, ...signatureRest].join('\n')}`,
    `\n--\n${COMPANY.name} · ${COMPANY.tagline}\n${COMPANY.address}\n${COMPANY.phone} · www.majestanrealty.com`,
  ].join('\n');
  return { subject: input.subject.replace(/[\r\n]+/g, ' ').trim(), html: out.value, text };
}
