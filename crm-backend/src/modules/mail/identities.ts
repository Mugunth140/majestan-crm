/** Department mailboxes the CRM may send from. Secrets live in env, never here. */
export const MAIL_IDENTITIES = {
  hr: { from: 'hr@majestanrealty.com', name: 'Majestan Realty HR', signature: 'HR Team', env: 'HR' },
  sales: { from: 'sales@majestanrealty.com', name: 'Majestan Realty Sales', signature: 'Sales Team', env: 'SALES' },
} as const;

export type MailIdentityKey = keyof typeof MAIL_IDENTITIES;
