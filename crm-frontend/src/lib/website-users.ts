/** A person who registered on the website, with the CRM lead that has their mobile. */
export type WebsiteUser = {
  id: number;
  name: string | null;
  email: string | null;
  phone: string | null;
  verified: boolean;
  registeredAt: string;
  wishlistCount: number;
  enquiryCount: number;
  lastEnquiryAt: string | null;
  lead: { id: number; displayId: string; status: string; staff: string | null } | null;
};

export type WebsiteUserSummary = { total: number; leads: number; notLeads: number; thisMonth: number };

const digitsOf = (v: string | null | undefined) => (v ?? "").replace(/\D/g, "");

/** Search by name, email or lead ID; 3+ digits also match the mobile, whatever its format. */
export function matchesWebsiteUser(user: WebsiteUser, query: string): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  if ([user.name, user.email, user.lead?.displayId].some((v) => v?.toLowerCase().includes(q))) return true;
  const digits = digitsOf(q).slice(-10);
  return digits.length >= 3 && digitsOf(user.phone).slice(-10).includes(digits);
}
