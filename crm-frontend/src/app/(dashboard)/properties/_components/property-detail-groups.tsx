"use client";

import { Fragment, isValidElement, type ReactElement, type ReactNode } from "react";

// The Details step lists a property's fields under the same headings for
// every type (size, rooms, building, …), so staff find like data together
// whatever they are adding. A type's block tags each run of fields with
// <In group="…">; <DetailGroups> gathers them under their heading, in order.

export const DETAIL_GROUPS = [
  ["area", "Size & area"],
  ["rooms", "Rooms & layout"],
  ["building", "Building & floors"],
  ["parking", "Parking & access"],
  ["services", "Power, water & services"],
  ["furnishing", "Furnishing"],
  ["amenities", "Amenities"],
  ["land", "Land & farm"],
  ["use", "Use & suitability"],
  ["approvals", "Approvals & finance"],
  ["notes", "Additional notes"],
] as const;

export type DetailGroup = (typeof DETAIL_GROUPS)[number][0];

type InProps = {
  group: DetailGroup;
  children?: ReactNode;
};

/** Marks fields as belonging to a Details heading; rendered by <DetailGroups>. */
export function In({ children }: InProps) {
  return <>{children}</>;
}

/** Elements and fragments in render order, with the path each was found at. */
function flatten(node: ReactNode, path: string, out: [string, ReactElement][]) {
  const walk = (n: ReactNode, p: string) => {
    if (n == null || typeof n === "boolean") return;
    if (Array.isArray(n)) return n.forEach((c, i) => walk(c, `${p}.${i}`));
    if (isValidElement(n) && n.type === Fragment) return walk((n.props as { children?: ReactNode }).children, `${p}${n.key != null ? `:${n.key}` : ""}`);
    if (isValidElement(n)) out.push([n.key != null ? `${p}:${n.key}` : p, n]);
  };
  walk(node, path);
}

/** The tagged fields under each heading, in heading order; headings with no fields are left out. */
export function detailGroupsOf(children: ReactNode) {
  const tagged: [string, ReactElement][] = [];
  flatten(children, "g", tagged);
  const buckets = new Map<DetailGroup, ReactNode[]>();
  for (const [path, el] of tagged) {
    if (el.type !== In) continue;
    const { group, children: inner } = el.props as InProps;
    const fields: [string, ReactElement][] = [];
    flatten(inner, path, fields);
    if (!fields.length) continue;
    buckets.set(group, [...(buckets.get(group) ?? []), ...fields.map(([key, f]) => <Fragment key={key}>{f}</Fragment>)]);
  }
  return DETAIL_GROUPS.flatMap(([key, title]) => (buckets.has(key) ? [{ key, title, fields: buckets.get(key)! }] : []));
}

export function DetailGroups({ children }: { children: ReactNode }) {
  return (
    <div className="space-y-8">
      {detailGroupsOf(children).map(({ key, title, fields }) => (
        // A field component can still render nothing; hide the heading then.
        <section key={key} data-detail-group={key} className="space-y-4 border-t border-border/60 pt-6 first:border-t-0 first:pt-0 [&:not(:has(>div>*))]:hidden">
          <h4 className="text-sm font-semibold text-foreground">{title}</h4>
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">{fields}</div>
        </section>
      ))}
    </div>
  );
}
