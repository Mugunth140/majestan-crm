# Ads and HR release review — 2026-10-31

## Findings resolved

- Ads reorder requests lost their IDs at the CRM validation boundary. The DTO now validates and preserves a nonempty list of unique positive IDs. The site API rejects mixed placements and saves each reorder in a single transaction.
- Ads image replacement removed the previous creative before the database save succeeded. Cleanup now follows a successful save and retains any object still referenced by another ad or slot.
- Ads edit links, failed loads, stale navigation responses, image validation, cancelled image decoding, and unsuccessful API response envelopes now have explicit failure handling. Clearing an invalid optional image or keeping the current image permits a retry.
- HR document upload previously returned a fabricated URL without storing the file. Uploads now store real encrypted objects, persist a reference only after storage succeeds, and download through the authenticated CRM API. Failed database writes clean up the new object only when its persisted reference can be ruled out.
- HR follow-up updates and deletes now require both the candidate ID and follow-up ID. Missing candidates and mismatched parent IDs return not found.
- HR candidate loads reject stale responses and show retryable errors. A completed upload cannot refresh a different candidate after navigation. File inputs permit retrying the same file and display upload progress.
- The SMS and WhatsApp test harnesses now mock configuration and HTTP providers instead of failing during dependency setup. No production messaging behavior changed.

## Data and deployment

No entities or SQL migrations changed. Existing HR document URL columns hold short `hr-private://` references; existing genuine HTTP(S) links remain usable. Old fabricated `r2.cloudflare.com/hr-documents/…` links display an upload input because the original endpoint never stored their contents. Existing candidate rows and documents are not rewritten by deployment.

HR uploads use the existing `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY` and `R2_BUCKET_NAME` configuration. Files are encrypted with AES-256-GCM before storage, including filenames and content types, so a public CDN on the shared bucket cannot expose document contents. Downloads require the existing HR authentication guard and use private/no-store response headers. Accepted files are PDF, JPEG, PNG and WebP up to 10 MB; photos accept images only.

The persistent encryption secret is `HR_DOCUMENT_ENCRYPTION_KEY`, falling back to the existing `JWT_SECRET`. **Back up the effective secret with storage backups. Before rotating JWT_SECRET, set HR_DOCUMENT_ENCRYPTION_KEY to the previous effective secret.** Changing the effective encryption secret makes previously uploaded files unreadable; key rotation/re-encryption is not implemented. Existing deployments with JWT and R2 configured need no new variable to start.

Storage failures return errors without saving fabricated URLs. Ambiguous database acknowledgements retain the object to avoid deleting a possibly committed file. Replaced HR objects are retained; automatic orphan cleanup is not part of this release.

The site API change must deploy before or alongside the CRM update. Tests use synthetic files and mocked storage/notification providers; they do not change live records, send messages or upload production documents.

## Verification

| Check | Result |
| --- | --- |
| CRM frontend full Vitest suite | 54 files / 535 tests passed |
| CRM backend full Jest suite | 71 suites / 480 tests passed |
| Site API full Jest suite | 71 suites / 435 tests passed |
| CRM frontend production build and TypeScript check | Passed |
| CRM backend production build | Passed |
| Site API production build | Passed |
| Git whitespace checks | Passed |

Regression coverage includes real Ads form interactions, invalid edit IDs and stale navigation, response-envelope failures, image retry/clear cases, encrypted HR round trips, candidate/document scope, invalid file formats and limits, upload/save failures, authenticated multipart/download routes, follow-up parent scoping and Ads transaction usage. R2 itself is mocked, so an authenticated production upload/download has not been exercised. Targeted Ads/helper lint passed; a pre-existing `any` in the shared FormSelect prop prevents claiming that file is lint-clean. Repository-wide lint is not a release gate established by this review.
