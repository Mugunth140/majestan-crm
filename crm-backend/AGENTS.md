# Backend Agent Instructions (NestJS + TypeORM)

## 1. Database Migrations
**CRITICAL:** `synchronize` is set to `false` in TypeORM. When you create or update an Entity (`.entity.ts`), the database will NOT update automatically.

You MUST create a migration file:
1. Go to `infra/migrations/` (from the project root).
2. Create the next sequential SQL file (e.g., `003_add_user_fields.sql`).
3. Write pure MySQL 8.0 statements.
4. Test it locally by running: `cd infra && docker compose run --rm db-migrate`.

The deployment script (`deploy.sh`) will automatically run your migration on staging/production, so do not alter live databases manually.
