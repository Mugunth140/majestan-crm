import type { ComponentType } from "react";
import {
  Activity,
  BookOpen,
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
import { canViewAds } from "@/lib/ads-access";
import { can } from "@/lib/permissions";

export type NavAccess = "adminOnly" | "adminOrManager" | "adsAccess" | "blogAccess";

export interface NavItem {
  name: string;
  href?: string;
  icon: ComponentType<LucideProps>;
  /** Icon colour (Tailwind text classes, light + dark) */
  color: string;
  access?: NavAccess;
  subItems?: { name: string; href: string }[];
}

// Sidebar navigation, also searched by the ⌘K palette.
export const NAVIGATION: NavItem[] = [
  { name: "Dashboard", href: "/", icon: Gauge, color: "text-blue-600 dark:text-blue-400" },
  { name: "Leads", href: "/leads", icon: TrendingUp, color: "text-emerald-600 dark:text-emerald-400" },
  { name: "Lead Routing", href: "/lead-routing", icon: Route, color: "text-violet-600 dark:text-violet-400" },
  { name: "Inbound", href: "/inbound", icon: Inbox, color: "text-cyan-600 dark:text-cyan-400" },
  { name: "Agent Network", href: "/agent-network", icon: Network, color: "text-indigo-600 dark:text-indigo-400" },
  { name: "Projects", href: "/projects", icon: Briefcase, color: "text-amber-600 dark:text-amber-400" },
  { name: "Properties", href: "/properties", icon: Home, color: "text-teal-600 dark:text-teal-400" },
  { name: "Builder", href: "/builders", icon: Hammer, color: "text-orange-600 dark:text-orange-400" },
  { name: "Advertisement", href: "/ads", icon: Megaphone, color: "text-pink-600 dark:text-pink-400", access: "adsAccess" },
  { name: "Blog", href: "/blog", icon: BookOpen, color: "text-sky-600 dark:text-sky-400", access: "blogAccess" },
  { name: "Showcases", href: "/showcases", icon: Sparkles, color: "text-fuchsia-600 dark:text-fuchsia-400", access: "adsAccess" },
  { name: "Asset Inventory", href: "/asset-inventory", icon: Package, color: "text-yellow-600 dark:text-yellow-400" },
  { name: "HR Panel", href: "/hr", icon: UserPen, color: "text-rose-600 dark:text-rose-400" },
  { name: "Tasks", href: "/tasks", icon: Target, color: "text-red-600 dark:text-red-400" },
  { name: "Logger", href: "/logger", icon: PhoneIncoming, color: "text-lime-600 dark:text-lime-400", access: "adminOrManager" },
  { name: "Activity Logs", href: "/activity-logs", icon: Activity, color: "text-slate-600 dark:text-slate-300", access: "adminOnly" },
  { name: "Users", href: "/users", icon: Users, color: "text-purple-600 dark:text-purple-400", access: "adminOnly" },
  {
    name: "Master Registry",
    icon: Database,
    color: "text-stone-600 dark:text-stone-300",
    access: "adminOnly",
    subItems: [
      { name: "Amenities", href: "/master/amenities" },
      { name: "Lead Sources", href: "/master/sources" },
      { name: "HR Sources", href: "/master/hr-sources" },
      { name: "Property Types", href: "/master/property-types" },
      { name: "Cities", href: "/master/cities" },
      { name: "Sublocations", href: "/master/sublocations" },
      { name: "Road Names", href: "/master/road-names" },
      { name: "Registration Charges", href: "/master/registration-charges" },
      { name: "Furnishing Items", href: "/master/furnishing-items" },
      { name: "Room Names", href: "/master/room-names" },
      { name: "Room Dimensions", href: "/master/room-dimensions" },
      { name: "Specifications", href: "/master/specifications" },
      { name: "Utilities", href: "/master/utilities" },
    ],
  },
];

export interface NavViewer {
  role: string;
  department: string;
  blogAccess: boolean;
}

export function canSee(access: NavAccess | undefined, viewer: NavViewer | null) {
  if (!access) return true;
  const role = viewer?.role ?? "";
  const isAdmin = role === "Admin" || role === "Super Admin";
  if (access === "adminOnly") return isAdmin;
  if (access === "adminOrManager") return isAdmin || role === "Manager";
  if (access === "blogAccess") return !!viewer?.blogAccess;
  return canViewAds({ role, department: viewer?.department ?? "" });
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
      avatar: user?.avatar_url ?? null,
    };
  } catch {
    return null;
  }
}
