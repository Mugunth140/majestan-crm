import type { ReactNode } from "react";
import "./empty-state.css";

// Small isometric "sticker" illustrations for empty and error states: chunky
// outlined objects with dotted side faces on a soft backdrop that follows the
// object's silhouette. Drawn in code so they stay crisp and theme-aware.

export type IllustrationKind = "records" | "search" | "tasks" | "inbox" | "people" | "notFound" | "error";

const C = Math.cos(Math.PI / 6);
const S = 0.5;
type P = [number, number];
const iso = (x: number, y: number, z: number): P => [(x - y) * C, (x + y) * S - z];
const pts = (ps: P[]) => ps.map(([a, b]) => `${a.toFixed(1)},${b.toFixed(1)}`).join(" ");

const ACCENT: Record<IllustrationKind, string> = {
  records: "#4F9DFF",
  search: "#2CC6E6",
  tasks: "#3DBE73",
  inbox: "#F25FC6",
  people: "#2FB585",
  notFound: "#9277FF",
  error: "#FF7A45",
};

function shade(hex: string, f: number) {
  const n = parseInt(hex.slice(1), 16);
  const ch = (v: number) => Math.round(f < 0 ? v * (1 + f) : v + (255 - v) * f);
  return `rgb(${ch(n >> 16)},${ch((n >> 8) & 255)},${ch(n & 255)})`;
}

/** Axis-aligned box: x→right-down, y→left-down, z→up. Returns its three visible faces. */
function box(x: number, y: number, z: number, w: number, d: number, h: number) {
  return {
    top: [iso(x, y, z + h), iso(x + w, y, z + h), iso(x + w, y + d, z + h), iso(x, y + d, z + h)],
    left: [iso(x, y + d, z), iso(x + w, y + d, z), iso(x + w, y + d, z + h), iso(x, y + d, z + h)],
    right: [iso(x + w, y, z), iso(x + w, y + d, z), iso(x + w, y + d, z + h), iso(x + w, y, z + h)],
  };
}

function Box({ b, fill, dots = true, topFill }: { b: ReturnType<typeof box>; fill: string; dots?: boolean; topFill?: string }) {
  return (
    <g>
      <polygon points={pts(b.left)} fill={shade(fill, -0.18)} />
      {dots && <polygon points={pts(b.left)} fill="url(#ill-dots)" />}
      <polygon points={pts(b.right)} fill={shade(fill, -0.32)} />
      {dots && <polygon points={pts(b.right)} fill="url(#ill-dots)" />}
      <polygon points={pts(b.top)} fill={topFill ?? fill} />
      <polygon points={pts(b.left)} fill="none" className="ill-ink" />
      <polygon points={pts(b.right)} fill="none" className="ill-ink" />
      <polygon points={pts(b.top)} fill="none" className="ill-ink" />
    </g>
  );
}

/** A flat shape lying on a box's top face: (u, v) are offsets in x and y at height z. */
const onTop = (x: number, y: number, z: number, uv: P[]) => uv.map(([u, v]) => iso(x + u, y + v, z));

/** Round badge standing beside the object, with a "+" or "×" mark. */
function Coin({ at, fill, mark = "plus" }: { at: P; fill: string; mark?: "plus" | "cross" | "bang" | "q" }) {
  const [cx, cy] = at;
  return (
    <g>
      <ellipse cx={cx + 3} cy={cy + 4} rx={15} ry={13} fill={shade(fill, -0.35)} className="ill-ink" />
      <ellipse cx={cx} cy={cy} rx={15} ry={13} fill={fill} className="ill-ink" />
      {mark === "plus" && <path d={`M${cx - 6} ${cy}h12M${cx} ${cy - 6}v12`} className="ill-mark" />}
      {mark === "cross" && <path d={`M${cx - 5} ${cy - 5}l10 10M${cx + 5} ${cy - 5}l-10 10`} className="ill-mark" />}
      {mark === "bang" && <path d={`M${cx} ${cy - 7}v8M${cx} ${cy + 5}v0.5`} className="ill-mark" />}
      {mark === "q" && <path d={`M${cx - 4.5} ${cy - 3}a4.5 4.5 0 1 1 6 4.2c-1.2.6-1.5 1.3-1.5 2.6M${cx} ${cy + 7}v0.5`} className="ill-mark" />}
    </g>
  );
}

function scene(kind: IllustrationKind): ReactNode {
  const a = ACCENT[kind];
  switch (kind) {
    case "records": {
      // Tray with two loose cards: nothing filed yet
      const tray = box(0, 0, 0, 120, 92, 12);
      const card1 = box(18, 14, 12, 74, 52, 4);
      const card2 = box(30, 26, 16, 74, 52, 4);
      return (
        <>
          <Box b={tray} fill={a} />
          <Box b={card1} fill="#ffffff" dots={false} />
          <Box b={card2} fill="#ffffff" dots={false} />
          <polygon points={pts(onTop(30, 26, 20, [[12, 12], [46, 12], [46, 20], [12, 20]]))} fill={a} />
          <polyline points={pts(onTop(30, 26, 20, [[12, 30], [60, 30]]))} className="ill-line" />
          <polyline points={pts(onTop(30, 26, 20, [[12, 40], [52, 40]]))} className="ill-line" />
          <Coin at={iso(150, 18, 36)} fill={a} />
        </>
      );
    }
    case "search": {
      // Empty grid tile under a magnifier: nothing matched
      const tile = box(0, 0, 0, 110, 110, 10);
      const [mx, my] = iso(62, 50, 64);
      return (
        <>
          <Box b={tile} fill={a} />
          {[22, 44, 66, 88].map((t) => (
            <g key={t}>
              <polyline points={pts(onTop(0, 0, 10, [[t, 8], [t, 102]]))} className="ill-grid" />
              <polyline points={pts(onTop(0, 0, 10, [[8, t], [102, t]]))} className="ill-grid" />
            </g>
          ))}
          <ellipse cx={mx} cy={my + 46} rx={30} ry={13} fill="#000" opacity={0.12} />
          <path d={`M${mx + 18} ${my + 20}l26 26`} strokeWidth={14} strokeLinecap="round" className="ill-handle" />
          <path d={`M${mx + 18} ${my + 20}l26 26`} strokeWidth={8} strokeLinecap="round" stroke={shade(a, -0.35)} />
          <circle cx={mx + 3} cy={my + 3} r={28} fill={shade(a, -0.35)} className="ill-ink" />
          <circle cx={mx} cy={my} r={28} fill={a} className="ill-ink" />
          <circle cx={mx} cy={my} r={18} className="ill-ink ill-glass" />
          <path d={`M${mx - 9} ${my - 6}a11 11 0 0 1 8 -7`} className="ill-shine" />
        </>
      );
    }
    case "tasks": {
      // Clipboard with one ticked box and blank lines
      const board = box(0, 0, 0, 92, 118, 8);
      const clip = box(28, -6, 8, 36, 16, 8);
      return (
        <>
          <Box b={board} fill={a} />
          <polygon points={pts(onTop(0, 0, 8, [[10, 16], [82, 16], [82, 110], [10, 110]]))} fill="#ffffff" className="ill-ink-thin" />
          <Box b={clip} fill={shade(a, -0.2)} />
          {[34, 60, 86].map((v, i) => (
            <g key={v}>
              <polygon points={pts(onTop(0, 0, 8, [[18, v], [30, v], [30, v + 12], [18, v + 12]]))} fill={i === 0 ? a : "#ffffff"} className="ill-ink-thin" />
              <polyline points={pts(onTop(0, 0, 8, [[38, v + 6], [72 - i * 8, v + 6]]))} className="ill-line" />
            </g>
          ))}
          <polyline points={pts(onTop(0, 0, 8, [[20, 40], [24, 44], [29, 36]]))} className="ill-tick" />
          <Coin at={iso(124, 4, 34)} fill={a} />
        </>
      );
    }
    case "inbox": {
      // Open tray with a single envelope resting on the lip
      const base = box(0, 0, 0, 120, 88, 26);
      const env = box(30, 18, 26, 66, 44, 3);
      return (
        <>
          <Box b={base} fill={a} />
          <polygon points={pts(onTop(0, 0, 26, [[10, 10], [110, 10], [110, 78], [10, 78]]))} fill={shade(a, -0.42)} className="ill-ink-thin" />
          <Box b={env} fill="#ffffff" dots={false} />
          <polyline points={pts(onTop(30, 18, 29, [[0, 0], [33, 24], [66, 0]]))} className="ill-line-ink" />
          <Coin at={iso(154, 10, 44)} fill={a} />
        </>
      );
    }
    case "people": {
      // Contact card with an avatar disc: no leads/people yet
      const card = box(0, 0, 0, 120, 84, 10);
      return (
        <>
          <Box b={card} fill={a} />
          <polygon points={pts(onTop(0, 0, 10, [[12, 12], [108, 12], [108, 72], [12, 72]]))} fill="#ffffff" className="ill-ink-thin" />
          <polygon points={pts(onTop(0, 0, 10, [[22, 22], [50, 22], [50, 50], [22, 50]]))} fill={shade(a, 0.35)} className="ill-ink-thin" />
          <polyline points={pts(onTop(0, 0, 10, [[60, 28], [98, 28]]))} className="ill-line" />
          <polyline points={pts(onTop(0, 0, 10, [[60, 40], [88, 40]]))} className="ill-line" />
          <polyline points={pts(onTop(0, 0, 10, [[22, 60], [98, 60]]))} className="ill-line" />
          <Coin at={iso(150, 12, 36)} fill={a} />
        </>
      );
    }
    case "notFound":
    case "error": {
      // A crate with a sign on its face
      const crate = box(0, 0, 0, 86, 86, 70);
      const [fx, fy] = iso(43, 86, 35);
      return (
        <>
          <Box b={crate} fill={a} />
          
          <g transform={`matrix(${C} ${S} 0 1 ${fx} ${fy})`}>
            <rect x={-26} y={-18} width={52} height={36} rx={4} fill="#ffffff" className="ill-ink" />
            <text x={0} y={7} textAnchor="middle" className="ill-sign">{kind === "error" ? "!" : "?"}</text>
          </g>
          <Coin at={iso(116, -6, 92)} fill={a} mark={kind === "error" ? "bang" : "q"} />
        </>
      );
    }
  }
}

// Bounding boxes are fixed per scene so the viewBox hugs each drawing.
const VIEW: Record<IllustrationKind, string> = {
  records: "-110 -60 260 170",
  search: "-115 -70 245 190",
  tasks: "-125 -40 240 180",
  inbox: "-100 -80 260 190",
  people: "-100 -50 250 160",
  notFound: "-100 -150 240 260",
  error: "-100 -150 240 260",
};

export function EmptyIllustration({ kind, className }: { kind: IllustrationKind; className?: string }) {
  const content = scene(kind);
  const a = ACCENT[kind];
  return (
    <svg viewBox={VIEW[kind]} className={className} aria-hidden style={{ ["--ill-accent" as string]: a }}>
      <defs>
        <pattern id="ill-dots" width="5" height="5" patternUnits="userSpaceOnUse">
          <circle cx="1.5" cy="1.5" r="0.9" fill="#111" opacity="0.55" />
        </pattern>
      </defs>
      {/* Sticker backdrop: the drawing again, fat-stroked, outline first then tint */}
      <g className="ill-sticker-edge" aria-hidden>{content}</g>
      <g className="ill-sticker" aria-hidden>{content}</g>
      <g>{content}</g>
    </svg>
  );
}
