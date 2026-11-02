// Release notes shown in the in-app update dialog. Add a new entry at the top for every
// release you want users to read about; the first entry's version is the app version.

export type ChangeKind = "new" | "improved" | "fixed";

export interface Release {
  version: string;
  date: string; // YYYY-MM-DD
  title: string;
  changes: { kind: ChangeKind; text: string }[];
}

export const RELEASES: Release[] = [
  {
    version: "2.0.0",
    date: "2026-11-02",
    title: "Prismark CRM",
    changes: [
      { kind: "new", text: "The CRM is now Prismark CRM, with a new logo and icons." },
      { kind: "new", text: "Redesigned sign-in page with a light / dark theme switcher." },
      { kind: "new", text: "New sidebar with the workspace menu, notifications and collapse." },
      { kind: "new", text: "In-app updates: you're told when a new version is out and can update in one click." },
      { kind: "improved", text: "Pages show a Prismark loader while they load." },
    ],
  },
];

export const APP_VERSION = RELEASES[0].version;

// Unique per build (set in next.config.ts); a running tab compares its own build ID with
// the server's to detect a fresh deploy, even when the version number didn't change.
export const BUILD_ID = process.env.NEXT_PUBLIC_BUILD_ID ?? "dev";

// Releases newer than `version`, newest first.
export function releasesSince(version: string, releases: Release[] = RELEASES) {
  return releases.filter((r) => compareVersions(r.version, version) > 0);
}

export function compareVersions(a: string, b: string) {
  const pa = a.split(".").map(Number);
  const pb = b.split(".").map(Number);
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const d = (pa[i] ?? 0) - (pb[i] ?? 0);
    if (d) return Math.sign(d);
  }
  return 0;
}
