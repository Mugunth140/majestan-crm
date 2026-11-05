import { NAVIGATION, canSee, type NavItem, type NavViewer } from "@/components/layout/nav-items";

// The sidebar's modules arranged for the phone app: Home shows them as app
// icons, More as grouped lists. Each gets a solid tile colour (the sidebar's
// hue) behind a white glyph.

export interface AppModule extends NavItem {
  href: string;
  tile: string;
}

const TILES: Record<string, string> = {
  "/": "bg-blue-500",
  "/analytics": "bg-cyan-700",
  "/scheduler": "bg-sky-600",
  "/leads": "bg-emerald-600",
  "/lead-routing": "bg-violet-500",
  "/inbound": "bg-cyan-600",
  "/agent-network": "bg-indigo-500",
  "/projects": "bg-amber-500",
  "/properties": "bg-teal-600",
  "/builders": "bg-orange-500",
  "/ads": "bg-pink-500",
  "/blog": "bg-sky-500",
  "/showcases": "bg-fuchsia-500",
  "/asset-inventory": "bg-yellow-500",
  "/hr": "bg-rose-500",
  "/tasks": "bg-red-500",
  "/logger": "bg-lime-600",
  "/activity-logs": "bg-slate-500",
  "/users": "bg-purple-500",
  "/master": "bg-stone-500",
};

const GROUPS: { title: string; hrefs: string[] }[] = [
  { title: "Sales", hrefs: ["/scheduler", "/leads", "/lead-routing", "/inbound", "/agent-network", "/logger"] },
  { title: "Inventory", hrefs: ["/projects", "/properties", "/builders", "/asset-inventory"] },
  { title: "Marketing", hrefs: ["/ads", "/blog", "/showcases"] },
  { title: "Team", hrefs: ["/analytics", "/tasks", "/hr", "/users", "/activity-logs", "/master"] },
];

/** Every module this user may open, except the dashboard itself. */
export function appModules(viewer: NavViewer | null): AppModule[] {
  return NAVIGATION.filter((item) => canSee(item, viewer))
    .map((item) => ({ ...item, href: item.href ?? "/master", tile: TILES[item.href ?? "/master"] ?? "bg-zinc-500" }))
    .filter((m) => m.href !== "/");
}

/** The user's modules in titled groups, leaving out the ones already on the tab bar. */
export function moduleGroups(viewer: NavViewer | null, skip: readonly string[] = []) {
  const modules = appModules(viewer).filter((m) => !skip.includes(m.href));
  return GROUPS.map((g) => ({
    title: g.title,
    modules: g.hrefs.map((h) => modules.find((m) => m.href === h)).filter((m): m is AppModule => !!m),
  })).filter((g) => g.modules.length > 0);
}
