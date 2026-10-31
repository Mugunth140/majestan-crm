# Property curation branch release review

31 October 2026. Compared the proposed merges against freshly fetched `origin/master` in CRM, site API and public frontend.

## Outcome

The property changes have no outstanding review blocker after the migration corrections below. All four production builds passed. Full suites were run; unchanged baseline failures are listed explicitly instead of being described as passing.

The CRM integration was built/tested in a clean checkout combining the curation branch with current remote master. Unrelated uncommitted Ads/HR/project edits in the original checkout were preserved and excluded from the property commits.

## Additional corrections from this final review

- Corrected generated enum literal quoting in inherited SQL 054 and 055. The append path is now executed successfully when the new enum value is absent, rather than only testing already-migrated schemas.
- SQL 054, 055 and 059 now use INSERT IGNORE for registry seeds, keeping customized labels and inactive flags. SQL 061 and the runtime registry seed already follow this behavior.
- Reviewed the inherited asset repair migration 057: it adds missing nullable columns only and preserves existing asset values and the ledger. No new asset application changes were included.
- Verified whitespace and corresponding infra/CRM SQL copies.

## Exact integration validation

- Clean integrated CRM frontend: **494 tests passed**, 50 files.
- Clean integrated CRM backend: **457 tests passed** in 66 loaded suites; two SMS/WhatsApp suites cannot load installed ESM `@nestjs/axios` in Jest, as already observed before these changes.
- Site backend: **429 tests passed**, 71 suites.
- Full public frontend: **758 tests passed**, five failures. Four failures in wizard/gallery/location tests were previously reproduced on unchanged committed code; the fifth is the known SEO test timeout under the full parallel run. Changed property suites and the SEO test are also checked separately.
- Production builds passed for both frontends and both backends, including their TypeScript checks.
- Full migration sequence **054–061** executed on a disposable MySQL 8 database and then rerun. Tests exercised a previously absent type, retained a custom enum value and its existing row/rate, and kept customized/inactive registry entries. The inherited asset repair retained an existing remarks value.
- Earlier fix verification also exercised 18 actual form payloads through the CRM mapper and real site update transactions, privacy/attachment retention, explicit removals and rollback behavior; see `property-curation-fixes.md`.

## Release handling

The site API is pushed first because its production startup applies the registered schema migrations. The CRM runtime registry seed covers the separate CRM selector database. CRM and public frontend pushes follow the site API workflow so new forms do not precede backend support. CI is monitored after pushing.

No production-size load rehearsal or authenticated browser walkthrough is claimed. Existing baseline test failures remain outside this curation release. Source-level and migration experiments used synthetic/local data; no production records or customer files were edited manually.
