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
    version: "2.5.8",
    date: "2026-11-25",
    title: "Fuller lead funnel, sources and targets on the dashboard",
    changes: [
      { kind: "improved", text: "The Lead-to-booking funnel now has every step: Contacted, Qualified, Property shared, Interested, Visit scheduled, Visit completed, Negotiation and Booked. Stage-wise leakage shows where the leads that stopped went: not interested or lost, on hold, or still being worked. A new chart shows where every lead from the period stands now. Leads converted to an inbound or agent are left out." },
      { kind: "new", text: "Leads by source shows repeat leads for each source. Pick a source, such as 99acres, to see its own funnel next to the list." },
      { kind: "improved", text: "The Lead journey on each person's Progress tab now shows Negotiation and Booked, their repeat leads, leads on hold (Future follow-up, Other location) and Not interested, Dropped and Lost separately." },
      { kind: "improved", text: "Targets sit next to Achievements on personal dashboards. Department tabs add everyone's targets up into one figure per target instead of listing each person." },
      { kind: "improved", text: "The Telecalling leaderboard shows On-time follow-up before Qualified leads and adds Site visits completed. Signals such as Top performer or Slowing down moved out of the table into their own card." },
    ],
  },
  {
    version: "2.5.7",
    date: "2026-11-24",
    title: "Correct Contacted count in the lead funnel",
    changes: [
      { kind: "fixed", text: "The Lead-to-booking funnel and Leads by source no longer count every lead as Contacted. A lead counts once someone reaches the customer: a call that connected, a message or follow-up from a person, or a status change. The automatic follow-up on new leads and unanswered calls don't count." },
    ],
  },
  {
    version: "2.5.6",
    date: "2026-11-24",
    title: "Status progress and lead requirements on the dashboard",
    changes: [
      { kind: "new", text: "Each person's Progress tab now shows where their work stands by status, as a percentage of what came in: for leads New, Contacted, Qualified, Property shared, Interested, Site visit scheduled, Site visit done and Revisit, with similar steps for inbounds and hiring. Charts show the steps over time, where everything stands now, and this period against the last. It all follows the date you pick." },
      { kind: "new", text: "The Overview has a Lead requirements section: how many requirements came in, buy or rent, average budgets, the most wanted property types, locations, roads and BHK, budget bands and how soon customers want to move." },
      { kind: "fixed", text: "Staff can only edit, add follow-ups, log calls or add photos on inbounds they can open, and an owner's phone number and email stay hidden after saving an inbound for those who can't see them." },
    ],
  },
  {
    version: "2.5.5",
    date: "2026-11-21",
    title: "Purpose and source on new inbounds",
    changes: [
      { kind: "new", text: "Adding an inbound from your phone now asks for the Purpose (Sale, Rent or Lease) and the Source, such as 99acres or Magic Bricks. Sources come from the Lead Sources list in Master Registry. The source shows on the inbound's page and in inbound reports, and the desktop form asks for it too." },
    ],
  },
  {
    version: "2.5.4",
    date: "2026-11-20",
    title: "Road name and property age on requirements",
    changes: [
      { kind: "new", text: "Requirements now have a Road name, picked from the road list in Master Registry, and a Property age: New / under construction, 1–5, 5–10 or 10+ years. Set them on the lead page or in the New Lead form. Land requirements don't ask for an age." },
    ],
  },
  {
    version: "2.5.3",
    date: "2026-11-19",
    title: "Portal repeats in the Routing Queue",
    changes: [
      { kind: "improved", text: "Leads from 99acres, Magicbricks and Excel imports all come into the Routing Queue, new and repeat. A lead that's already in the CRM shows as Repeat with who has it now. Assign it or Take Lead to move it, or Keep with owner to leave it where it is. Website repeats stay in the Enquiry Queue." },
    ],
  },
  {
    version: "2.5.2",
    date: "2026-11-19",
    title: "Repeat leads in the routing queue",
    changes: [
      { kind: "new", text: "Repeat leads in the routing queue: when 99acres, Magicbricks or an Excel import brings in a lead that's already in the CRM, it shows in the Enquiry Queue as Repeat, with the customer's remarks. Accept adds it to the lead, or Acknowledge clears it." },
      { kind: "fixed", text: "A repeat from 99acres or Magicbricks no longer says \"in an Excel import\" in the lead's Activity." },
    ],
  },
  {
    version: "2.5.1",
    date: "2026-11-19",
    title: "Portal leads and smaller screens",
    changes: [
      { kind: "fixed", text: "Leads from 99acres and Magicbricks now come straight into the routing queue." },
      { kind: "fixed", text: "Add and Edit Sublocation fit laptop and phone screens, and a long overview scrolls inside its box." },
    ],
  },
  {
    version: "2.5.0",
    date: "2026-11-17",
    title: "Notifications that reach the right people",
    changes: [
      { kind: "new", text: "Repeat leads: when an Excel import, the New Lead form or 99acres brings in a lead that's already in the CRM, its owner and their team lead are told, and the lead's Activity shows where it came from again." },
      { kind: "new", text: "The import review shows who owns each lead that already exists." },
      { kind: "new", text: "You're told when a lead, candidate, inbound property or partner is assigned to you, and when one is moved away from you." },
      { kind: "new", text: "Team leads hear about new leads and website enquiries waiting in the routing queue." },
      { kind: "new", text: "A follow-up still not done an hour after it was due is passed to your team lead." },
      { kind: "new", text: "At 3 PM you're told if you're well behind on today's targets, and your team lead gets one list of who is behind." },
      { kind: "new", text: "You're told when your monthly targets are set or changed." },
      { kind: "new", text: "Booking Advance, Agreement and Closed Won are announced to the lead's owner, their team lead and admins." },
      { kind: "new", text: "Team leads get an evening summary of the leads their team marked Not Interested, Lost or Dropped." },
      { kind: "new", text: "WhatsApp replies on leads with no owner go to that pipeline's team leads." },
      { kind: "improved", text: "Fewer repeats: no notification for a follow-up you saved yourself or a lead you assigned to yourself, and \"moved to Sales\" goes only to the owner and Sales team leads." },
      { kind: "improved", text: "Converting a lead now tells its owner and their team lead too." },
      { kind: "improved", text: "Notifications load faster: read ones are cleared after 30 days, unread ones after 90." },
    ],
  },
  {
    version: "2.4.0",
    date: "2026-11-16",
    title: "Call in one tap, and no lead left waiting",
    changes: [
      { kind: "new", text: "Call button on lead, partner, inbound and HR pages: tap it to open your phone's dialer with the number filled in. The call logger tracks the call as usual." },
      { kind: "new", text: "Leads waiting for a first contact are marked with how long they've waited in working time: green at first, amber after 15 minutes, red after an hour." },
      { kind: "new", text: "The Leads list has a \"waiting for first contact\" filter, and the Leads menu shows how many are waiting." },
      { kind: "new", text: "If a lead isn't contacted within an hour of working time, its owner gets a reminder; after two hours, their team lead is told. Managers and admins get a daily summary at 6:30 PM." },
      { kind: "new", text: "Targets are coloured by how you're doing: red, orange, yellow, and green when you're at 80% or more of where you should be today." },
      { kind: "new", text: "Converting a lead creates its partner or inbound record, and the lead page links to it." },
      { kind: "new", text: "Website Users: people who registered on the website, now in the CRM." },
      { kind: "new", text: "HR: a Contacted status after New Application, and Assigned staff and Position filters." },
      { kind: "new", text: "Commercial and industrial requirements ask for ceiling height, road access, power load, loading bay, fire safety and more." },
      { kind: "improved", text: "Sales staff and their team leads can convert their own leads." },
      { kind: "improved", text: "Converted leads leave the leads list (filter by status Converted to see them) and their status is locked." },
      { kind: "improved", text: "Scheduler: search by name, ID or phone." },
      { kind: "improved", text: "Lists remember your filters, search, tab and page on each device." },
      { kind: "improved", text: "The HR list loads faster, one page at a time." },
      { kind: "improved", text: "Listings shared with a lead show a general name with only the locality and city." },
    ],
  },
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
