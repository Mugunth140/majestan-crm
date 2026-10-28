import { html, safeUrl, SafeHtml } from './html';

/** Brand colours from the website (navy #27427f, gold #ffc900). */
export const BRAND = { navy: '#27427f', gold: '#ffc900', ink: '#1f2937', muted: '#6b7280', line: '#e5e7eb', soft: '#f5f7fb' };

/**
 * A facts card: label/value rows on a soft background. Table-based so it holds
 * up in Outlook; values may be text (escaped) or other blocks.
 */
export function detailsCard(rows: [string, string | SafeHtml | null | undefined][]): SafeHtml {
  const visible = rows.filter(([, value]) => value !== null && value !== undefined && value !== '');
  if (!visible.length) return html``;
  return html`<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:20px 0;border-collapse:separate;background:${BRAND.soft};border:1px solid ${BRAND.line};border-radius:10px"><tbody>
${visible.map(
  ([label, value], i) =>
    html`<tr><td style="padding:${i === 0 ? '16px' : '6px'} 8px ${i === visible.length - 1 ? '16px' : '6px'} 20px;width:132px;font-size:13px;color:${BRAND.muted};vertical-align:top;white-space:nowrap">${label}</td><td style="padding:${i === 0 ? '16px' : '6px'} 20px ${i === visible.length - 1 ? '16px' : '6px'} 8px;font-size:15px;font-weight:600;color:${BRAND.ink};vertical-align:top">${value}</td></tr>`,
)}
</tbody></table>`;
}

/** A navy "bulletproof" button (renders in Outlook too). Nothing for non-http(s) URLs. */
export function button(label: string, url: string | null | undefined): SafeHtml {
  const href = safeUrl(url);
  if (!href) return html``;
  return html`<table role="presentation" cellpadding="0" cellspacing="0" style="margin:8px 0 20px"><tbody><tr><td bgcolor="${BRAND.navy}" style="border-radius:8px;background:${BRAND.navy}"><a href="${href}" target="_blank" rel="noopener noreferrer" style="display:inline-block;padding:12px 22px;font-size:15px;font-weight:600;color:#ffffff;text-decoration:none;border-radius:8px">${label}</a></td></tr></tbody></table>`;
}

/** A plain link for use inside card values. */
export function link(label: string, url: string | null | undefined): SafeHtml | null {
  const href = safeUrl(url);
  return href ? html`<a href="${href}" target="_blank" rel="noopener noreferrer" style="color:${BRAND.navy}">${label}</a>` : null;
}

export function mapsUrl(query: string | null | undefined): string | null {
  const q = (query ?? '').trim();
  return q ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(q)}` : null;
}
