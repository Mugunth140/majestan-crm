export const PROJECT_DRAFT_VERSION = 2;

export type ProjectDraft = {
  v: number;
  baseRevision?: number;
  data: Record<string, unknown>;
};

export function projectDraftKey(mode: "create" | "edit", id: unknown, userId: unknown): string {
  return `project-form-draft:user:${userId}:${mode === "edit" ? `edit:${id}` : "new"}`;
}

export function canRestoreProjectDraft(draft: ProjectDraft, mode: "create" | "edit", revision?: number): boolean {
  return draft.v === PROJECT_DRAFT_VERSION &&
    (mode === "create" || (Number.isInteger(revision) && Number(revision) > 0 && draft.baseRevision === revision));
}

export function readProjectDraft(raw: string | null): ProjectDraft | null {
  try {
    if (!raw) return null;
    const value = JSON.parse(raw);
    if (!value || typeof value.v !== "number" || !value.data || typeof value.data !== "object" || Array.isArray(value.data)) return null;
    return value;
  } catch { return null; }
}

/** Remove the active stale draft only AFTER its recovery copy is durable. */
export function archiveProjectDraft(storage: Pick<Storage, "setItem" | "removeItem">, key: string, draft: ProjectDraft): string | null {
  const backupKey = `${key}:recovery:${Date.now()}:${Math.random().toString(36).slice(2)}`;
  try {
    storage.setItem(backupKey, JSON.stringify(draft));
    storage.removeItem(key);
    return backupKey;
  } catch { return null; }
}
