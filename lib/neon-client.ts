import { neon, types } from "@neondatabase/serverless"

// Every DB-touching file in this app should import `neon` from here instead
// of directly from "@neondatabase/serverless" -- see AI_DECISIONS.md for the
// full writeup.
//
// Postgres DATE columns (OID 1082) otherwise parse into JS Date objects
// constructed at local-server midnight; on a non-UTC server, reading that
// value back via a UTC method (.toISOString(), JSON.stringify) shifts it to
// the previous day. Registering a type parser that returns the raw
// "YYYY-MM-DD" wire string instead avoids the ambiguity entirely.
//
// A Next.js `instrumentation.ts` `register()` hook looks like the obvious
// place to do this once, globally, but does NOT work here: Next.js bundles
// each API route (and the instrumentation entry point) separately, so a
// registration made there runs against a different in-memory copy of
// @neondatabase/serverless (and its pg-types registry) than the one an API
// route's own `neon()` calls execute queries against -- confirmed by
// directly testing both approaches against a live task's due_date. The fix
// has to run inside the same bundle that executes the query, which this
// wrapper achieves simply by being imported alongside `neon` everywhere.
types.setTypeParser(types.builtins.DATE, (value) => value)

export { neon }
