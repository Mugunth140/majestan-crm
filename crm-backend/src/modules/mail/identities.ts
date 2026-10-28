/** Department mailboxes the CRM may send from. Secrets live in env, never here. */
export const MAIL_IDENTITIES = {
  hr: { from: 'hr@majestanrealty.com', name: 'Majestan Realty HR', signature: 'HR Team', env: 'HR' },
  sales: { from: 'sales@majestanrealty.com', name: 'Majestan Realty Sales', signature: 'Sales Team', env: 'SALES' },
  listings: { from: 'listings@majestanrealty.com', name: 'Majestan Realty Listings', signature: 'Listings Team', env: 'LISTINGS' },
  partners: { from: 'partners@majestanrealty.com', name: 'Majestan Realty Partners', signature: 'Partnerships Team', env: 'PARTNERS' },
} as const;

export type MailIdentityKey = keyof typeof MAIL_IDENTITIES;
