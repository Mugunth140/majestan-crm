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
