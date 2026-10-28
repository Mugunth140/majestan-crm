import sanitizeHtml from 'sanitize-html';
import { convert } from 'html-to-text';
import { escapeHtml, SafeHtml } from './html';

/** A variable value: plain text is escaped, SafeHtml (blocks built in code) is inserted as-is. */
export type MailVariableValue = string | number | SafeHtml | null | undefined;
export type MailVariables = Record<string, MailVariableValue>;

const TOKEN = /\{\{\s*([a-zA-Z0-9_.]+)\s*\}\}/g;
/** A paragraph that holds only placeholders, e.g. <p>{{visit_details}} {{map_button}}</p>. */
const BLOCK_PARAGRAPH = /<p[^>]*>((?:\s|&nbsp;|\{\{\s*[a-zA-Z0-9_.]+\s*\}\})+)<\/p>/g;

/**
 * Email-safe HTML allow-list, used for editor content when a template is saved,
 * and again on the final body after variables are filled in, so a variable value
 * can never smuggle in a script, form or javascript: link.
 */
const EMAIL_HTML: sanitizeHtml.IOptions = {
  allowedTags: [
    'p', 'br', 'strong', 'b', 'em', 'i', 'u', 's', 'a', 'ul', 'ol', 'li', 'h1', 'h2', 'h3', 'h4', 'blockquote',
    'hr', 'span', 'div', 'img', 'table', 'thead', 'tbody', 'tr', 'td', 'th', 'center',
  ],
  allowedAttributes: {
    '*': ['style', 'align'],
    a: ['href', 'target', 'rel', 'title'],
    img: ['src', 'alt', 'width', 'height'],
    table: ['role', 'width', 'cellpadding', 'cellspacing', 'border', 'bgcolor'],
    td: ['width', 'valign', 'bgcolor', 'colspan'],
    th: ['width', 'valign', 'colspan'],
  },
  allowedSchemes: ['https', 'http', 'mailto', 'tel'],
  allowedSchemesAppliedToAttributes: ['href', 'src'],
  allowProtocolRelative: false,
  transformTags: { a: sanitizeHtml.simpleTransform('a', { target: '_blank', rel: 'noopener noreferrer' }) },
};

export function sanitizeEmailHtml(html: string): string {
  return sanitizeHtml(html ?? '', EMAIL_HTML);
}

/** {{variable}} names used in a template, e.g. for the editor and for validation. */
export function templateVariables(source: string): string[] {
  return [...new Set([...(source ?? '').matchAll(TOKEN)].map((m) => m[1]))];
}

function textOf(value: MailVariableValue): string {
  if (value === null || value === undefined) return '';
  if (value instanceof SafeHtml) return convert(value.value, { wordwrap: false }).trim();
  return String(value);
}

/** Fills {{variables}} in an HTML body. Unknown names become empty and are reported. */
export function fillHtml(source: string, vars: MailVariables): { html: string; unknown: string[] } {
  const unknown: string[] = [];
  // The editor wraps a block placeholder in <p>; a table inside <p> breaks Outlook, so lift it out.
  const unwrapped = (source ?? '').replace(BLOCK_PARAGRAPH, (whole, inner: string) => {
    const keys = [...inner.matchAll(TOKEN)].map((m) => m[1]);
    return keys.length && keys.every((key) => vars[key] instanceof SafeHtml) ? keys.map((key) => `{{${key}}}`).join('') : whole;
  });
  const html = unwrapped.replace(TOKEN, (_m, key: string) => {
    if (!(key in vars)) {
      unknown.push(key);
      return '';
    }
    const value = vars[key];
    if (value instanceof SafeHtml) return value.value;
    return escapeHtml(value ?? '');
  });
  return { html: sanitizeEmailHtml(html), unknown: [...new Set(unknown)] };
}

/** Fills {{variables}} in a subject line: plain text, single line. */
export function fillText(source: string, vars: MailVariables): { text: string; unknown: string[] } {
  const unknown: string[] = [];
  const text = (source ?? '').replace(TOKEN, (_m, key: string) => {
    if (!(key in vars)) {
      unknown.push(key);
      return '';
    }
    return textOf(vars[key]);
  });
  return { text: text.replace(/[\r\n]+/g, ' ').replace(/\s{2,}/g, ' ').trim(), unknown: [...new Set(unknown)] };
}

/** Plain-text alternative of an HTML body. */
export function htmlToPlainText(html: string): string {
  return convert(html, {
    wordwrap: 100,
    selectors: [
      { selector: 'a', options: { hideLinkHrefIfSameAsText: true } },
      { selector: 'img', format: 'skip' },
      { selector: 'h1', options: { uppercase: false } },
      { selector: 'h2', options: { uppercase: false } },
      { selector: 'h3', options: { uppercase: false } },
      { selector: 'table', format: 'dataTable' },
    ],
  }).trim();
}
