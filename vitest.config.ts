import { defineConfig } from "vitest/config"
import path from "path"

export default defineConfig({
  test: {
    environment: "node",
    env: {
      // lib/auth.ts and lib/db.ts construct a Neon client at module scope;
      // tests never issue real queries, but the constructor requires a
      // connection-string-shaped value to be present.
      DATABASE_URL: "postgres://test:test@localhost:5432/lifesort_test",
    },
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "."),
    },
  },
})
