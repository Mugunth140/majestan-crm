import { html, SafeHtml, escapeHtml } from './html';

export const COMPANY = {
  name: 'Majestan Realty',
  address: '47/1 Aandal Street, Lakshmipuram Main Rd, Hope College, Coimbatore, Tamil Nadu 641004',
  phone: '+91 90929 65556',
  website: 'https://www.majestanrealty.com',
};

export interface LayoutInput {
  subject: string;
  /** Short line shown by mail clients next to the subject. */
  preheader?: string;
  body: SafeHtml;
  /** Plain-text version of the body (no footer; the layout adds it). */
  text: string;
}

export interface RenderedMail {
  subject: string;
  html: string;
  text: string;
}

/** Wraps a body in the shared branded layout, adds the sender's note and the company footer. */
export function renderLayout(input: LayoutInput, opts: { note?: string | null; signature: string }): RenderedMail {
  const note = opts.note?.trim();
  const noteHtml = note
    ? html`<tr><td style="padding:0 32px 8px"><div style="border-left:3px solid #0052FF;background:#f4f7ff;padding:12px 16px;border-radius:6px;font-size:14px;line-height:1.6;color:#1f2937;white-space:pre-line">${note}</div></td></tr>`
    : '';
  const body = html`<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${input.subject}</title></head>
<body style="margin:0;padding:0;background:#f3f4f6;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif">
<span style="display:none;max-height:0;overflow:hidden;opacity:0">${input.preheader ?? ''}</span>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f3f4f6;padding:24px 12px"><tr><td align="center">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;background:#ffffff;border-radius:12px;overflow:hidden">
<tr><td style="padding:24px 32px;border-bottom:1px solid #e5e7eb;font-size:18px;font-weight:700;color:#111827">${COMPANY.name}</td></tr>
<tr><td style="padding:28px 32px 16px;font-size:15px;line-height:1.65;color:#1f2937">${input.body}</td></tr>
${noteHtml}
<tr><td style="padding:8px 32px 28px;font-size:15px;line-height:1.65;color:#1f2937">Regards,<br>${opts.signature}<br>${COMPANY.name}</td></tr>
<tr><td style="padding:18px 32px;background:#f9fafb;border-top:1px solid #e5e7eb;font-size:12px;line-height:1.6;color:#6b7280">${COMPANY.name} · ${COMPANY.address}<br>${COMPANY.phone} · <a href="${COMPANY.website}" style="color:#6b7280">www.majestanrealty.com</a></td></tr>
</table></td></tr></table></body></html>`;
  const text = [
    input.text.trim(),
    note ? `\n${note}` : '',
    `\nRegards,\n${opts.signature}\n${COMPANY.name}`,
    `\n--\n${COMPANY.name} · ${COMPANY.address}\n${COMPANY.phone} · www.majestanrealty.com`,
  ].join('\n');
  return { subject: input.subject.replace(/[\r\n]+/g, ' ').trim(), html: body.value, text };
}

export { escapeHtml };
