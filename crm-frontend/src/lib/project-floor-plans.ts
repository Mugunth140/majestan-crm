export interface ProjectFloorPlan {
  floorName: string;
  imageKey: string;
  imageUrl?: string;
}

export interface ProjectFloorPlanDraft extends ProjectFloorPlan {
  /** Stable client identity; removed when building the API payload. */
  id: string;
}

export const FLOOR_PLAN_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"] as const;
export const MAX_FLOOR_PLAN_IMAGE_BYTES = 15 * 1024 * 1024;

export function floorPlansFromUnit(unit: unknown, makeId: () => string): ProjectFloorPlanDraft[] {
  const data = unit && typeof unit === "object" ? unit as Record<string, unknown> : {};
  if (Array.isArray(data.floorPlans)) {
    return data.floorPlans.map((item: unknown) => {
      const plan = item && typeof item === "object" ? item as Record<string, unknown> : {};
      return {
        id: typeof plan.id === "string" ? plan.id : makeId(),
        floorName: typeof plan.floorName === "string" ? plan.floorName : "",
        imageKey: typeof plan.imageKey === "string" ? plan.imageKey : "",
        ...(typeof plan.imageUrl === "string" && plan.imageUrl ? { imageUrl: plan.imageUrl } : {}),
      };
    });
  }
  const imageKey = data.floorPlanImageKey || data.floorPlanImageUrl;
  if (!imageKey) return [];
  return [{
    id: makeId(),
    floorName: "Existing plan",
    imageKey: String(imageKey),
    ...(data.floorPlanImageUrl ? { imageUrl: String(data.floorPlanImageUrl) } : {}),
  }];
}

export function duplicateFloorNameIndex(plans: Array<{ floorName: string }>): number {
  const names = new Set<string>();
  for (let index = 0; index < plans.length; index += 1) {
    const normalized = plans[index].floorName.trim().replace(/\s+/g, " ").toLowerCase();
    if (!normalized) continue;
    if (names.has(normalized)) return index;
    names.add(normalized);
  }
  return -1;
}

export function floorPlanRowError(plan: { floorName: string; imageKey: string }): string | null {
  if (!plan.floorName.trim()) return "Enter a name for each floor plan.";
  if (!plan.imageKey.trim()) return `Add an image for ${plan.floorName.trim()}.`;
  return null;
}

export function floorPlansPayload(plans: ProjectFloorPlanDraft[]): ProjectFloorPlan[] {
  return plans.map(({ floorName, imageKey, imageUrl }) => ({
    floorName: floorName.trim(),
    imageKey: imageKey.trim(),
    ...(imageUrl?.trim() ? { imageUrl: imageUrl.trim() } : {}),
  }));
}

export function legacyFloorPlanPayload(
  imageUrl: string,
  imageKey: string,
  isPlotUnit: boolean,
): { floorPlanImageUrl: string | undefined; floorPlanImageKey: string | undefined } {
  const url = imageUrl.trim();
  const key = imageKey.trim();
  return isPlotUnit
    ? { floorPlanImageUrl: url, floorPlanImageKey: key }
    : { floorPlanImageUrl: url || undefined, floorPlanImageKey: key || undefined };
}

export function floorPlanFileError(file: Pick<File, "type" | "size">): string | null {
  if (file.size === 0) return "The selected image is empty.";
  if (!(FLOOR_PLAN_IMAGE_TYPES as readonly string[]).includes(file.type))
    return "Use a JPEG, PNG, or WebP image.";
  if (file.size > MAX_FLOOR_PLAN_IMAGE_BYTES) return "Floor plan images must be 15 MB or smaller.";
  return null;
}
