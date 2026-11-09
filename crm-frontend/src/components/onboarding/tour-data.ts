// The product tour: real screenshots of the CRM (made-up customer data), each zooming into
// the part it explains. Regions are in screenshot pixels on a 1440×900 page.

export type Rect = [x: number, y: number, w: number, h: number];

export interface Beat {
  shot: string; // file in /public/onboarding, without .webp
  focus?: Rect; // omit to show the whole page
  text: string;
}

export interface Slide {
  id: string;
  eyebrow: string;
  title: string;
  beats: Beat[];
  /** Shown on phones, where the layout differs from these desktop screenshots. */
  phone?: string;
  /** Only these roles see the slide; everyone when absent. */
  roles?: string[];
}

export const ADMIN_ROLES = ["Admin", "Super Admin"];

/** The slides this role should see. */
export const slidesFor = (role: string) => SLIDES.filter((s) => !s.roles || s.roles.includes(role));

export const SHOT_W = 1440;
export const SHOT_H = 900;
export const shotUrl = (name: string) => `/onboarding/${name}.webp`;

export const SLIDES: Slide[] = [
  {
    id: "views",
    eyebrow: "Views",
    title: "List, Kanban or Group by",
    beats: [
      { shot: "leads-list", focus: [250, 5, 170, 40], text: "Switch the view from the menu next to the page name. The CRM remembers your choice." },
      { shot: "leads-kanban", text: "Kanban shows one column per status." },
      { shot: "leads-kanban", focus: [250, 150, 280, 122], text: "Drag a card to another column to move the lead along." },
      { shot: "leads-group", focus: [912, 56, 163, 34], text: "Group by lets you pick a field: status, source, assignee and more." },
      { shot: "leads-group", focus: [252, 140, 1168, 60], text: "Leads are then listed under each value, with a count for every group." },
    ],
    phone: "On your phone, the same views are in the menu at the top of Leads.",
  },
  {
    id: "direct-edit",
    eyebrow: "Lead record",
    title: "Edit right where you read",
    beats: [
      { shot: "lead-activity", focus: [1080, 130, 360, 770], text: "Every detail of the lead sits in the panel on the right." },
      { shot: "lead-edit", focus: [1080, 380, 360, 380], text: "Click any value to change it in place. There's no separate edit screen." },
      { shot: "lead-edit", focus: [1117, 600, 309, 120], text: "Pick from the list or type. It saves as soon as you choose." },
      { shot: "lead-activity", focus: [1072, 7, 348, 33], text: "Change the status, reassign the lead or convert it from the top bar." },
    ],
  },
  {
    id: "activity",
    eyebrow: "Lead record",
    title: "Activity: the lead's whole story",
    beats: [
      { shot: "lead-activity", focus: [252, 54, 549, 38], text: "Every lead has four tabs: Activity, Conversation, Requirements and Attachments." },
      { shot: "lead-activity", focus: [273, 205, 767, 101], text: "Activity records every change: status, edits, assignments, and each property shared or downloaded." },
      { shot: "lead-activity", focus: [925, 126, 115, 30], text: "Shared shows only the properties sent to this lead, with a count." },
    ],
  },
  {
    id: "conversation",
    eyebrow: "Lead record",
    title: "Conversation: every call and message",
    beats: [
      { shot: "lead-conversation", focus: [265, 88, 779, 294], text: "Emails, WhatsApp messages, calls and shared properties, in one thread." },
      { shot: "lead-conversation", focus: [250, 850, 382, 50], text: "Log a follow-up, send an email or a WhatsApp message from the bar at the bottom." },
    ],
  },
  {
    id: "scheduler",
    eyebrow: "Scheduler",
    title: "Your day of follow-ups",
    beats: [
      { shot: "scheduler", focus: [250, 59, 1176, 73], text: "Overdue, yesterday, today, tomorrow and later. Click a day to see its follow-ups." },
      { shot: "scheduler", focus: [250, 156, 1176, 35], text: "Switch between what's left and what's done, and filter by module, staff or status." },
      { shot: "scheduler", focus: [250, 206, 1176, 250], text: "Click a row to open the record and log the follow-up." },
    ],
  },
  {
    id: "notifications",
    eyebrow: "Notifications",
    title: "Reminders that bring you back",
    beats: [
      { shot: "notifications", focus: [232, 0, 348, 210], text: "Follow-up reminders and new assignments arrive in Notifications. Click one to open the record." },
    ],
    phone: "On your phone they're in the Inbox tab, grouped by day. Swipe left to clear one.",
  },
  {
    id: "search",
    eyebrow: "Search",
    title: "Find anything in a second",
    beats: [
      { shot: "search", focus: [397, 88, 662, 544], text: "Press Ctrl+K (⌘K on a Mac), or click Search, to jump to any lead, page or registry." },
    ],
  },
  {
    id: "dashboard",
    eyebrow: "Dashboard",
    roles: ADMIN_ROLES,
    title: "Your numbers and progress",
    beats: [
      { shot: "dashboard", focus: [256, 145, 1160, 265], text: "The numbers that matter for your role, compared with the period before." },
      { shot: "dashboard", focus: [256, 426, 768, 404], text: "Trends over time. Point at a line to see the exact figures." },
      { shot: "dashboard", focus: [1040, 426, 376, 404], text: "The lead pipeline. Point at a colour for its count." },
      { shot: "dashboard", focus: [256, 78, 330, 36], text: "Staff also get a Progress tab: score, streak, best day and achievements to unlock." },
    ],
  },
  {
    id: "updates",
    eyebrow: "Updates",
    title: "New versions arrive by themselves",
    beats: [
      { shot: "update", focus: [0, 760, 232, 140], text: "When a new version is out, it appears at the bottom of the sidebar. One click installs it, and we'll show you what's new." },
    ],
  },
];

export const slideById = (id: string) => SLIDES.find((s) => s.id === id);
