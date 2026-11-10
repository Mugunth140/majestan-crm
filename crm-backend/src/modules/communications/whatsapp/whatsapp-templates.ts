// Approved WhatsApp templates in the shape the CRM composer needs, and the
// pieces to send one. https://developers.facebook.com/docs/whatsapp/business-management-api/message-templates

export interface TemplateField {
  /** Key for the value: "body:1", "header:1", "body:name"… (header and body each number from 1). */
  id: string;
  /** Where the value goes: the header line or the body. */
  part: 'header' | 'body';
  /** "1", "2"… for numbered placeholders, or the name for named ones. */
  key: string;
  example: string | null;
}

export interface Template {
  name: string;
  language: string;
  category: string;
  header: string | null;
  /** TEXT, IMAGE, VIDEO, DOCUMENT or LOCATION; null when there is no header. */
  headerFormat: string | null;
  body: string;
  footer: string | null;
  buttons: string[];
  fields: TemplateField[];
  named: boolean;
  /** Templates whose header is an image, video or document need a file; the composer can't send those yet. */
  supported: boolean;
}

const record = (value: unknown): Record<string, any> =>
  value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, any>)
    : {};
const list = (value: unknown): any[] => (Array.isArray(value) ? value : []);
const PLACEHOLDER = /\{\{\s*([A-Za-z0-9_]+)\s*\}\}/g;

function placeholders(text: string): string[] {
  const keys: string[] = [];
  for (const match of text.matchAll(PLACEHOLDER))
    if (!keys.includes(match[1])) keys.push(match[1]);
  return keys;
}

function examples(
  component: Record<string, any>,
  part: 'header' | 'body',
): (string | null)[] | Map<string, string> {
  const example = record(component.example);
  const named = list(example[`${part}_text_named_params`]);
  if (named.length)
    return new Map(
      named.map((p) => [
        String(record(p).param_name),
        String(record(p).example ?? ''),
      ]),
    );
  const positional =
    part === 'header'
      ? list(example.header_text)
      : list(list(example.body_text)[0]);
  return positional.map((v) => (typeof v === 'string' ? v : null));
}

export function simplifyTemplate(raw: unknown): Template | null {
  const t = record(raw);
  if (typeof t.name !== 'string' || typeof t.language !== 'string') return null;
  let header: string | null = null;
  let headerFormat: string | null = null;
  let body = '';
  let footer: string | null = null;
  let supported = true;
  const buttons: string[] = [];
  const fields: TemplateField[] = [];
  for (const raw of list(t.components)) {
    const c = record(raw);
    const type = String(c.type ?? '').toUpperCase();
    if (type === 'HEADER') {
      headerFormat = String(c.format ?? 'TEXT').toUpperCase();
      if (headerFormat !== 'TEXT') supported = false;
      else header = typeof c.text === 'string' ? c.text : null;
    } else if (type === 'BODY') body = typeof c.text === 'string' ? c.text : '';
    else if (type === 'FOOTER')
      footer = typeof c.text === 'string' ? c.text : null;
    else if (type === 'BUTTONS')
      for (const b of list(c.buttons)) {
        const button = record(b);
        if (typeof button.text === 'string') buttons.push(button.text);
        // Buttons with their own variable (dynamic URL, copy code) need values we don't collect.
        if (
          /\{\{/.test(String(button.url ?? '')) ||
          button.type === 'COPY_CODE'
        )
          supported = false;
      }
    if (type === 'HEADER' || type === 'BODY') {
      const part = type === 'HEADER' ? 'header' : 'body';
      const sample = examples(c, part);
      placeholders(String(c.text ?? '')).forEach((key, i) =>
        fields.push({
          id: `${part}:${key}`,
          part,
          key,
          example:
            (sample instanceof Map ? sample.get(key) : sample[i]) ?? null,
        }),
      );
    }
  }
  const named =
    fields.some((f) => !/^\d+$/.test(f.key)) ||
    String(t.parameter_format ?? '').toUpperCase() === 'NAMED';
  return {
    name: t.name,
    language: t.language,
    category: String(t.category ?? ''),
    header,
    headerFormat,
    body,
    footer,
    buttons,
    fields,
    named,
    supported,
  };
}

/** The template's text with the values filled in, as the customer will read it. */
export function renderTemplate(
  template: Template,
  values: Record<string, string>,
): string {
  const fill = (text: string, part: string) =>
    text.replace(
      PLACEHOLDER,
      (_, key: string) => values[`${part}:${key}`]?.trim() || `{{${key}}}`,
    );
  return [
    template.header && fill(template.header, 'header'),
    fill(template.body, 'body'),
    template.footer,
  ]
    .filter(Boolean)
    .join('\n\n');
}

/** The `components` array Meta expects for the values given. */
export function templateComponents(
  template: Template,
  values: Record<string, string>,
) {
  const components: Record<string, unknown>[] = [];
  for (const part of ['header', 'body'] as const) {
    const fields = template.fields.filter((f) => f.part === part);
    if (!fields.length) continue;
    components.push({
      type: part,
      parameters: fields.map((f) => ({
        type: 'text',
        text: values[f.id].trim(),
        ...(template.named ? { parameter_name: f.key } : {}),
      })),
    });
  }
  return components;
}

/** The value for each field, or the first field left empty. */
export function missingField(
  template: Template,
  values: Record<string, string>,
): TemplateField | null {
  return (
    template.fields.find((f) => !String(values[f.id] ?? '').trim()) ?? null
  );
}

/**
 * Values for every field of `template`, from values known by name: named fields
 * ({{first_name}}) by their name, numbered fields ({{1}}, {{2}}…) by `order`.
 */
export function valuesFor(
  template: Template,
  byName: Record<string, string>,
  order: string[],
): Record<string, string> {
  const values: Record<string, string> = {};
  for (const f of template.fields) {
    const name = /^\d+$/.test(f.key) ? order[Number(f.key) - 1] : f.key;
    const value = name ? byName[name] : undefined;
    if (value) values[f.id] = value;
  }
  return values;
}
