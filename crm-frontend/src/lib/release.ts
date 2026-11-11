// Release notes shown in the in-app update dialog. Add a new entry at the top for every
// release you want users to read about; the first entry's version is the app version.

export type ChangeKind = "new" | "improved" | "fixed";

export interface Release {
  version: string;
  date: string; // YYYY-MM-DD
  title: string;
  /** `slide` names a tour slide (components/onboarding/tour-data.ts) that shows the change. */
  changes: { kind: ChangeKind; text: string; slide?: string }[];
}

export const RELEASES: Release[] = [
  {
    version: "2.3.0",
    date: "2026-11-11",
    title: "Introducing WhatsApp Integration",
    changes: [
      { kind: "new", text: "WhatsApp in the CRM: message a lead from the business number, and their replies show up in the lead's Conversation as they arrive.", slide: "whatsapp" },
      { kind: "new", text: "Share properties and projects on WhatsApp with their brochure, and visit confirmations, reminders and booking messages go out on their own.", slide: "whatsapp" },
      { kind: "new", text: "WhatsApp is still being switched on with Meta, so some messages may not get through yet. Calls, email and everything else work as usual.", slide: "whatsapp" },
      { kind: "new", text: "Choose which columns each table shows. Your choice is saved for you only, and Reset to default brings the original back." },
      { kind: "new", text: "Leads by source on the dashboards, e.g. how many leads came from 99acres this month." },
      { kind: "new", text: "Properties: Special purpose is now a list to pick from, and More filters adds BHK, bathrooms, facing, possession, occupancy, negotiable and parking." },
      { kind: "new", text: "Owner occupied on independent houses, both on the property and on a lead's requirement." },
      { kind: "new", text: "Covered and open parking for cars and bikes on independent houses, villas and every rental property." },
      { kind: "new", text: "Everyone now has a profile picture: pick one of the avatars or upload your own photo." },
      { kind: "improved", text: "Team leads and managers can assign a lead to themselves." },
      { kind: "improved", text: "Lead page: property type in Details, talk time and answered calls, and an Interested in panel for projects too." },
      { kind: "improved", text: "Requirements: furnishing takes more than one choice, Projects moved to the end, and budgets read out in words." },
      { kind: "improved", text: "Find matches keeps to the requirement's category (an industrial requirement shows only industrial listings) and can search every listing." },
      { kind: "improved", text: "Search leads by WhatsApp number in All Leads and ⌘K / Ctrl+K, typed with or without +91." },
      { kind: "improved", text: "Schedule site visit: search for the project instead of typing it." },
      { kind: "improved", text: "Wide tables and charts on the dashboards scroll sideways with a visible scrollbar." },
      { kind: "improved", text: "Drafts of follow-ups, emails and WhatsApp messages are kept when you switch tabs or pages." },
      { kind: "fixed", text: "Today's target and the week's target now follow the monthly target when the weekly split didn't add up to it." },
      { kind: "fixed", text: "Avg time to first contact counts working hours only." },
    ],
  },
  {
    version: "2.2.0",
    date: "2026-11-09",
    title: "Search everything",
    changes: [
      { kind: "new", text: "⌘K / Ctrl+K searches leads, inbound, partners, properties, projects, builders, candidates, assets and people by ID, name or phone. Type a module's name, like \"inb\", and press Enter to search only there." },
      { kind: "new", text: "Pet Friendly on every property type." },
      { kind: "new", text: "Website analytics: see visits to the website alongside your CRM numbers." },
      { kind: "new", text: "Emails go out on their own a few minutes after they're triggered. Press Don't send in the conversation to stop one." },
      { kind: "improved", text: "Calls a team lead makes for their team's leads count toward the team lead's call target." },
      { kind: "improved", text: "Every list shows 20 rows, and you can switch to 50 or 100." },
      { kind: "improved", text: "Profile pictures show everywhere in the CRM, and update as soon as you pick one." },
      { kind: "fixed", text: "Each department is listed once, without duplicates like \"HR\" and \"HR Department\"." },
      { kind: "fixed", text: "Paging works on every list, not just Leads." },
    ],
  },
  {
    version: "2.1.0",
    date: "2026-11-08",
    title: "The redesigned CRM",
    changes: [
      { kind: "new", text: "A guided tour for everyone, and a getting-started checklist with its own badge.", slide: "updates" },
      { kind: "new", text: "Leads redesigned, with List, Kanban and Group by views.", slide: "views" },
      { kind: "new", text: "Edit leads and assets right where you read them.", slide: "direct-edit" },
      { kind: "new", text: "Activity on every lead, with a Shared filter for properties sent and downloaded.", slide: "activity" },
      { kind: "new", text: "Conversation keeps every call, email, WhatsApp message and follow-up in one thread.", slide: "conversation" },
      { kind: "new", text: "Scheduler shows your follow-ups by day.", slide: "scheduler" },
      { kind: "new", text: "Role dashboards, and a Progress tab with streaks and achievements.", slide: "dashboard" },
      { kind: "new", text: "Settings for your own profile, password, theme and tour." },
      { kind: "improved", text: "Dark mode is now the default. You can switch in Settings, Appearance." },
      { kind: "improved", text: "Inbox grouped by day, with an Unread filter and swipe to delete." },
      { kind: "fixed", text: "Pages no longer hang when the cache server is unreachable." },
    ],
  },
  {
    version: "2.0.0",
    date: "2026-11-02",
    title: "Prismark CRM",
    changes: [
      { kind: "new", text: "The CRM is now Prismark CRM, with a new logo and icons." },
      { kind: "new", text: "Redesigned sign-in page with a light / dark theme switcher." },
      { kind: "new", text: "New sidebar with the workspace menu, notifications and collapse." },
      { kind: "new", text: "In-app updates: you're told when a new version is out and can update in one click." },
      { kind: "improved", text: "Pages show a Prismark loader while they load." },
    ],
  },
];

export const APP_VERSION = RELEASES[0].version;

// Unique per build (set in next.config.ts); a running tab compares its own build ID with
// the server's to detect a fresh deploy, even when the version number didn't change.
export const BUILD_ID = process.env.NEXT_PUBLIC_BUILD_ID ?? "dev";

// Releases newer than `version`, newest first.
export function releasesSince(version: string, releases: Release[] = RELEASES) {
  return releases.filter((r) => compareVersions(r.version, version) > 0);
}

export function compareVersions(a: string, b: string) {
  const pa = a.split(".").map(Number);
  const pb = b.split(".").map(Number);
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const d = (pa[i] ?? 0) - (pb[i] ?? 0);
    if (d) return Math.sign(d);
  }
  return 0;
}
