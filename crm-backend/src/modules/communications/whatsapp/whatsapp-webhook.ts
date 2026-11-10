import { createHmac, timingSafeEqual } from 'crypto';

// Shapes and pure helpers for Meta's WhatsApp Cloud API webhook.
// https://developers.facebook.com/docs/whatsapp/cloud-api/webhooks/components

export interface InboundMessage {
  waMessageId: string;
  phone: string;
  phoneNumberId: string | null;
  contactName: string | null;
  type: string;
  body: string | null;
  mediaId: string | null;
  sentAt: Date | null;
}

export interface StatusUpdate {
  waMessageId: string;
  phone: string;
  phoneNumberId: string | null;
  status: string;
  error: string | null;
  at: Date | null;
}

const STATUSES = new Set(['sent', 'delivered', 'read', 'failed']);
const MEDIA_TYPES = ['image', 'document', 'audio', 'video', 'sticker'] as const;

const digits = (value: unknown) =>
  typeof value === 'string' ? value.replace(/\D/g, '') : '';
const text = (value: unknown, max = 4096) =>
  typeof value === 'string' && value.trim() ? value.slice(0, max) : null;
const record = (value: unknown): Record<string, any> =>
  value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, any>)
    : {};
const list = (value: unknown): any[] => (Array.isArray(value) ? value : []);

function when(seconds: unknown): Date | null {
  const n = Number(seconds);
  return Number.isFinite(n) && n > 0 ? new Date(n * 1000) : null;
}

/** Meta signs each POST with the App Secret: X-Hub-Signature-256: sha256=<hex HMAC of the raw body>. */
export function validSignature(
  rawBody: Buffer | undefined,
  header: unknown,
  appSecret: string,
): boolean {
  if (
    !rawBody ||
    !appSecret ||
    typeof header !== 'string' ||
    !header.startsWith('sha256=')
  )
    return false;
  const expected = Buffer.from(
    createHmac('sha256', appSecret).update(rawBody).digest('hex'),
  );
  const given = Buffer.from(header.slice('sha256='.length));
  return given.length === expected.length && timingSafeEqual(given, expected);
}

/** What the CRM shows for a message: its text, a caption, or a short label for what was sent. */
function describe(message: Record<string, any>): {
  body: string | null;
  mediaId: string | null;
} {
  const type = String(message.type ?? '');
  if (type === 'text')
    return { body: text(record(message.text).body), mediaId: null };
  for (const media of MEDIA_TYPES) {
    if (type !== media) continue;
    const part = record(message[media]);
    const label =
      media === 'document'
        ? `Document${part.filename ? `: ${String(part.filename).slice(0, 200)}` : ''}`
        : media[0].toUpperCase() + media.slice(1);
    return {
      body: text(part.caption) ?? `[${label}]`,
      mediaId: text(part.id, 191),
    };
  }
  if (type === 'location') {
    const loc = record(message.location);
    const name = [loc.name, loc.address]
      .filter((v) => typeof v === 'string' && v)
      .join(', ');
    return {
      body: `[Location${name ? `: ${name}` : ''}] ${loc.latitude ?? ''},${loc.longitude ?? ''}`.trim(),
      mediaId: null,
    };
  }
  if (type === 'button')
    return { body: text(record(message.button).text), mediaId: null };
  if (type === 'interactive') {
    const reply = record(
      record(message.interactive).button_reply ??
        record(message.interactive).list_reply,
    );
    return { body: text(reply.title), mediaId: null };
  }
  if (type === 'reaction')
    return {
      body: text(record(message.reaction).emoji)
        ? `Reacted ${record(message.reaction).emoji}`
        : null,
      mediaId: null,
    };
  if (type === 'contacts') return { body: '[Contact card]', mediaId: null };
  return { body: `[${type || 'Unsupported'} message]`, mediaId: null };
}

/** Pull incoming messages and delivery statuses out of a webhook payload; anything malformed is skipped. */
export function parseWebhook(payload: unknown): {
  messages: InboundMessage[];
  statuses: StatusUpdate[];
} {
  const messages: InboundMessage[] = [];
  const statuses: StatusUpdate[] = [];
  const root = record(payload);
  if (root.object !== 'whatsapp_business_account')
    return { messages, statuses };
  for (const entry of list(root.entry)) {
    for (const change of list(record(entry).changes)) {
      if (record(change).field !== 'messages') continue;
      const value = record(record(change).value);
      const phoneNumberId = text(record(value.metadata).phone_number_id, 64);
      const names = new Map<string, string>();
      for (const c of list(value.contacts)) {
        const wa = digits(record(c).wa_id);
        const name = text(record(record(c).profile).name, 255);
        if (wa && name) names.set(wa, name);
      }
      for (const raw of list(value.messages)) {
        const m = record(raw);
        const waMessageId = text(m.id, 191);
        const phone = digits(m.from);
        if (!waMessageId || phone.length < 6) continue;
        const { body, mediaId } = describe(m);
        messages.push({
          waMessageId,
          phone: phone.slice(0, 32),
          phoneNumberId,
          contactName: names.get(phone) ?? null,
          type: String(m.type ?? 'unknown').slice(0, 32),
          body,
          mediaId,
          sentAt: when(m.timestamp),
        });
      }
      for (const raw of list(value.statuses)) {
        const s = record(raw);
        const waMessageId = text(s.id, 191);
        const status = String(s.status ?? '');
        if (!waMessageId || !STATUSES.has(status)) continue;
        const firstError = record(list(s.errors)[0]);
        const error =
          status === 'failed'
            ? text(
                record(firstError.error_data).details ??
                  firstError.message ??
                  firstError.title,
                1000,
              )
            : null;
        statuses.push({
          waMessageId,
          phone: digits(s.recipient_id).slice(0, 32),
          phoneNumberId,
          status,
          error,
          at: when(s.timestamp),
        });
      }
    }
  }
  return { messages, statuses };
}
