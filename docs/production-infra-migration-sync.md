# Production infrastructure migrations synchronized — 2 November 2026

At the user's explicit request, SQL migrations 058–064 were copied by SCP into `/home/mugunth/majestan/infra/migrations` on `mugunth@147.93.168.178`, then the normal `docker compose run --rm db-migrate` command was executed from production infra.

## Result

- Applied: 058, 059, 060, 061, 062.
- Skipped: 60 previously recorded files, including 063 (commercial area mapping) and 064 (bathroom split mapping), which had already been applied through restricted migration-runner mounts.
- Runner exit: 0. No failed migrations.
- All local infrastructure SQL migration filenames are now present on the server.
- SHA-256 verification for copied migrations 058–064 matched local files.
- No remote SQL migrations remain pending in `majestan_crm.schema_migrations`.
- Extended MySQL checksums of both `majestan.properties` and `majestan.property_details` matched before and after this synchronization; inventory data was unchanged.

The schema additions/types in 058–062 were already present through application migrations. The guarded SQL synchronized infrastructure tracking and registry requirements. The completed area and bathroom mappings were not run again.

## Backup

A fresh full dump of both `majestan` and `majestan_crm` was taken with a consistent snapshot and gzip integrity checked before executing the migrator:

`/home/mugunth/crm_backups/pre_infra_migrations_058_062_20261102T094042Z.sql.gz`

No application code was deployed, no Git commit was created, and no Git push was performed. In particular, the pending Commercial Buy boundary UI still requires a later authorized code deployment.
