"use client";

import { useState } from "react";
import { MasterCreateDialog } from "./master-create-dialog";
import type { MasterKind } from "@/lib/master-kinds";

type Pending<T> = { kind: MasterKind; query: string; cityId?: string; then: (name: string, fresh: T) => void };

/**
 * Adds a missing master item from a form: `create(kind, typed, then)` opens
 * the master's add dialog; once saved, the form's lists reload (`reload`
 * returns the fresh data) and `then` picks the new item. Render `dialog`
 * inside the form's modal so it stacks on top of it.
 */
export function useMasterCreate<T>({ reload, cities }: {
  reload: () => Promise<T>;
  /** For a new locality's city dropdown. */
  cities?: { id: number | string; name: string }[];
}) {
  const [pending, setPending] = useState<Pending<T> | null>(null);
  const create = (kind: MasterKind, query: string, then: Pending<T>["then"], opts: { cityId?: string } = {}) =>
    setPending({ kind, query, then, cityId: opts.cityId });

  const dialog = pending ? (
    <MasterCreateDialog
      key={`${pending.kind}:${pending.query}`}
      kind={pending.kind}
      initialName={pending.query}
      cities={cities}
      cityId={pending.cityId}
      onClose={() => setPending(null)}
      onCreated={async (name) => pending.then(name, await reload())}
    />
  ) : null;

  return { create, dialog };
}
