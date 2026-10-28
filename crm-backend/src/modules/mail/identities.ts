/** Department mailboxes the CRM may send from. Secrets live in env, never here. */
export const MAIL_IDENTITIES = {
  hr: { from: 'hr@majestanrealty.com', name: 'Majestan Realty HR', signature: 'HR Team', env: 'HR' },
  sales: { from: 'sales@majestanrealty.com', name: 'Majestan Realty Sales', signature: 'Sales Team', env: 'SALES' },
  listings: { from: 'listings@majestanrealty.com', name: 'Majestan Realty Listings', signature: 'Listings Team', env: 'LISTINGS' },
  partners: { from: 'partners@majestanrealty.com', name: 'Majestan Realty Partners', signature: 'Partnerships Team', env: 'PARTNERS' },
  finance: { from: 'finance@majestanrealty.com', name: 'Majestan Realty Accounts', signature: 'Accounts Team', env: 'FINANCE' },
} as const;

export type MailIdentityKey = keyof typeof MAIL_IDENTITIES;

/**
 * Mailboxes that may also write, in the composer only, to records owned by
 * another module. Sending needs `<module>.mail.send` for that mailbox's module.
 * finance@ has no records of its own until a payments module exists.
 */
export const COMPOSER_SENDERS: { identity: MailIdentityKey; module: string; entityTypes: string[] }[] = [
  { identity: 'finance', module: 'finance', entityTypes: ['lead', 'inbound', 'agent'] },
];
