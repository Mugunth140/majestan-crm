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
  return html`<table role="presentation" width="100%" cellpadding="0" cellspacing="0" class="dl" style="margin:24px 0;border-collapse:separate;background:${BRAND.soft};border:1px solid ${BRAND.line};border-radius:10px"><tbody>
${visible.map((row, i) => {
  const [label, value] = row;
  const top = i === 0 ? '18px' : '7px';
  const bottom = i === visible.length - 1 ? '18px' : '7px';
  return html`<tr><td class="dl-label" style="padding:${top} 8px ${bottom} 20px;width:120px;font-size:13px;color:${BRAND.muted};vertical-align:top;white-space:nowrap">${label}</td><td class="dl-value" style="padding:${top} 20px ${bottom} 8px;font-size:15px;font-weight:600;color:${BRAND.ink};vertical-align:top">${value}</td></tr>`;
})}
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
