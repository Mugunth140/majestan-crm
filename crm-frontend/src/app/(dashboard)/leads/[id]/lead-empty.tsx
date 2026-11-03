import type { ReactNode } from "react";

// Empty states for the lead page's tabs: a small drawing, a line of text and
// the action that fills the tab. Drawn with theme colours so they sit right in
// light and dark.

const BRAND = "fill-[#017D58] dark:fill-[#2FB585]";
const BRAND_STROKE = "stroke-[#017D58] dark:stroke-[#2FB585]";

export function EmptyState({ art, title, hint, action }: { art: ReactNode; title: string; hint: string; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center px-4 py-12 text-center md:py-16">
      <div className="mb-5 h-[112px] w-[150px]" aria-hidden>{art}</div>
      <p className="text-[15px] font-semibold text-foreground">{title}</p>
      <p className="mt-1 max-w-[320px] text-[13px] leading-5 text-muted-foreground">{hint}</p>
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

/** A checklist card with a house: what the lead is looking for. */
export function RequirementsArt() {
  return (
    <svg viewBox="0 0 150 112" fill="none" className="h-full w-full">
      <ellipse cx="75" cy="104" rx="52" ry="5" className="fill-foreground/[0.05]" />
      <rect x="30" y="10" width="78" height="88" rx="10" className="fill-card stroke-border" strokeWidth="1.5" />
      <rect x="54" y="4" width="30" height="12" rx="4" className="fill-muted stroke-border" strokeWidth="1.5" />
      {[34, 52, 70].map((y, i) => (
        <g key={y}>
          <rect x="42" y={y} width="10" height="10" rx="3" className={i === 0 ? BRAND : "fill-muted"} />
          {i === 0 && <path d={`M44.5 ${y + 5.2}l2 2 3.6-4`} className="stroke-white dark:stroke-black" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />}
          <rect x="58" y={y + 2} width={i === 1 ? 30 : 38} height="3" rx="1.5" className="fill-foreground/15" />
          <rect x="58" y={y + 7} width={i === 2 ? 18 : 24} height="2.5" rx="1.25" className="fill-foreground/[0.08]" />
        </g>
      ))}
      <circle cx="112" cy="74" r="24" className="fill-background stroke-border" strokeWidth="1.5" />
      <path d="M101 76.5 112 67l11 9.5" className={BRAND_STROKE} strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M104 74.5V85h16V74.5" className={BRAND_STROKE} strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
      <rect x="109.5" y="78" width="5" height="7" rx="1" className={BRAND} />
    </svg>
  );
}

/** Two sheets held by a clip: files shared with or about the lead. */
export function AttachmentsArt() {
  return (
    <svg viewBox="0 0 150 112" fill="none" className="h-full w-full">
      <ellipse cx="75" cy="104" rx="52" ry="5" className="fill-foreground/[0.05]" />
      <g transform="rotate(-8 60 56)">
        <rect x="28" y="16" width="62" height="78" rx="8" className="fill-muted stroke-border" strokeWidth="1.5" />
      </g>
      <rect x="50" y="12" width="64" height="82" rx="8" className="fill-card stroke-border" strokeWidth="1.5" />
      <path d="M98 12v12a4 4 0 0 0 4 4h12" className="stroke-border" strokeWidth="1.5" />
      <rect x="61" y="40" width="32" height="3.5" rx="1.75" className="fill-foreground/15" />
      <rect x="61" y="50" width="42" height="3" rx="1.5" className="fill-foreground/[0.08]" />
      <rect x="61" y="58" width="36" height="3" rx="1.5" className="fill-foreground/[0.08]" />
      <rect x="61" y="66" width="40" height="3" rx="1.5" className="fill-foreground/[0.08]" />
      <path
        d="M66 4v20a7 7 0 0 0 14 0V9a4.5 4.5 0 0 0-9 0v14a2 2 0 0 0 4 0V11"
        className="stroke-foreground/40"
        strokeWidth="2.2"
        strokeLinecap="round"
      />
      <circle cx="114" cy="84" r="13" className={BRAND} />
      <path d="M114 78.5v11M108.5 84h11" className="stroke-white dark:stroke-black" strokeWidth="2.4" strokeLinecap="round" />
    </svg>
  );
}
