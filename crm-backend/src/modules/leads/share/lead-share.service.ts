import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { Lead } from '../../../database/entities/lead.entity';
import { ContactLog } from '../../../database/entities/contact-log.entity';
import { MailAttachmentsService } from '../../mail/attachments/mail-attachments.service';
import {
  loadProject,
  loadProperty,
  type Listing,
  type ListingKind,
} from './listing-data';
import { renderListingPdf } from './listing-pdf';
import { LeadEventsService } from '../lead-events.service';
import { WhatsappService } from '../../communications/whatsapp/whatsapp.service';
import {
  WhatsappSendService,
  whatsappNumber,
} from '../../communications/whatsapp/whatsapp-send.service';
import {
  missingField,
  renderTemplate,
  templateComponents,
  valuesFor,
} from '../../communications/whatsapp/whatsapp-templates';

/** Template for brochures sent outside the 24-hour reply window: a DOCUMENT header plus text. */
export const SHARE_TEMPLATE = 'property_details';
const SHARE_ORDER = ['first_name', 'listing', 'details', 'link'];
const oneLine = (v: string) =>
  v
    .replace(/[\r\n\t]+/g, ' ')
    .replace(/ {4,}/g, '   ')
    .trim();

export type ShareChannel = 'email' | 'whatsapp';
export interface ShareItem {
  kind: ListingKind;
  id: number;
}

/** At most this many listings go out in one share. */
export const MAX_SHARE_ITEMS = 5;

const IMGPROXY = process.env.IMGPROXY_URL || 'http://imgproxy:8080';

/** Photos print as thumbnails, so they are fetched small enough that a few brochures fit in one email. */
async function fetchPhoto(url: string): Promise<Buffer | null> {
  try {
    const res = await fetch(
      `${IMGPROXY}/insecure/rs:fit:640:480:0/q:70/format:jpg/plain/${url}`,
      { signal: AbortSignal.timeout(12_000) },
    );
    return res.ok ? Buffer.from(await res.arrayBuffer()) : null;
  } catch {
    return null;
  }
}

const slug = (value: string) =>
  value
    .replace(/[^\p{L}\p{N}]+/gu, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60) || 'listing';

const escapeHtml = (value: string) =>
  value.replace(
    /[&<>"']/g,
    (c) =>
      ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[
        c
      ]!,
  );

/**
 * Staff share matching properties and projects with a lead: each listing as a
 * branded PDF, sent through the email composer or WhatsApp, and every share
 * recorded in the lead's conversation.
 */
@Injectable()
export class LeadShareService {
  private readonly logger = new Logger(LeadShareService.name);

  constructor(
    private readonly dataSource: DataSource,
    @InjectDataSource('site') private readonly site: DataSource,
    private readonly attachments: MailAttachmentsService,
    private readonly events: LeadEventsService,
    private readonly whatsapp: WhatsappService,
    private readonly whatsappSender: WhatsappSendService,
  ) {}

  /** Same rule as opening the lead: staff only reach their own leads. */
  async assertAccess(leadId: number, user: { id: number; role?: string }) {
    const lead = await this.dataSource.getRepository(Lead).findOne({
      where: { id: leadId },
      select: {
        id: true,
        name: true,
        assigned_staff_id: true,
        mobile_number: true,
        whatsapp_number: true,
      },
    });
    if (!lead) throw new NotFoundException('Lead not found');
    if (user.role === 'Staff' && lead.assigned_staff_id !== user.id)
      throw new ForbiddenException('You can only share with your own leads');
    return lead;
  }

  async listing(item: ShareItem): Promise<Listing> {
    const listing =
      item.kind === 'project'
        ? await loadProject(this.site, item.id)
        : await loadProperty(this.site, item.id);
    if (!listing)
      throw new NotFoundException(`That ${item.kind} no longer exists`);
    return listing;
  }

  async pdf(item: ShareItem) {
    const listing = await this.listing(item);
    const photos = await Promise.all(listing.photos.map(fetchPhoto));
    const missing = photos.filter((p) => !p).length;
    if (missing)
      this.logger.warn(
        `${missing} photo(s) for ${item.kind} #${item.id} could not be loaded`,
      );
    const buffer = await renderListingPdf(
      listing,
      photos.filter((p): p is Buffer => !!p),
    );
    return {
      listing,
      buffer,
      filename: `${listing.code} ${slug(listing.title)} - Majestan Realty.pdf`,
    };
  }

  /** A brochure saved to staff's device, noted in the lead's Activity with the listing it was for. */
  async download(
    leadId: number,
    item: ShareItem,
    user: { id: number; role?: string },
    record: boolean,
  ) {
    await this.assertAccess(leadId, user);
    const file = await this.pdf(item);
    if (record) {
      const l = file.listing;
      await this.events.record({
        leadId,
        actorId: user.id,
        type: 'listing_downloaded',
        field: l.kind,
        to: l.title,
        meta: {
          kind: l.kind,
          id: l.id,
          code: l.code,
          title: l.title,
          price: l.price,
          subtitle: l.subtitle,
        },
      });
    }
    return file;
  }

  /** Brochures attached and a message written, ready to open in the email composer. */
  async emailDraft(
    leadId: number,
    items: ShareItem[],
    user: { id: number; role?: string },
  ) {
    await this.assertAccess(leadId, user);
    const list = this.checkItems(items);
    const attachments = [];
    const listings: Listing[] = [];
    for (const item of list) {
      const { listing, buffer, filename } = await this.pdf(item);
      attachments.push(await this.attachments.store(buffer, filename, user.id));
      listings.push(listing);
    }
    const one = listings.length === 1;
    const subject = one
      ? `${listings[0].title} – details from Majestan Realty`
      : `${listings.length} options picked for you – Majestan Realty`;
    const rows = listings
      .map((l) => {
        const name = l.url
          ? `<a href="${escapeHtml(l.url)}">${escapeHtml(l.title)}</a>`
          : escapeHtml(l.title);
        return `<li><strong>${name}</strong> – ${escapeHtml([l.subtitle, l.price].filter(Boolean).join(' · '))}</li>`;
      })
      .join('');
    const body = `<p>Dear {{lead.first_name}},</p>
<p>As discussed, here ${one ? 'is a property' : 'are a few options'} that match${one ? 'es' : ''} what you are looking for:</p>
<ul>${rows}</ul>
<p>The attached PDF${one ? ' has' : 's have'} the photos and full details. If you would like to know more or arrange a site visit, reply to this email or call {{sender.phone}}.</p>`;
    return { attachments, subject, body };
  }

  /**
   * Sends each brochure to the lead's WhatsApp from the business number. Within
   * 24 hours of the customer's last message it goes as a document with a
   * caption; otherwise through the approved "property_details" template.
   */
  async whatsappShare(
    leadId: number,
    items: ShareItem[],
    user: { id: number; role?: string },
  ) {
    const lead = await this.assertAccess(leadId, user);
    const list = this.checkItems(items);
    if (!this.whatsapp.isConfigured())
      throw new ServiceUnavailableException(
        'WhatsApp is not set up on the CRM server',
      );
    const to = whatsappNumber(lead);
    if (!to)
      throw new BadRequestException(
        'This lead has no WhatsApp or mobile number',
      );
    const open = (await this.whatsappSender.secondsLeft(leadId, to)) > 0;
    const template = open ? null : await this.whatsapp.approved(SHARE_TEMPLATE);
    if (!open && (!template || template.headerFormat !== 'DOCUMENT'))
      throw new BadRequestException(
        `${lead.name} hasn’t messaged in the last 24 hours, so WhatsApp needs an approved "${SHARE_TEMPLATE}" template with a Document header to send brochures`,
      );
    const firstName = lead.name.trim().split(/\s+/)[0] || 'there';
    const sent: { kind: ListingKind; id: number }[] = [];
    for (const item of list) {
      const { listing, buffer, filename } = await this.pdf(item);
      const media = await this.whatsapp.uploadMedia(buffer, filename);
      const details = oneLine(
        [listing.subtitle, listing.price].filter(Boolean).join(' · '),
      );
      const link = listing.url ?? 'https://www.majestanrealty.com';
      let text: string;
      let wamid: string;
      if (template) {
        const values = valuesFor(
          template,
          {
            first_name: firstName,
            name: lead.name,
            listing: oneLine(listing.title),
            details: details || oneLine(listing.code),
            link,
          },
          SHARE_ORDER,
        );
        const missing = missingField(template, values);
        if (missing)
          throw new BadRequestException(
            `The "${SHARE_TEMPLATE}" template uses {{${missing.key}}}, which sharing doesn't fill`,
          );
        wamid = await this.whatsapp.deliver(to, {
          type: 'template',
          template: {
            name: template.name,
            language: { code: template.language },
            components: [
              {
                type: 'header',
                parameters: [
                  { type: 'document', document: { id: media, filename } },
                ],
              },
              ...templateComponents(template, values),
            ],
          },
        });
        text = renderTemplate(template, values);
      } else {
        text = [
          `Hi ${firstName}, here are the details of *${listing.title}*`,
          details,
          listing.url,
        ]
          .filter(Boolean)
          .join('\n');
        wamid = await this.whatsapp.deliver(to, {
          type: 'document',
          document: { id: media, filename, caption: text },
        });
      }
      await this.whatsappSender.record({
        wamid,
        to,
        leadId,
        type: 'document',
        text,
        subject: null,
        sentBy: user.id,
        contactType: 'share',
      });
      sent.push(item);
    }
    await this.log(leadId, 'whatsapp', sent, user);
    return { sent: sent.length, to };
  }

  /** Records a share in the lead's conversation. */
  async log(
    leadId: number,
    channel: ShareChannel,
    items: ShareItem[],
    user: { id: number; role?: string },
  ) {
    await this.assertAccess(leadId, user);
    if (!['email', 'whatsapp'].includes(channel))
      throw new BadRequestException('Share by email or WhatsApp');
    const listings = await Promise.all(
      this.checkItems(items).map((item) => this.listing(item)),
    );
    const repo = this.dataSource.getRepository(ContactLog);
    return repo.save(
      repo.create({
        lead_id: leadId,
        contact_type: 'share',
        subject: channel,
        message: JSON.stringify(
          listings.map((l) => ({
            kind: l.kind,
            id: l.id,
            code: l.code,
            title: l.title,
            price: l.price,
            subtitle: l.subtitle,
          })),
        ),
        sent_by_id: user.id,
      }),
    );
  }

  private checkItems(items: ShareItem[]) {
    const list = (items ?? []).filter(
      (i) =>
        (i.kind === 'property' || i.kind === 'project') &&
        Number.isInteger(i.id) &&
        i.id > 0,
    );
    if (!list.length)
      throw new BadRequestException('Pick at least one property or project');
    if (list.length > MAX_SHARE_ITEMS)
      throw new BadRequestException(
        `Share at most ${MAX_SHARE_ITEMS} listings at a time`,
      );
    return list;
  }
}
