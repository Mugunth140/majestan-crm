// Deep-link contract for the Leads table's "Last Followup" cell: that cell
// links to `/leads/:id?tab=followups`, and the lead detail page opens the
// follow-up timeline sheet when it sees the tab.
//
// The decision lives here rather than inline in the page so the sequencing rule
// is testable — the sheet must not open until the lead and its follow-ups are in
// hand, or the fetch wins the race and the sheet renders empty.

/** The `tab` value written into the href by lastFollowupView. */
export const FOLLOW_UP_TAB = "followups";

export function wantsFollowUps(tab?: string | null): boolean {
  return tab === FOLLOW_UP_TAB;
}

export type FollowUpDeepLinkState = {
  /** The URL asks for the follow-up timeline. */
  wantsFollowUps: boolean;
  /** The lead request is still in flight. */
  isLoading: boolean;
  /** The lead — and therefore its follow-ups — is in hand. */
  hasLead: boolean;
  /** The sheet was already opened once, so a later close by the user sticks. */
  alreadyOpened: boolean;
};

export function shouldAutoOpenFollowUps(state: FollowUpDeepLinkState): boolean {
  return (
    state.wantsFollowUps &&
    !state.isLoading &&
    state.hasLead &&
    !state.alreadyOpened
  );
}
