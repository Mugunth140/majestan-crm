import type { ComponentType } from "react";
import {
  Activity,
  Armchair,
  BedDouble,
  Building2,
  ClipboardList,
  FileSpreadsheet,
  Compass,
  Filter,
  KeyRound,
  Mail,
  Map as MapIcon,
  MapPin,
  Palette,
  Plug,
  Receipt,
  Ruler,
  Settings,
  Signpost,
  UserRound,
  UserSearch,
  BookOpen,
  ChartNoAxesCombined,
  CalendarClock,
  Briefcase,
  Database,
  Gauge,
  Hammer,
  Home,
  Inbox,
  Megaphone,
  Network,
  Package,
  PhoneIncoming,
  Route,
  Sparkles,
  Target,
  TrendingUp,
  UserPen,
  Users,
  type LucideProps,
} from "lucide-react";
import { can } from "@/lib/permissions";
import { isAdminRole, visibleNav, type NavAccessViewer, type NavKey } from "@/lib/nav-access";

export interface NavItem {
  name: string;
  href?: string;
  icon: ComponentType<LucideProps>;
  /** Icon colour (Tailwind text classes, light + dark) */
  color: string;
  /** Shown or hidden per user on the Access tab; the dashboard has none and is always shown. */
  key?: NavKey;
  /** Admins only, whatever a user's Access tab says. */
  adminOnly?: boolean;
  subItems?: SubItem[];
}

export interface SubItem {
  name: string;
  href: string;
  icon?: ComponentType<LucideProps>;
  color?: string;
}

// Sidebar navigation, also searched by the ⌘K palette.
export const NAVIGATION: NavItem[] = [
  { name: "Dashboard", href: "/", icon: Gauge, color: "text-blue-600 dark:text-blue-400" },
  { name: "Analytics", key: "analytics", href: "/analytics", icon: ChartNoAxesCombined, color: "text-cyan-700 dark:text-cyan-300" },
  { name: "Reports", href: "/reports", adminOnly: true, icon: FileSpreadsheet, color: "text-green-600 dark:text-green-400" },
  { name: "Scheduler", key: "scheduler", href: "/scheduler", icon: CalendarClock, color: "text-sky-600 dark:text-sky-400" },
  { name: "Leads", key: "leads", href: "/leads", icon: TrendingUp, color: "text-emerald-600 dark:text-emerald-400" },
  { name: "Routing", key: "routing", href: "/lead-routing", icon: Route, color: "text-violet-600 dark:text-violet-400" },
  { name: "Inbound", key: "inbound", href: "/inbound", icon: Inbox, color: "text-cyan-600 dark:text-cyan-400" },
  { name: "Agent Network", key: "agent-network", href: "/agent-network", icon: Network, color: "text-indigo-600 dark:text-indigo-400" },
  { name: "Projects", key: "projects", href: "/projects", icon: Briefcase, color: "text-amber-600 dark:text-amber-400" },
  { name: "Properties", key: "properties", href: "/properties", icon: Home, color: "text-teal-600 dark:text-teal-400" },
  { name: "Builder", key: "builders", href: "/builders", icon: Hammer, color: "text-orange-600 dark:text-orange-400" },
  { name: "Advertisement", key: "ads", href: "/ads", icon: Megaphone, color: "text-pink-600 dark:text-pink-400" },
  { name: "Blog", key: "blog", href: "/blog", icon: BookOpen, color: "text-sky-600 dark:text-sky-400" },
  { name: "Showcases", key: "showcases", href: "/showcases", icon: Sparkles, color: "text-fuchsia-600 dark:text-fuchsia-400" },
  { name: "Asset Inventory", key: "asset-inventory", href: "/asset-inventory", icon: Package, color: "text-yellow-600 dark:text-yellow-400" },
  { name: "HR Panel", key: "hr", href: "/hr", icon: UserPen, color: "text-rose-600 dark:text-rose-400" },
  { name: "Tasks", key: "tasks", href: "/tasks", icon: Target, color: "text-red-600 dark:text-red-400" },
  { name: "Logger", key: "logger", href: "/logger", icon: PhoneIncoming, color: "text-lime-600 dark:text-lime-400" },
  { name: "Activity Logs", key: "activity-logs", href: "/activity-logs", icon: Activity, color: "text-slate-600 dark:text-slate-300" },
  { name: "Users", key: "users", href: "/users", icon: Users, color: "text-purple-600 dark:text-purple-400" },
  {
    name: "Master Registry",
    key: "master",
    icon: Database,
    color: "text-stone-600 dark:text-stone-300",
    subItems: [
      { name: "Amenities", href: "/master/amenities", icon: Sparkles, color: "text-fuchsia-600 dark:text-fuchsia-400" },
      { name: "Lead Sources", href: "/master/sources", icon: Filter, color: "text-blue-600 dark:text-blue-400" },
      { name: "HR Sources", href: "/master/hr-sources", icon: UserSearch, color: "text-indigo-600 dark:text-indigo-400" },
      { name: "Property Types", href: "/master/property-types", icon: Building2, color: "text-violet-600 dark:text-violet-400" },
      { name: "Cities", href: "/master/cities", icon: MapPin, color: "text-emerald-600 dark:text-emerald-400" },
      { name: "Sublocations", href: "/master/sublocations", icon: MapIcon, color: "text-amber-600 dark:text-amber-400" },
      { name: "Road Names", href: "/master/road-names", icon: Signpost, color: "text-orange-600 dark:text-orange-400" },
      { name: "Registration Charges", href: "/master/registration-charges", icon: Receipt, color: "text-lime-600 dark:text-lime-400" },
      { name: "Furnishing Items", href: "/master/furnishing-items", icon: Armchair, color: "text-yellow-600 dark:text-yellow-400" },
      { name: "Room Names", href: "/master/room-names", icon: BedDouble, color: "text-rose-600 dark:text-rose-400" },
      { name: "Room Dimensions", href: "/master/room-dimensions", icon: Ruler, color: "text-teal-600 dark:text-teal-400" },
      { name: "Specifications", href: "/master/specifications", icon: ClipboardList, color: "text-sky-600 dark:text-sky-400" },
      { name: "Utilities", href: "/master/utilities", icon: Plug, color: "text-cyan-600 dark:text-cyan-400" },
    ],
  },
];

/** Everyone's own settings. Not a module, so it isn't on the Access tab; the sidebar opens it as its own panel. */
export const SETTINGS: NavItem = {
  name: "Settings",
  href: "/settings",
  icon: Settings,
  color: "text-zinc-600 dark:text-zinc-300",
  subItems: [
    { name: "Profile", href: "/settings", icon: UserRound, color: "text-blue-600 dark:text-blue-400" },
    { name: "Password", href: "/settings/password", icon: KeyRound, color: "text-amber-600 dark:text-amber-400" },
    { name: "Appearance", href: "/settings/appearance", icon: Palette, color: "text-violet-600 dark:text-violet-400" },
    { name: "Email templates", href: "/settings/email-templates", icon: Mail, color: "text-sky-600 dark:text-sky-400" },
    { name: "Tour and help", href: "/settings/tour", icon: Compass, color: "text-emerald-600 dark:text-emerald-400" },
  ],
};

export type NavViewer = NavAccessViewer;

/** Whether this user's sidebar shows the item. */
export function canSee(item: NavItem, viewer: NavViewer | null) {
  if (item.adminOnly) return isAdminRole(viewer?.role);
  return !item.key || visibleNav(viewer).has(item.key);
}

/** The sidebar item a page belongs to, if any. */
export function navItemFor(pathname: string): NavItem | undefined {
  const under = (href: string) => href !== "/" && (pathname === href || pathname.startsWith(href + "/"));
  return NAVIGATION.find((item) => (item.href ? under(item.href) : item.subItems?.some((s) => under(s.href.replace(/\/[^/]+$/, "")))));
}

/** Whether this user may open the page: pages outside the sidebar are always open. */
export function canOpen(pathname: string, viewer: NavViewer | null) {
  const item = navItemFor(pathname);
  return !item || canSee(item, viewer);
}

export interface StoredUser extends NavViewer {
  name: string;
  /** Profile photo URL, when they've set one. */
  avatar: string | null;
}

/** The signed-in user as the navigation needs them (null before sign-in or if storage is unreadable). */
export function readUser(): StoredUser | null {
  try {
    const raw = localStorage.getItem("crm_user");
    if (!raw) return null;
    const user = JSON.parse(raw);
    return {
      name: user?.name ?? user?.email ?? "",
      role: user?.role?.name ?? user?.role ?? "",
      department: user?.department?.name ?? user?.department ?? "",
      blogAccess: can("blog.manage", user),
      navAccess: Array.isArray(user?.nav_access) ? user.nav_access : null,
      avatar: user?.avatar_url ?? null,
    };
  } catch {
    return null;
  }
}
