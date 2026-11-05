import { cn } from "@/lib/utils";
import { completeness, completenessLabel, type ScoreField } from "@/lib/record-score";

/** The listing-quality bands the inbound team uses (0–100). */
export function scoreBand(score: number) {
  if (score >= 90) return { label: "Premium", stroke: "stroke-emerald-500", text: "text-emerald-600 dark:text-emerald-400" };
  if (score >= 75) return { label: "Featured", stroke: "stroke-blue-500", text: "text-blue-600 dark:text-blue-400" };
  if (score >= 60) return { label: "Standard", stroke: "stroke-amber-500", text: "text-amber-600 dark:text-amber-400" };
  return { label: "Needs work", stroke: "stroke-rose-500", text: "text-rose-600 dark:text-rose-400" };
}

/** A score as a ring with the number inside, coloured by its band. */
export function ScoreRing({ score, size = 48, className, label }: {
  score: number;
  size?: number;
  className?: string;
  /** Hover and screen-reader text in place of the quality band, e.g. how complete a record is. */
  label?: string;
}) {
  const value = Math.min(100, Math.max(0, Math.round(score)));
  const band = scoreBand(value);
  const stroke = size >= 40 ? 4 : 3;
  const r = (size - stroke) / 2;
  const length = 2 * Math.PI * r;
  return (
    <span
      role="img"
      aria-label={label ?? `Quality score ${value} of 100, ${band.label}`}
      title={label ?? `${band.label} · ${value}/100`}
      className={cn("relative inline-flex shrink-0 items-center justify-center", className)}
      style={{ width: size, height: size }}
    >
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="-rotate-90" aria-hidden>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" strokeWidth={stroke} className="stroke-foreground/[0.08]" />
        <circle
          cx={size / 2} cy={size / 2} r={r} fill="none" strokeWidth={stroke} strokeLinecap="round"
          strokeDasharray={length} strokeDashoffset={length * (1 - value / 100)}
          className={cn(band.stroke, "transition-[stroke-dashoffset] duration-500 ease-out")}
        />
      </svg>
      <span className={cn("absolute font-semibold tabular-nums", size >= 40 ? "text-[14px]" : "text-[11px]", band.text)}>{value}</span>
    </span>
  );
}

/** How complete a record is, from its key fields; hovering lists what's missing. */
export function CompletenessRing({ fields, size }: { fields: ScoreField[]; size?: number }) {
  const result = completeness(fields);
  return <ScoreRing score={result.score} size={size} label={completenessLabel(result)} />;
}
