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

## Running a migration against Neon

There is no automated migration runner in this repo. Pick whichever of the three options below fits your workflow.

### Option A — Neon Console SQL Editor (recommended)

1. Open https://console.neon.tech → select the LifeSort project → SQL Editor.
2. Copy the contents of the migration file (e.g. `scripts/migrations/2026-05-18-agent-action-events.sql`) into the editor.
3. Click **Run**. Repeat for each migration in date order.
4. Verify with the queries below.

### Option B — `psql` against the connection string

```bash
# install once on macOS:
brew install libpq && brew link --force libpq

# then for each migration (date order):
psql "$(grep '^DATABASE_URL=' .env.local | cut -d= -f2-)" \
  -f scripts/migrations/2026-05-18-agent-action-events.sql
psql "$(grep '^DATABASE_URL=' .env.local | cut -d= -f2-)" \
  -f scripts/migrations/2026-05-18-add-indexes.sql
```
Neon connection strings already include the right SSL params, so nothing extra to add.

### Option C — One-off Node script using `@neondatabase/serverless`

Useful when you can't install `libpq`. Does NOT work for `CREATE INDEX CONCURRENTLY` (the driver wraps statements in an implicit transaction). Use Option A or B for index migrations.

```bash
cat > /tmp/run-migration.mjs <<'EOF'
import { neon } from "@neondatabase/serverless"
import fs from "node:fs"

const sql = neon(process.env.DATABASE_URL)
const text = fs.readFileSync(process.argv[2], "utf8")
const cleaned = text.replace(/^\s*(BEGIN|COMMIT);\s*$/gim, "")
const statements = cleaned
  .split(/;\s*$/gm)
  .map(s => s.trim())
  .filter(s => s.length > 0 && !s.startsWith("--"))
for (const stmt of statements) {
  console.log(stmt.slice(0, 80) + "...")
  await sql.unsafe(stmt + ";")
}
console.log("Done.")
EOF

node --env-file=.env.local /tmp/run-migration.mjs \
  scripts/migrations/2026-05-18-agent-action-events.sql
```

### Verification after running

```sql
-- agent_action_events migration applied?
SELECT COUNT(*) FROM agent_action_events;        -- should return 0

-- index migration applied?
SELECT indexname FROM pg_indexes
WHERE tablename IN ('habits','notifications','routine_steps')
  AND indexname IN (
    'idx_habits_user_frequency',
    'idx_notifications_user_type',
    'idx_routine_steps_routine_sort'
  )
ORDER BY indexname;                              -- should return 3 rows
```

### Sanity check — are the legacy tables already in prod?

The canonical `schema.sql` includes 10 tables that originally came from legacy `add-*.sql` migrations (habits, habit_checkins, routines, routine_steps, people, people_reminders, people_links, vault_items, notifications, custom_section_records). They are assumed already applied to production. If you're unsure, run this once:

```sql
SELECT table_name FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_name IN (
    'habits','habit_checkins','routines','routine_steps',
    'people','people_reminders','people_links',
    'vault_items','notifications','custom_section_records'
  )
ORDER BY table_name;
```
Should return 10 rows. If any are missing, apply the matching `legacy/add-*.sql` content for the missing tables only (do NOT run the legacy file wholesale — copy the `CREATE TABLE` block for the missing table into the SQL editor).

## Notes

- `payment_logs`, `pomodoro_sessions`, and `pomodoro_settings` were defined in legacy migrations but are not referenced from any code. They are intentionally excluded from the canonical `schema.sql` (audit 2026-05-17).
- All user-scoped tables use `VARCHAR(255)` for `user_id` with `REFERENCES users(id) ON DELETE CASCADE`.
- Foreign keys to `life_areas` use `ON DELETE SET NULL` so deleting a life area does not cascade through every linked record.
