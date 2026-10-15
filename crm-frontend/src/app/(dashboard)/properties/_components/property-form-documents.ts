export interface PropertyDocumentInput {
  fileKey?: string | null;
  fileName?: string | null;
  fileUrl?: string;
  mimeType?: string | null;
  fileSize?: number | null;
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
