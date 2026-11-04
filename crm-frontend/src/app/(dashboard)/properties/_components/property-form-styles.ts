import { FOCUS_FIELD } from "@/components/shared/focus-modal";
import { cn } from "@/lib/utils";

// Field styles shared with every create form (see FocusModal).
export const PROPERTY_LABEL = "text-[14px] font-medium text-foreground";
export const PROPERTY_FIELD = cn(FOCUS_FIELD, "h-9");
export const PROPERTY_TEXTAREA = cn(FOCUS_FIELD, "resize-none py-2");
export const PROPERTY_SELECT = cn(FOCUS_FIELD, "h-9! rounded-md! border-border! text-[14px]!");
/** A box of related fields (a portion, a room, a sharing option). */
export const PROPERTY_GROUP = "rounded-lg border border-border/60 bg-muted/10 p-4";
