import type { DataSource } from 'typeorm';

export interface ChecklistItem {
  key: string;
  title: string;
  detail: string;
  href: string;
  done: boolean;
}

/** The tour a new person gets; finishing it ticks the first checklist item. */
export const WELCOME_TOUR = 'welcome';

/**
 * A new person's first steps, each ticked from what they have actually done, not from
 * clicks in the tour. Finishing all of them unlocks the "Getting started" achievement.
 */
export async function gettingStarted(db: DataSource, userId: number): Promise<ChecklistItem[]> {
  const [[user], [fu], [share]] = await Promise.all([
    db.query('SELECT avatar_url, phone, onboarding FROM users WHERE id = ?', [userId]),
    db.query('SELECT EXISTS(SELECT 1 FROM lead_follow_ups WHERE created_by_id = ?) AS yes', [userId]),
    db.query("SELECT EXISTS(SELECT 1 FROM contact_logs WHERE sent_by_id = ? AND contact_type = 'share') AS yes", [userId]),
  ]);
  const onboarding = typeof user?.onboarding === 'string' ? JSON.parse(user.onboarding) : (user?.onboarding ?? {});
  const toured = !!onboarding?.tours?.[WELCOME_TOUR]?.done_at;
  return [
    { key: 'tour', title: 'Take the tour', detail: 'Two minutes on what changed in the CRM.', href: '/settings/tour', done: toured },
    { key: 'profile', title: 'Add your photo and phone number', detail: 'So your team knows who they are talking to.', href: '/settings', done: !!user?.avatar_url && !!user?.phone },
    { key: 'follow-up', title: 'Log a follow-up on a lead', detail: 'Open a lead, then use the Conversation tab.', href: '/leads', done: !!Number(fu?.yes) },
    { key: 'share', title: 'Share a property with a lead', detail: 'Send listings on WhatsApp or email from the lead.', href: '/leads', done: !!Number(share?.yes) },
  ];
}
