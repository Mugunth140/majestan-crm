// Sharing site properties and projects with a lead: each listing goes out as a
// branded PDF, by email (through the composer) or WhatsApp, and every share is
// recorded in the lead's conversation.

import { apiFetch, apiJson } from "./api-fetch";
import type { MailAttachment } from "./mail-api";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "/api/v1";
const WEBSITE = "https://www.majestanrealty.com";

export type ListingKind = "property" | "project";
export type ShareChannel = "email" | "whatsapp";

/** A listing picked to share. */
export interface SharedListing {
  kind: ListingKind;
  id: number;
  code: string;
  title: string;
  price?: string;
  subtitle?: string;
  /** Public page, when the site has one. */
  url?: string | null;
}

export const MAX_SHARE = 5;

export const listingHref = (l: { kind: ListingKind; id: number }) =>
  `/${l.kind === "project" ? "projects" : "properties"}/${l.id}`;

/** The public page of a property (by slug) or project (by canonical slug). */
export const listingUrl = (kind: ListingKind, slug?: string | null) =>
  slug ? `${WEBSITE}/${kind === "property" ? "property/" : ""}${slug}` : null;

const items = (listings: SharedListing[]) =>
  listings.map(({ kind, id }) => ({ kind, id }));

export const shareApi = {
  /** Brochures generated and attached, with a message to send them. */
  emailDraft: (leadId: number, listings: SharedListing[]) =>
    apiJson<{
      data: { attachments: MailAttachment[]; subject: string; body: string };
    }>(`${API_URL}/leads/${leadId}/share/email-draft`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ items: items(listings) }),
    }).then((res) => res.data),

  log: (leadId: number, channel: ShareChannel, listings: SharedListing[]) =>
    apiJson(`${API_URL}/leads/${leadId}/share/log`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ channel, items: items(listings) }),
    }),

  /**
   * Saves a listing's brochure to the user's device. The lead's Activity notes
   * the download, unless it is part of a share (which is recorded itself).
   */
  async downloadPdf(
    leadId: number,
    listing: Pick<SharedListing, "kind" | "id">,
    opts?: { forShare?: boolean },
  ) {
    const res = await apiFetch(
      `${API_URL}/leads/${leadId}/share/pdf/${listing.kind}/${listing.id}${opts?.forShare ? "?via=share" : ""}`,
    );
    if (!res.ok) throw new Error("Could not prepare the PDF");
    const name = /filename\*=UTF-8''([^;]+)/.exec(
      res.headers.get("Content-Disposition") ?? "",
    )?.[1];
    const url = URL.createObjectURL(await res.blob());
    const a = Object.assign(document.createElement("a"), {
      href: url,
      download: name ? decodeURIComponent(name) : "Majestan Realty.pdf",
    });
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 10_000);
  },
};

/** The WhatsApp message that goes with the brochures. */
export function whatsappMessage(
  name: string | null | undefined,
  listings: SharedListing[],
) {
  const first = name?.trim().split(/\s+/)[0];
  const lines = listings.map((l, i) => {
    const detail = [l.subtitle, l.price].filter(Boolean).join(" · ");
    return `${i + 1}. *${l.title}*${detail ? ` – ${detail}` : ""}${l.url ? `\n${l.url}` : ""}`;
  });
  return [
    `Hi${first ? ` ${first}` : ""},`,
    "",
    listings.length === 1
      ? "Here is a property that matches what you are looking for:"
      : "Here are a few options that match what you are looking for:",
    "",
    ...lines,
    "",
    "I'm sending the full details with photos as PDF. Let me know if you would like to visit.",
    "",
    "– Majestan Realty",
  ].join("\n");
}

/** A share as stored in the conversation: the listings, as they were when sent. */
export function parseShare(
  message: string | null | undefined,
): SharedListing[] {
  try {
    const list = JSON.parse(message ?? "");
    return Array.isArray(list)
      ? list.filter(
          (l) => l && (l.kind === "property" || l.kind === "project") && l.id,
        )
      : [];
  } catch {
    return [];
  }
}
