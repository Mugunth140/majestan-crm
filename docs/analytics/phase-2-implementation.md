# Website analytics in CRM

Implemented locally on `redesign/crm-v2`. No deployment, push, merge, production queries, secret generation or site repository edits were performed.

## Server configuration

Set these on the **CRM backend**, never in frontend variables:

```dotenv
SITE_ANALYTICS_API_URL=http://site-site-backend-1:5000/api/v1
SITE_ANALYTICS_READ_KEY=<match the site backend's existing read key>
```

The URL defaults to the value above on the shared `majestan_network`. An explicitly empty/invalid URL or missing key returns a clear 503 from the integration, without failing CRM startup. `.env.example` documents both values. No actual environment file was edited.

## Architecture and access

New code lives in `crm-backend/src/modules/site-analytics`; the pre-existing CRM DuckDB analytics module is unchanged. `/api/v1/site-analytics/report`, `/compare` and `/status` use the existing JWT guard plus `RolesGuard` and `@Roles('Admin', 'Manager')`. Super Admin passes the existing guard automatically. Staff and Team Leads are denied even if they manually call an endpoint.

The existing Analytics navigation item already follows Dashboard. Existing frontend/backend navigation rules lock it for Staff and Team Leads, and NavGuard blocks direct page access. Regression tests verify this behavior; no navigation schema change was necessary.

The CRM service calls the site's protected API with a server-only `X-Analytics-Key`, an 8-second timeout and validated UTC dates (exclusive end, maximum 93 days). The compare endpoint requests the immediately preceding equal-length period. Nested numeric strings are converted to numbers. Upstream bodies and transport error details are not forwarded. A 401 becomes a 502 key mismatch; unreachable, timeout and other upstream failures become a safe 503.

Historical reports are cached for up to 60 seconds per range (128 ranges maximum). Realtime is separate, with a maximum age of 15 seconds. Because phase 1 has no separate live endpoint, refreshing realtime requires fetching the report endpoint; the historical payload remains cached for its original 60-second lifetime. In-flight requests for an identical range are deduplicated. The browser polls every 30 seconds while visible and refreshes on becoming visible.

## Dashboard

The page reuses CRM DataCard, MobileHeader, dialog components, tokens and dark mode. Charts use hand-built SVG and `d3-scale`; no chart dependency was added. Presets and custom ranges persist through `usePersistedState`, with explicitly labelled UTC days and an inclusive custom end converted to the API's exclusive end.

Traffic includes visitor-days, pageviews, correctly denominated bounce rate, engagement, conversions, previous-period changes and an aligned previous-period chart. Ranked panels show the top eight and open up to 100 entries in a dialog. Shares use available totals, countries keep Unknown last, and language/timezone are collapsed under More.

Speed Insights displays p75/p50/p95, field sample counts and the requested Google threshold colors. It does not invent a proprietary experience score. Empty, skeleton, error, missing comparison and unavailable live states are distinct. Failed polling never breaks the rest of CRM.

## Phase 1 API limitations

The current site API does **not** expose:

- Separate needs-improvement/poor sample counts (only total and good).
- Performance percentiles by route.
- API error counts broken down by status code.

These cannot be reconstructed from aggregate counts or overall percentiles. The dashboard shows known good share and a neutral remainder, labels the missing distribution, and shows an explicit unavailable state for the route table. It displays aggregate API errors with a note about the absent status breakdown. Optional complete distribution/route/status fields are supported by the UI for a future API extension. No changes were made to either site repo to obtain them.

## Verification

- New backend tests: 25 passing, including role protection over local HTTP, date validation, previous windows, recursive conversion, caching, configuration, invalid responses and timeout/error mapping.
- New frontend tests: 15 passing, including UTC/date limits, metric definitions, locked navigation, panel/dialog behavior, missing-data handling, keyboard chart inspection and visibility-based polling.
- Full frontend suite: 740 tests passing across 79 files.
- Backend Jest run: 703 tests passed across 93 suites. Two pre-existing files import `bun:test` and cannot run under Jest; both failures were reproduced on unchanged HEAD. Running those files with Bun passed all six tests. Use Jest excluding those two files, followed by `bun test src/modules/record-events/record-events.service.spec.ts src/modules/agents/agents-patch.spec.ts`, to run the complete collection with the correct runners.
- Backend and frontend production builds passed. Standalone frontend `tsc` reports the same ten diagnostics as HEAD, all in unrelated existing tests. No new TypeScript diagnostics were introduced.
- ESLint passes on all new code and changed environment validation. The changed backend app module retains the same 27 existing ESLint errors as HEAD, with no added errors. The missing `eslint-config-prettier` development peer dependency was pinned so the existing backend ESLint configuration can run.
- Local Chromium checks used mocked API responses only: both tabs, light/dark themes, and a 375 px viewport. Document scroll width was 375 px, and there were no browser exceptions. A separate loopback HTTP contract fixture exercised the real CRM service's upstream fetch, read-key header, comparison window and numeric conversion; no key appeared in returned data.

No sample data is used as a production fallback. Test fixtures are confined to tests and local verification.
