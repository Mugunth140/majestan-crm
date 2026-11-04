import { cn } from "@/lib/utils";

// Soft tint + strong letter, each readable in light and dark.
const PALETTE = [
  "bg-rose-100 text-rose-700 dark:bg-rose-500/20 dark:text-rose-300",
  "bg-orange-100 text-orange-700 dark:bg-orange-500/20 dark:text-orange-300",
  "bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-300",
  "bg-lime-100 text-lime-700 dark:bg-lime-500/20 dark:text-lime-300",
  "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-300",
  "bg-teal-100 text-teal-700 dark:bg-teal-500/20 dark:text-teal-300",
  "bg-sky-100 text-sky-700 dark:bg-sky-500/20 dark:text-sky-300",
  "bg-blue-100 text-blue-700 dark:bg-blue-500/20 dark:text-blue-300",
  "bg-indigo-100 text-indigo-700 dark:bg-indigo-500/20 dark:text-indigo-300",
  "bg-violet-100 text-violet-700 dark:bg-violet-500/20 dark:text-violet-300",
  "bg-fuchsia-100 text-fuchsia-700 dark:bg-fuchsia-500/20 dark:text-fuchsia-300",
  "bg-pink-100 text-pink-700 dark:bg-pink-500/20 dark:text-pink-300",
];

/** A colour picked from the name, so the same person keeps the same colour everywhere. */
export function avatarColor(name?: string) {
  let h = 0;
  for (const ch of name?.trim().toLowerCase() ?? "") h = (h * 31 + ch.charCodeAt(0)) | 0;
  return PALETTE[Math.abs(h) % PALETTE.length];
}

// Round first-letter avatar.
export function NameAvatar({ name, src, className }: { name?: string; src?: string | null; className?: string }) {
  // eslint-disable-next-line @next/next/no-img-element -- CDN photo, already small
  if (src) return <img src={src} alt="" aria-hidden className={cn("size-6 shrink-0 rounded-full bg-muted object-cover", className)} />;
  return (
    <span
      aria-hidden
      className={cn(
        "flex size-6 shrink-0 items-center justify-center rounded-full text-[11px] font-medium",
        avatarColor(name),
        className,
      )}
    >
      {(name?.trim().charAt(0) || "?").toUpperCase()}
    </span>
  );
}
