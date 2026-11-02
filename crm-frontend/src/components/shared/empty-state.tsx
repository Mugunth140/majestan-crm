import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { EmptyIllustration, type IllustrationKind } from "./empty-illustration";

// Illustrated empty / error state: picture, short title, one line of help, optional action.
export function EmptyState({
  kind = "records",
  title,
  description,
  action,
  className,
  compact = false,
}: {
  kind?: IllustrationKind;
  title: ReactNode;
  description?: ReactNode;
  action?: ReactNode;
  className?: string;
  /** Smaller picture for tight spots (board columns, side panels) */
  compact?: boolean;
}) {
  return (
    <div className={cn("empty-in flex flex-col items-center justify-center px-6 text-center", compact ? "py-6" : "py-14", className)}>
      <div className={cn("empty-ill empty-ill-float", compact ? "w-28" : "w-44")}>
        <EmptyIllustration kind={kind} className="h-auto w-full overflow-visible" />
      </div>
      <p className={cn("font-medium text-foreground", compact ? "mt-3 text-[13px]" : "mt-5 text-[15px]")}>{title}</p>
      {description && <p className="mt-1 max-w-sm text-[13px] leading-5 text-muted-foreground">{description}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}
