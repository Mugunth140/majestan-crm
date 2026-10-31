export interface PropertyDocumentInput {
  fileKey?: string | null;
  fileName?: string | null;
  fileUrl?: string;
  mimeType?: string | null;
  fileSize?: number | null;
  isPublic?: boolean;
  documentType?: string | null;
  title?: string | null;
}

/** Keep custom floor names separate from the original uploaded filename. */
export function getFloorPlanTitle(document: Pick<PropertyDocumentInput, "title" | "fileName">): string {
  return (document.title ?? document.fileName?.replace(/\.[^.]+$/, "").replace(/[_-]+/g, " ") ?? "Floor Plan").trim();
}

export function getFloorPlans<T extends PropertyDocumentInput>(documents: T[] = []): T[] {
  return documents.filter((document) => document.documentType === "floor_plan" && document.fileKey);
}

/** Upgrade older drafts that stored only the first plan in a document slot. */
export function restoreLegacyFloorPlans(documents: Record<string, PropertyDocumentInput | null>, initialPlans: PropertyDocumentInput[]) {
  const first = documents.floor_plan;
  const plans = first?.fileKey ? [first, ...initialPlans.slice(1)] : initialPlans.slice(1);
  return plans.filter((plan, index) => plans.findIndex((p) => p.fileKey === plan.fileKey) === index);
}

export function toPropertyDocumentPayload(document: PropertyDocumentInput) {
  return {
    fileKey: document.fileKey ?? "",
    fileName: document.fileName ?? "",
    mimeType: document.mimeType ?? undefined,
    fileSize: document.fileSize ?? undefined,
    documentType: "floor_plan",
    title: getFloorPlanTitle(document) || "Floor Plan",
  };
}

/** Retain all existing attachments when general document controls are hidden. */
export function preserveNonPlanDocuments(documents: PropertyDocumentInput[] = []) {
  return documents.filter((doc) => doc.fileKey && doc.documentType !== "floor_plan").map((doc) => ({
    fileKey: doc.fileKey!, fileName: doc.fileName || doc.title || "Document",
    documentType: doc.documentType || "other", title: doc.title || doc.fileName || "Document",
    mimeType: doc.mimeType || undefined, fileSize: doc.fileSize ?? undefined,
  }));
}

/** An absent replacement list means attachments were not edited. Only the
 * first visible document in a slot may be removed/replaced by that control;
 * duplicate and unrepresented attachments retain their original metadata. */
export function reconcilePropertyDocuments(
  original: PropertyDocumentInput[],
  initialSlots: Record<string, PropertyDocumentInput | null>,
  slots: Record<string, PropertyDocumentInput | null>,
  initialPlans: PropertyDocumentInput[],
  plans: PropertyDocumentInput[],
  showSlots = true,
) {
  const editedSlots = showSlots ? Object.keys(initialSlots).filter((key) =>
    (initialSlots[key]?.fileKey ?? null) !== (slots[key]?.fileKey ?? null),
  ) : [];
  if (!editedSlots.length && JSON.stringify(initialPlans) === JSON.stringify(plans)) return undefined;
  const removed = new Set(editedSlots.map((key) => initialSlots[key]?.fileKey).filter(Boolean));
  const kept = original.filter((doc) => doc.documentType !== "floor_plan" && !removed.has(doc.fileKey));
  const added = editedSlots.flatMap((key) => slots[key]?.fileKey
    ? [{ ...slots[key]!, documentType: key, title: slots[key]!.fileName }]
    : []);
  return [...kept, ...added, ...plans.map(toPropertyDocumentPayload)].map((doc) => ({
    ...doc, fileSize: doc.fileSize ?? undefined, mimeType: doc.mimeType ?? undefined,
  }));
}
