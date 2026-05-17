# Database scripts

This directory holds the canonical schema for LifeSort plus forward-only migrations.

## Layout

```
scripts/
├── schema.sql            # Canonical baseline. Run on a fresh database.
├── migrations/           # Forward-only additive migrations, dated YYYY-MM-DD.
│   └── 2026-05-18-agent-action-events.sql
└── legacy/               # Historical migration files. Do not run.
    └── *.sql
```

## Workflow

### Fresh database setup
```bash
psql "$DATABASE_URL" -f scripts/schema.sql
```

That single file produces the complete current schema. Once it has been run, any future migrations in `scripts/migrations/` should be applied in date order.

### Adding a new feature with schema changes
1. Write a new `scripts/migrations/YYYY-MM-DD-<feature>.sql` file with only `CREATE TABLE IF NOT EXISTS`, `ALTER TABLE ... ADD COLUMN IF NOT EXISTS`, and `CREATE INDEX IF NOT EXISTS` statements.
2. Mirror the same `CREATE TABLE` / `ALTER TABLE` content into `schema.sql` so fresh-DB setup stays complete.
3. Document the migration in `AI_TASK_LOG.md` and link the file.
4. Apply the migration to the production database manually (no automated runner is configured).

### Do NOT
- Add new files to `scripts/legacy/`. These are kept for historical reference only.
- Run `legacy/setup-database.sql` — it uses incompatible `SERIAL` user_id types and will break foreign keys against the current `VARCHAR(255)` user_id model.
- Run `legacy/website-current-schema.sql` — it is the pre-consolidation baseline. Use `schema.sql` instead.

## Notes

- `payment_logs`, `pomodoro_sessions`, and `pomodoro_settings` were defined in legacy migrations but are not referenced from any code. They are intentionally excluded from the canonical `schema.sql` (audit 2026-05-17).
- All user-scoped tables use `VARCHAR(255)` for `user_id` with `REFERENCES users(id) ON DELETE CASCADE`.
- Foreign keys to `life_areas` use `ON DELETE SET NULL` so deleting a life area does not cascade through every linked record.
