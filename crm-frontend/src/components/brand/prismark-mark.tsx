import type { SVGProps } from "react";

// Prismark mark on a 4×4 grid. Fills with currentColor so it can be tinted via text-* classes.
export const PRISMARK_MARK_PATH = "M0 0h4v4H2V2H0zM2 1v1h1V1z";

export function PrismarkMark({ title = "Prismark", ...props }: SVGProps<SVGSVGElement> & { title?: string }) {
  return (
    <svg viewBox="0 0 4 4" fill="currentColor" fillRule="evenodd" shapeRendering="crispEdges" role="img" {...props}>
      <title>{title}</title>
      <path d={PRISMARK_MARK_PATH} />
    </svg>
  );
}
