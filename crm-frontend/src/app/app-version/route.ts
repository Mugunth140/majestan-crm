import { APP_VERSION, BUILD_ID, RELEASES } from "@/lib/release";

// The build that is currently deployed. Open tabs poll this and offer an update when it
// differs from the build they were loaded from.
export const dynamic = "force-dynamic";

export function GET() {
  return Response.json(
    { buildId: BUILD_ID, version: APP_VERSION, releases: RELEASES },
    { headers: { "Cache-Control": "no-store, max-age=0" } },
  );
}
